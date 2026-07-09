import { describe, expect, it } from 'vitest';
import {
    buildArkEditNotificationMessages,
    buildArkRebootNotificationMessage,
    normalizeModIds
} from '../src/services/ark/ark-edit-service.js';
import {
    buildCurseForgeModFallbackUrl,
    getCurseForgeArkModsUrl,
    isResolvedCurseForgeModDetail
} from '../src/services/ark/curseforge-client.js';
import { formatStateLabel } from '../src/services/ark/ark-service.js';
import {
    buildArkBackupFailureNotificationMessage,
    buildArkBackupNotificationMessage,
    buildArkRestoreNotificationMessage,
    isArkBackupAlreadyRunningError
} from '../src/services/ark/ark-backup-service.js';

describe('ARK edit service', function() {
    it('MOD IDを重複排除し、数字以外を捨てる', function() {
        expect(normalizeModIds('123, 456 123 abc 789-0 000')).toEqual([
            '123',
            '456',
            '000'
        ]);
        expect(normalizeModIds(['123', ' ', '456', '123'])).toEqual([
            '123',
            '456'
        ]);
    });

    it('設定変更通知は変更された項目だけ出す', function() {
        const [summary, rebootNotice] = buildArkEditNotificationMessages({
            actorId: '100',
            before: {
                mapLabel: 'Genesis 1',
                activeMods: ['111']
            },
            after: {
                mapLabel: 'Astraeos',
                activeMods: ['111', '222']
            },
            diff: {
                mapChanged: true,
                addedMods: ['222'],
                removedMods: []
            },
            reboot: {
                status: 'restarted'
            }
        });

        expect(summary).toContain('<@100>がサーバー設定を変更しました。');
        expect(summary).toContain('MAP：Genesis 1→Astraeos');
        expect(summary).toContain('MOD追加：222');
        expect(summary).not.toContain('MOD削除');
        expect(rebootNotice).toBe('設定を反映する為、サーバーを再起動します。');
    });

    it('プレイヤーがいる場合は再起動しない通知を出す', function() {
        const [summary, rebootNotice] = buildArkEditNotificationMessages({
            actorId: '',
            actorName: 'Bump',
            before: {
                mapLabel: 'The Island',
                activeMods: ['111', '222']
            },
            after: {
                mapLabel: 'The Island',
                activeMods: ['111']
            },
            diff: {
                mapChanged: false,
                addedMods: [],
                removedMods: ['222']
            },
            reboot: {
                status: 'skipped_players'
            }
        });

        expect(summary).toContain('@Bumpがサーバー設定を変更しました。');
        expect(summary).toContain('MOD削除：222');
        expect(summary).not.toContain('MAP：');
        expect(rebootNotice).toContain('サーバー内にプレイヤーが存在する為、再起動は行われません。');
    });

    it('手動再起動通知の分岐を保持する', function() {
        expect(buildArkRebootNotificationMessage({
            actorId: '100',
            reboot: {
                status: 'started'
            }
        })).toContain('サーバーが停止中だった為、起動します。');

        expect(buildArkRebootNotificationMessage({
            actorId: '100',
            reboot: {
                status: 'skipped_unknown_players'
            }
        })).toContain('サーバー内のプレイヤー数を確認できない為、再起動は行われません。');
    });
});

describe('ARK CurseForge helpers', function() {
    it('MOD一覧と個別検索URLを生成する', function() {
        expect(getCurseForgeArkModsUrl()).toBe('https://www.curseforge.com/ark-survival-ascended/search?class=mods');
        expect(buildCurseForgeModFallbackUrl(' 123 456 ')).toBe(
            'https://www.curseforge.com/ark-survival-ascended/search?class=mods&search=123%20456'
        );
    });

    it('MOD詳細の解決状態を判定する', function() {
        expect(isResolvedCurseForgeModDetail({
            id: '123',
            name: 'Example Mod',
            url: 'https://www.curseforge.com/ark-survival-ascended/mods/example',
            resolved: true
        })).toBe(true);
        expect(isResolvedCurseForgeModDetail({
            id: '123',
            name: '',
            url: 'https://example.com',
            resolved: false
        })).toBe(false);
    });
});

describe('ARK display helpers', function() {
    it('状態表示に直感的な絵文字を付ける', function() {
        expect(formatStateLabel('online')).toBe('🟢 オンライン');
        expect(formatStateLabel('offline')).toBe('🔴 オフライン');
        expect(formatStateLabel('restarting')).toBe('🔄 再起動中');
        expect(formatStateLabel('unknown')).toBe('不明');
    });

    it('バックアップ通知の主要項目を整形する', function() {
        expect(buildArkBackupNotificationMessage({
            reason: 'manual',
            createdAt: '2026-07-09T05:00:00.000Z',
            serverName: 'Bump_ARK',
            map: 'Astraeos',
            totalBytes: 1536,
            fileCount: 2
        })).toContain('💾 ARKバックアップを作成しました。');

        expect(buildArkBackupFailureNotificationMessage('manual', new Error('FTP error'))).toContain('内容：FTP error');

        expect(buildArkRestoreNotificationMessage({
            actorId: '100',
            backup: {
                createdAt: '2026-07-09T05:00:00.000Z',
                serverName: 'Bump_ARK',
                map: 'Astraeos'
            },
            restoredFileCount: 2,
            restoredBytes: 1024,
            deletedFileCount: 1,
            deletedBytes: 512,
            reboot: {
                status: 'restarted'
            }
        })).toContain('復元内容を反映する為、サーバーを再起動します。');
    });

    it('バックアップ実行中エラーを判定する', function() {
        const runningError = new Error('ARK backup is already running.');
        runningError.code = 'ARK_BACKUP_RUNNING';

        expect(isArkBackupAlreadyRunningError(runningError)).toBe(true);
        expect(isArkBackupAlreadyRunningError(new Error('Other error'))).toBe(false);
    });
});
