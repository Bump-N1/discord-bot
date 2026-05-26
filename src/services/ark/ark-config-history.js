import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getArkConfig } from './ark-config.js';
import { fetchNitradoRestartSchedule, fetchNitradoSettings } from './nitrado-client.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const HISTORY_PATH = path.join(DATA_DIR, 'ark-config-history.json');
const MAX_HISTORY_ENTRIES = 20;
const SETTING_LABELS = {
    experience: '経験値',
    taming: 'テイム',
    harvesting: '採取',
    hatching: '孵化',
    maturation: '成熟',
    weight: '重量',
    autosave: '自動保存',
    restartTime: '自動再起動'
};
const REQUIRED_SETTING_KEYS = Object.keys(SETTING_LABELS).filter(function(key) {
    return key !== 'restartTime';
});

let monitorStarted = false;
let refreshQueue = Promise.resolve();

export function startArkConfigHistoryMonitor() {
    if (monitorStarted) {
        return;
    }

    const config = getArkConfig();

    if (!config.nitradoToken || !config.nitradoServiceId) {
        console.log('ARK config history monitor skipped: Nitrado credentials are not set.');
        return;
    }

    monitorStarted = true;
    refreshArkConfigHistory().catch(logHistoryError);
    setInterval(function() {
        refreshArkConfigHistory().catch(logHistoryError);
    }, config.configHistoryPollMs);
}

export async function refreshArkConfigHistory() {
    const pendingRefresh = refreshQueue.then(refreshHistory);
    refreshQueue = pendingRefresh.catch(function() {
        return null;
    });

    return await pendingRefresh;
}

async function refreshHistory() {
    const snapshot = await createSnapshot();
    const history = await readHistory();

    if (!history.lastSnapshot) {
        history.lastSnapshot = snapshot;
        await writeHistory(history);

        return history;
    }

    const changes = buildChanges(history.lastSnapshot.values, snapshot.values);

    if (changes.length === 0) {
        return history;
    }

    history.lastSnapshot = snapshot;
    history.entries = [{
        createdAt: snapshot.capturedAt,
        changes: changes
    }, ...history.entries].slice(0, MAX_HISTORY_ENTRIES);
    await writeHistory(history);

    return history;
}

async function createSnapshot() {
    const config = getArkConfig();
    const [nitradoSettings, restartTime] = await Promise.all([
        fetchNitradoSettings(config),
        fetchNitradoRestartSchedule(config)
    ]);
    assertSettings(nitradoSettings.settings);

    return {
        capturedAt: new Date().toISOString(),
        values: {
            ...nitradoSettings.settings,
            restartTime: restartTime ? `毎日 ${restartTime} 頃` : '設定なし'
        }
    };
}

function assertSettings(settings) {
    const missing = REQUIRED_SETTING_KEYS.filter(function(key) {
        return !String(settings?.[key] || '').trim();
    });

    if (missing.length > 0) {
        throw new Error('Nitradoから差分記録に必要なARK設定を取得できませんでした。');
    }
}

function buildChanges(previousValues, currentValues) {
    return Object.keys(SETTING_LABELS).flatMap(function(key) {
        const before = String(previousValues?.[key] || '').trim() || '未取得';
        const after = String(currentValues?.[key] || '').trim() || '未取得';

        if (before === after) {
            return [];
        }

        return [{
            label: SETTING_LABELS[key],
            before: before,
            after: after
        }];
    });
}

async function readHistory() {
    try {
        const data = JSON.parse(await readFile(HISTORY_PATH, 'utf8'));

        return {
            lastSnapshot: data?.lastSnapshot || null,
            entries: Array.isArray(data?.entries) ? data.entries : []
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                lastSnapshot: null,
                entries: []
            };
        }

        throw error;
    }
}

async function writeHistory(history) {
    await mkdir(DATA_DIR, {
        recursive: true
    });
    await writeFile(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

function logHistoryError(error) {
    console.error('ARK config history monitor failed:', error);
}
