import { getArkConfig } from './ark-config.js';
import { addArkEditHistory, getArkEditHistory } from './ark-edit-store.js';
import {
    fetchNitradoServerConfig,
    restartNitradoServer,
    startNitradoServer,
    updateNitradoServerConfig
} from './nitrado-client.js';
import {
    fetchCurseForgeModDetails,
    getCurseForgeArkModsUrl
} from './curseforge-client.js';

export async function getArkEditSession() {
    const config = getArkConfig();
    const [serverConfig, history] = await Promise.all([
        fetchNitradoServerConfig(config),
        getArkEditHistory()
    ]);
    const mapOptions = buildMapOptions(config.mapOptions, serverConfig);
    const modDetails = await fetchCurseForgeModDetails(config, serverConfig.activeMods);

    return {
        server: {
            name: serverConfig.serverName,
            map: serverConfig.map,
            mapLabel: getMapLabel(mapOptions, serverConfig.map),
            activeMods: serverConfig.activeMods,
            modDetails: modDetails,
            playerCount: serverConfig.playerCount,
            maxPlayers: serverConfig.maxPlayers
        },
        mapOptions: mapOptions,
        curseForgeModsUrl: getCurseForgeArkModsUrl(),
        history: history
    };
}

export async function applyArkEdit(options) {
    const config = getArkConfig();
    const current = await fetchNitradoServerConfig(config);
    const mapOptions = buildMapOptions(config.mapOptions, current);
    const nextMap = normalizeMap(options.map);
    const nextMods = normalizeModIds(options.activeMods);
    const mapChanged = nextMap !== current.map;
    const modsChanged = !areSameList(current.activeMods, nextMods);

    if (!mapOptions.some(function(option) {
        return option.value === nextMap;
    })) {
        throw new Error('選択されたMAPを利用できません。画面を更新してから再度実行してください。');
    }

    if (!mapChanged && !modsChanged) {
        return {
            changed: false,
            message: '変更内容がありません。'
        };
    }

    const updates = {};

    if (mapChanged) {
        updates.map = nextMap;
    }

    if (modsChanged) {
        updates.activeMods = nextMods;
    }

    await updateNitradoServerConfig(config, updates);

    const reboot = await rebootIfEmpty(config, current);
    const result = {
        changed: true,
        actorId: options.actorId,
        actorName: options.actorName,
        before: {
            map: current.map,
            mapLabel: getMapLabel(mapOptions, current.map),
            activeMods: current.activeMods
        },
        after: {
            map: nextMap,
            mapLabel: getMapLabel(mapOptions, nextMap),
            activeMods: nextMods
        },
        diff: {
            mapChanged: mapChanged,
            addedMods: difference(nextMods, current.activeMods),
            removedMods: difference(current.activeMods, nextMods)
        },
        playerCount: current.playerCount,
        reboot: reboot
    };

    await addArkEditHistory({
        actorId: options.actorId,
        actorName: options.actorName,
        before: result.before,
        after: result.after,
        diff: result.diff,
        playerCount: current.playerCount,
        reboot: reboot
    });

    return result;
}

export async function requestArkReboot(options) {
    const config = getArkConfig();
    const current = await fetchNitradoServerConfig(config);
    const reboot = await rebootIfEmpty(config, current);

    return {
        actorId: options.actorId,
        actorName: options.actorName,
        playerCount: current.playerCount,
        reboot: reboot
    };
}

export function buildArkEditNotificationMessages(result) {
    const lines = [
        `${formatActor(result.actorId, result.actorName)}がサーバー設定を変更しました。`,
        '今回の変更点は以下です。'
    ];

    if (result.diff.mapChanged) {
        lines.push(`MAP：${result.before.mapLabel}→${result.after.mapLabel}`);
    }

    if (result.diff.addedMods.length > 0) {
        lines.push(`MOD追加：${result.diff.addedMods.join(', ')}`);
    }

    if (result.diff.removedMods.length > 0) {
        lines.push(`MOD削除：${result.diff.removedMods.join(', ')}`);
    }

    return [
        lines.join('\n'),
        buildConfigRebootNotice(result.reboot)
    ];
}

export function buildArkRebootNotificationMessage(result) {
    return [
        `${formatActor(result.actorId, result.actorName)}がサーバーの再起動を実行しました。`,
        buildManualRebootNotice(result.reboot)
    ].join('\n');
}

function buildMapOptions(options, current) {
    const known = Array.isArray(options) ? options : [];
    const map = new Map();

    for (const option of known) {
        if (option?.value && option?.label) {
            map.set(option.value, {
                value: option.value,
                label: option.label
            });
        }
    }

    if (current.map && !map.has(current.map)) {
        map.set(current.map, {
            value: current.map,
            label: current.mapLabel || current.map
        });
    }

    return Array.from(map.values());
}

function getMapLabel(options, value) {
    const option = options.find(function(candidate) {
        return candidate.value === value;
    });

    return option?.label || value || '未取得';
}

function normalizeMap(value) {
    return String(value || '').trim();
}

export function normalizeModIds(value) {
    const values = Array.isArray(value)
        ? value
        : String(value || '').split(/[,\s]+/u);

    return Array.from(new Set(values.map(function(modId) {
        return String(modId || '').trim();
    }).filter(function(modId) {
        return /^\d+$/u.test(modId);
    })));
}

function areSameList(left, right) {
    return left.length === right.length && left.every(function(value, index) {
        return value === right[index];
    });
}

function difference(left, right) {
    const rightSet = new Set(right);

    return left.filter(function(value) {
        return !rightSet.has(value);
    });
}

async function rebootIfEmpty(config, current) {
    const playerCount = current.playerCount;

    if (isStoppedServer(current.status)) {
        try {
            await startNitradoServer(config);

            return {
                status: 'started'
            };
        } catch (error) {
            return {
                status: 'failed',
                message: error.message
            };
        }
    }

    if (playerCount !== 0) {
        return {
            status: playerCount === null ? 'skipped_unknown_players' : 'skipped_players'
        };
    }

    try {
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

function isStoppedServer(status) {
    return ['stopped'].includes(String(status || '').toLowerCase());
}

function formatActor(actorId, actorName) {
    return actorId ? `<@${actorId}>` : `@${actorName || 'ユーザー'}`;
}

function buildConfigRebootNotice(reboot) {
    if (reboot.status === 'restarted') {
        return '設定を反映する為、サーバーを再起動します。';
    }

    if (reboot.status === 'started') {
        return 'サーバーが停止中だった為、設定を反映する為に起動します。';
    }

    if (reboot.status === 'skipped_players') {
        return [
            'サーバー内にプレイヤーが存在する為、再起動は行われません。',
            '後ほど手動で再起動を行ってください。'
        ].join('\n');
    }

    if (reboot.status === 'skipped_unknown_players') {
        return [
            'サーバー内のプレイヤー数を確認できない為、再起動は行われません。',
            '後ほど手動で再起動を行ってください。'
        ].join('\n');
    }

    return [
        '設定変更は保存されましたが、サーバーの再起動に失敗しました。',
        '後ほど手動で再起動を行ってください。'
    ].join('\n');
}

function buildManualRebootNotice(reboot) {
    if (reboot.status === 'restarted') {
        return 'サーバーを再起動します。';
    }

    if (reboot.status === 'started') {
        return 'サーバーが停止中だった為、起動します。';
    }

    if (reboot.status === 'skipped_players') {
        return 'サーバー内にプレイヤーが存在する為、再起動は行われません。';
    }

    if (reboot.status === 'skipped_unknown_players') {
        return 'サーバー内のプレイヤー数を確認できない為、再起動は行われません。';
    }

    return 'サーバーの再起動に失敗しました。Nitradoの状態を確認してください。';
}
