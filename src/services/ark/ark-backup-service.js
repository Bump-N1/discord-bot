import { mkdir, open, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getArkConfig } from './ark-config.js';
import {
    createNitradoDirectory,
    deleteNitradoPath,
    downloadNitradoFileBuffer,
    fetchNitradoFileServerBookmarks,
    fetchNitradoGameServer,
    fetchNitradoServerConfig,
    isTerminalNitradoServiceError,
    listNitradoDirectory,
    restartNitradoServer,
    startNitradoServer,
    uploadNitradoFileBuffer
} from './nitrado-client.js';

const BACKUP_ID_PATTERN = /^\d{8}-\d{6}(?:-\d+)?$/u;
const BACKUP_LOCK_FILE = '.backup.lock';
const BACKUP_LOCK_STALE_MS = 6 * 60 * 60 * 1000;
const CONFIG_DIRECTORY_PATTERN = /\/ShooterGame\/Saved\/Config\/WindowsServer\/?$/iu;
const FT_ROOT_PATTERN = /\/ftproot\/?$/iu;
const ARK_APP_ROOT_PATTERN = /\/ftproot\/arksa\/?$/iu;
const TARGET_RELATIVE_ROOTS = [
    'ShooterGame/Saved/Config/WindowsServer',
    'ShooterGame/Saved/SavedArks'
];
const TERMINAL_SERVICE_STATUSES = new Set([
    'cancelled',
    'canceled',
    'deleted',
    'expired',
    'inactive',
    'suspended',
    'terminated'
]);

export async function createArkBackup(options = {}) {
    const backup = await startArkBackup(options);

    return backup.task;
}

export async function startArkBackup(options = {}) {
    const config = getArkConfig();
    const releaseLock = await acquireArkBackupLock(config);

    return {
        task: runArkBackup(config, releaseLock, options)
    };
}

async function runArkBackup(config, releaseLock, options = {}) {
    let completed = false;
    let partialDirectory = '';

    try {
        const now = new Date();
        const backupId = await createUniqueBackupId(config.backupDirectory, now);
        const backupDirectory = resolveBackupPath(config.backupDirectory, backupId);
        const filesDirectory = path.join(resolveBackupPath(config.backupDirectory, `${backupId}.partial`), 'files');

        partialDirectory = resolveBackupPath(config.backupDirectory, `${backupId}.partial`);

        const arkPaths = await resolveArkBackupPaths(config);
        const server = await readOptionalServerConfig(config);
        const remoteFiles = await collectBackupFiles(config, arkPaths);
        const files = [];
        let totalBytes = 0;

        if (remoteFiles.length === 0) {
            throw new Error('バックアップ対象のARKファイルが見つかりませんでした。');
        }

        await mkdir(filesDirectory, {
            recursive: true
        });

        for (const remoteFile of remoteFiles) {
            const contents = await downloadNitradoFileBuffer(config, remoteFile.path);
            const relativePath = toBackupRelativePath(arkPaths.appRoot, remoteFile.path);
            const localPath = safeJoin(filesDirectory, relativePath);

            await mkdir(path.dirname(localPath), {
                recursive: true
            });
            await writeFile(localPath, contents);

            totalBytes += contents.length;
            files.push({
                relativePath: relativePath,
                remotePath: remoteFile.path,
                size: contents.length,
                modifiedAt: remoteFile.modified_at || null
            });
        }

        const manifest = {
            id: backupId,
            createdAt: now.toISOString(),
            reason: options.reason || '手動バックアップ',
            actorId: options.actorId || '',
            actorName: options.actorName || '',
            serviceId: config.nitradoServiceId,
            appRoot: arkPaths.appRoot,
            server: server,
            fileCount: files.length,
            totalBytes: totalBytes,
            files: files
        };

        await writeFile(path.join(partialDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        await rename(partialDirectory, backupDirectory);
        completed = true;
        await pruneArkBackups(config.backupDirectory, config.backupRetentionCount);

        return summarizeBackupManifest(manifest);
    } finally {
        if (!completed && partialDirectory) {
            await rm(partialDirectory, {
                recursive: true,
                force: true
            });
        }

        await releaseLock();
    }
}

export function isArkBackupAlreadyRunningError(error) {
    return error?.code === 'ARK_BACKUP_RUNNING';
}

export async function listArkBackups() {
    const config = getArkConfig();
    const backupDirectory = resolveBackupDirectory(config.backupDirectory);
    const names = await readDirectoryNames(backupDirectory);
    const manifests = [];

    for (const name of names) {
        if (!BACKUP_ID_PATTERN.test(name)) {
            continue;
        }

        try {
            const manifest = await readBackupManifest(config.backupDirectory, name);

            manifests.push(summarizeBackupManifest(manifest));
        } catch (error) {
            // Broken backup folders are ignored in the UI.
        }
    }

    return manifests.sort(compareBackupDesc);
}

export async function restoreArkBackup(backupId, options = {}) {
    const config = getArkConfig();
    const manifest = await readBackupManifest(config.backupDirectory, backupId);
    const current = await fetchNitradoServerConfig(config);

    assertRestoreAllowed(current);

    const arkPaths = await resolveArkBackupPaths(config);
    const currentFiles = await collectBackupFiles(config, arkPaths);
    const backupRelativePathSet = new Set(manifest.files.map(function(file) {
        return path.posix.normalize(file.relativePath);
    }));
    const directories = Array.from(new Set(manifest.files.map(function(file) {
        return path.posix.dirname(file.relativePath);
    }))).sort(function(left, right) {
        return left.length - right.length;
    });

    for (const directory of directories) {
        if (!directory || directory === '.') {
            continue;
        }

        await ensureRemoteDirectory(config, `${arkPaths.appRoot}/${directory}`);
    }

    for (const file of manifest.files) {
        const localPath = safeJoin(path.join(resolveBackupPath(config.backupDirectory, backupId), 'files'), file.relativePath);
        const contents = await readFile(localPath);
        const remotePath = `${arkPaths.appRoot}/${file.relativePath}`;
        const remoteDirectory = path.posix.dirname(remotePath);
        const fileName = path.posix.basename(remotePath);

        await uploadNitradoFileBuffer(config, remoteDirectory, fileName, contents);
    }

    const deleted = await deleteFilesOutsideBackup(config, arkPaths, currentFiles, backupRelativePathSet);
    const reboot = await rebootAfterRestore(config, current);

    return {
        actorId: options.actorId || '',
        actorName: options.actorName || '',
        backup: summarizeBackupManifest(manifest),
        restoredFileCount: manifest.files.length,
        restoredBytes: manifest.totalBytes || 0,
        deletedFileCount: deleted.fileCount,
        deletedBytes: deleted.bytes,
        reboot: reboot
    };
}

export async function getArkServiceAvailability() {
    const config = getArkConfig();

    try {
        const gameServer = await fetchNitradoGameServer(config);
        const status = String(gameServer?.status || '').toLowerCase();
        const terminal = TERMINAL_SERVICE_STATUSES.has(status);

        return {
            available: !terminal,
            terminal: terminal,
            status: status || 'unknown',
            reason: terminal ? `service status is ${status}` : ''
        };
    } catch (error) {
        if (isTerminalNitradoServiceError(error)) {
            return {
                available: false,
                terminal: true,
                status: String(error.status || 'unavailable'),
                reason: error.message
            };
        }

        throw error;
    }
}

export function buildArkBackupNotificationMessage(result) {
    return [
        '💾 ARKバックアップを作成しました。',
        `理由：${result.reason}`,
        `保存日時：${formatBackupDateTime(result.createdAt)}`,
        `対象：${formatBackupServer(result)}`,
        `サイズ：${formatBytes(result.totalBytes)} / ${result.fileCount}ファイル`
    ].join('\n');
}

export function buildArkBackupFailureNotificationMessage(reason, error) {
    return [
        '⚠️ ARKバックアップに失敗しました。',
        `理由：${reason}`,
        `内容：${error.message || '不明なエラー'}`
    ].join('\n');
}

export function buildArkRestoreNotificationMessage(result) {
    const lines = [
        `${formatActor(result.actorId, result.actorName)}がARKバックアップを復元しました。`,
        `バックアップ：${formatBackupDateTime(result.backup.createdAt)}`,
        `復元対象：${formatBackupServer(result.backup)}`,
        `ファイル：${result.restoredFileCount}件 / ${formatBytes(result.restoredBytes)}`,
        `削除：${result.deletedFileCount || 0}件 / ${formatBytes(result.deletedBytes || 0)}`
    ];

    lines.push(buildRestoreRebootNotice(result.reboot));

    return lines.join('\n');
}

function buildRestoreRebootNotice(reboot) {
    if (reboot.status === 'restarted') {
        return '復元内容を反映する為、サーバーを再起動します。';
    }

    if (reboot.status === 'started') {
        return 'サーバーが停止中だった為、復元内容を反映する為に起動します。';
    }

    return '復元は完了しましたが、サーバーの再起動に失敗しました。Nitradoの状態を確認してください。';
}

async function collectBackupFiles(config, arkPaths) {
    const files = [];

    for (const root of arkPaths.roots) {
        const rootFiles = await listFilesRecursive(config, root.remotePath);

        files.push(...rootFiles);
    }

    return uniqueFiles(files).sort(function(left, right) {
        return left.path.localeCompare(right.path);
    });
}

async function listFilesRecursive(config, directoryPath) {
    let entries;

    try {
        entries = await listNitradoDirectory(config, directoryPath);
    } catch (error) {
        if (isMissingPathError(error)) {
            return [];
        }

        throw error;
    }

    const files = [];

    for (const entry of entries) {
        if (entry.type === 'dir') {
            files.push(...await listFilesRecursive(config, entry.path));
        } else if (entry.type === 'file') {
            files.push(entry);
        }
    }

    return files;
}

async function resolveArkBackupPaths(config) {
    const bookmarks = await fetchNitradoFileServerBookmarks(config);
    const appRoot = resolveArkAppRoot(bookmarks);
    const configRoot = bookmarks.find(function(bookmark) {
        return CONFIG_DIRECTORY_PATTERN.test(bookmark);
    }) || `${appRoot}/ShooterGame/Saved/Config/WindowsServer`;

    return {
        appRoot: appRoot,
        roots: TARGET_RELATIVE_ROOTS.map(function(relativeRoot) {
            return {
                relativeRoot: relativeRoot,
                remotePath: relativeRoot.endsWith('/WindowsServer') ? configRoot : `${appRoot}/${relativeRoot}`
            };
        })
    };
}

function resolveArkAppRoot(bookmarks) {
    const appRoot = bookmarks.find(function(bookmark) {
        return ARK_APP_ROOT_PATTERN.test(bookmark);
    });

    if (appRoot) {
        return appRoot.replace(/\/$/u, '');
    }

    const ftRoot = bookmarks.find(function(bookmark) {
        return FT_ROOT_PATTERN.test(bookmark);
    });

    if (!ftRoot) {
        throw new Error('NitradoのARKファイル配置先を取得できませんでした。');
    }

    return `${ftRoot.replace(/\/$/u, '')}/arksa`;
}

async function readOptionalServerConfig(config) {
    try {
        const server = await fetchNitradoServerConfig(config);

        return {
            name: server.serverName || '',
            map: server.map || '',
            mapLabel: server.mapLabel || '',
            activeMods: server.activeMods || [],
            status: server.status || ''
        };
    } catch (error) {
        return {
            name: config.serverName || '',
            map: '',
            mapLabel: '',
            activeMods: [],
            status: '',
            error: error.message
        };
    }
}

async function rebootAfterRestore(config, current) {
    try {
        if (isStoppedServer(current.status)) {
            await startNitradoServer(config);

            return {
                status: 'started'
            };
        }

        await restartNitradoServer(config);

        return {
            status: 'restarted'
        };
    } catch (error) {
        return {
            status: 'failed',
            message: error.message
        };
    }
}

function assertRestoreAllowed(current) {
    if (isStoppedServer(current.status)) {
        return;
    }

    if (current.playerCount === 0) {
        return;
    }

    if (current.playerCount === null || current.playerCount === undefined) {
        throw new Error('プレイヤー数を確認できない為、復元は実行できません。');
    }

    throw new Error('サーバー内にプレイヤーが存在する為、復元は実行できません。');
}

async function ensureRemoteDirectory(config, directoryPath) {
    try {
        await listNitradoDirectory(config, directoryPath);
        return;
    } catch (error) {
        if (!isMissingPathError(error)) {
            throw error;
        }
    }

    try {
        await createNitradoDirectory(config, directoryPath);
    } catch (error) {
        if (!isAlreadyExistsError(error)) {
            throw error;
        }
    }
}

async function deleteFilesOutsideBackup(config, arkPaths, currentFiles, backupRelativePathSet) {
    let fileCount = 0;
    let bytes = 0;

    for (const currentFile of currentFiles) {
        const relativePath = toBackupRelativePath(arkPaths.appRoot, currentFile.path);

        if (backupRelativePathSet.has(relativePath)) {
            continue;
        }

        try {
            await deleteNitradoPath(config, currentFile.path);
        } catch (error) {
            if (isMissingPathError(error)) {
                continue;
            }

            throw error;
        }

        fileCount += 1;
        bytes += Number(currentFile.size || 0);
    }

    return {
        fileCount: fileCount,
        bytes: bytes
    };
}

async function pruneArkBackups(backupDirectory, retentionCount) {
    const backups = await listArkBackups();
    const keepCount = Math.max(1, Number(retentionCount) || 1);
    const deleteTargets = backups.slice(keepCount);
    const root = resolveBackupDirectory(backupDirectory);

    for (const backup of deleteTargets) {
        const target = resolveBackupPath(root, backup.id);

        await rm(target, {
            recursive: true,
            force: true
        });
    }
}

async function acquireArkBackupLock(config) {
    const backupDirectory = resolveBackupDirectory(config.backupDirectory);
    const lockPath = resolveBackupPath(config.backupDirectory, BACKUP_LOCK_FILE);

    await mkdir(backupDirectory, {
        recursive: true
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const handle = await open(lockPath, 'wx');

            try {
                await handle.writeFile(`${JSON.stringify({
                    pid: process.pid,
                    createdAt: new Date().toISOString()
                }, null, 2)}\n`, 'utf8');
            } finally {
                await handle.close();
            }

            return async function releaseArkBackupLock() {
                try {
                    await unlink(lockPath);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                }
            };
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }

            if (await removeStaleBackupLock(lockPath)) {
                continue;
            }

            throw createBackupAlreadyRunningError();
        }
    }

    throw createBackupAlreadyRunningError();
}

async function removeStaleBackupLock(lockPath) {
    try {
        const lockStat = await stat(lockPath);
        const lockAge = Date.now() - lockStat.mtimeMs;

        if (lockAge < BACKUP_LOCK_STALE_MS) {
            return false;
        }

        await unlink(lockPath);

        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return true;
        }

        return false;
    }
}

function createBackupAlreadyRunningError() {
    const error = new Error('ARKバックアップは現在実行中です。完了後にもう一度試してください。');

    error.code = 'ARK_BACKUP_RUNNING';

    return error;
}

async function readBackupManifest(backupDirectory, backupId) {
    if (!BACKUP_ID_PATTERN.test(backupId)) {
        throw new Error('バックアップIDが正しくありません。');
    }

    const manifestPath = resolveBackupPath(backupDirectory, backupId, 'manifest.json');

    return JSON.parse(await readFile(manifestPath, 'utf8'));
}

async function createUniqueBackupId(backupDirectory, date) {
    const baseId = formatBackupId(date);
    let backupId = baseId;
    let index = 2;

    while (await pathExists(resolveBackupPath(backupDirectory, backupId))) {
        backupId = `${baseId}-${index}`;
        index += 1;
    }

    return backupId;
}

function summarizeBackupManifest(manifest) {
    return {
        id: manifest.id,
        createdAt: manifest.createdAt,
        reason: manifest.reason || '',
        actorId: manifest.actorId || '',
        actorName: manifest.actorName || '',
        serverName: manifest.server?.name || '',
        map: manifest.server?.map || '',
        mapLabel: manifest.server?.mapLabel || manifest.server?.map || '',
        activeMods: manifest.server?.activeMods || [],
        fileCount: manifest.fileCount || manifest.files?.length || 0,
        totalBytes: manifest.totalBytes || 0
    };
}

function toBackupRelativePath(appRoot, remotePath) {
    const root = appRoot.replace(/\/$/u, '');
    const pathText = String(remotePath || '');

    if (!pathText.startsWith(`${root}/`)) {
        throw new Error(`バックアップ対象外のファイルパスです：${remotePath}`);
    }

    return path.posix.normalize(pathText.slice(root.length + 1));
}

function uniqueFiles(files) {
    const map = new Map();

    for (const file of files) {
        if (file?.path) {
            map.set(file.path, file);
        }
    }

    return Array.from(map.values());
}

function safeJoin(root, relativePath) {
    const target = path.resolve(root, ...String(relativePath || '').split('/').filter(Boolean));
    const resolvedRoot = path.resolve(root);

    if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
        throw new Error('バックアップファイルのパスが不正です。');
    }

    return target;
}

function resolveBackupDirectory(backupDirectory) {
    return path.resolve(process.cwd(), backupDirectory || 'data/ark-backups');
}

function resolveBackupPath(backupDirectory, ...parts) {
    const root = resolveBackupDirectory(backupDirectory);
    const target = path.resolve(root, ...parts);

    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        throw new Error('バックアップディレクトリのパスが不正です。');
    }

    return target;
}

async function readDirectoryNames(directoryPath) {
    try {
        await mkdir(directoryPath, {
            recursive: true
        });

        return await readdir(directoryPath);
    } catch (error) {
        return [];
    }
}

async function pathExists(target) {
    try {
        await stat(target);

        return true;
    } catch (error) {
        return false;
    }
}

function formatBackupId(date) {
    const parts = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(date).reduce(function(values, part) {
        values[part.type] = part.value;

        return values;
    }, {});

    return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

function compareBackupDesc(left, right) {
    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
}

function formatBackupDateTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '未取得';
    }

    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function formatBackupServer(result) {
    return [
        result.serverName || 'ARK Server',
        result.mapLabel || result.map
    ].filter(Boolean).join(' / ');
}

function formatBytes(value) {
    const bytes = Number(value) || 0;
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatActor(actorId, actorName) {
    return actorId ? `<@${actorId}>` : `@${actorName || 'ユーザー'}`;
}

function isStoppedServer(status) {
    return ['stopped'].includes(String(status || '').toLowerCase());
}

function isMissingPathError(error) {
    return /does not exist|not found|404/iu.test(String(error?.message || error?.body || ''));
}

function isAlreadyExistsError(error) {
    return /already exists|exist/iu.test(String(error?.message || error?.body || ''));
}
