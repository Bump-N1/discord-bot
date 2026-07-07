import { getArkConfig } from './ark-config.js';
import { refreshArkConfigHistory } from './ark-config-history.js';
import {
    fetchNitradoJoinInfo,
    fetchNitradoRestartSchedule,
    fetchNitradoServerStatus,
    fetchNitradoSettings
} from './nitrado-client.js';

export async function getArkStatus() {
    const status = await fetchNitradoServerStatus(getArkConfig());

    assertFields(status, ['serverName', 'map', 'state', 'address'], '状態');

    return status;
}

export async function getArkAvailability() {
    const status = await fetchNitradoServerStatus(getArkConfig());

    assertFields(status, ['state'], '稼働状態');

    return status.state;
}

export async function getArkJoinInfo() {
    const info = await fetchNitradoJoinInfo(getArkConfig());

    assertFields(info, ['serverName', 'map', 'password'], '参加情報');

    return info;
}

export async function getArkSettings() {
    const config = getArkConfig();
    const [nitradoSettings, restartTime, history] = await Promise.all([
        fetchNitradoSettings(config),
        fetchNitradoRestartSchedule(config),
        refreshArkConfigHistory()
    ]);

    assertFields(nitradoSettings.settings, [
        'experience',
        'taming',
        'harvesting',
        'hatching',
        'maturation',
        'weight',
        'autosave'
    ], '設定');

    return {
        restartTime: restartTime,
        settings: nitradoSettings.settings,
        differences: history.entries,
        source: 'nitrado'
    };
}

export function formatStateLabel(state) {
    if (state === 'online') {
        return '🟢 オンライン';
    }

    if (state === 'offline') {
        return '🔴 オフライン';
    }

    if (state === 'restarting') {
        return '🔄 再起動中';
    }

    return '不明';
}

function assertFields(values, fields, label) {
    const missing = fields.filter(function(field) {
        const value = values?.[field];

        return value === undefined || value === null || String(value).trim() === '';
    });

    if (missing.length > 0) {
        throw new Error(`NitradoからARKサーバーの${label}を取得できませんでした。`);
    }
}
