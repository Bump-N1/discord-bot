import net from 'node:net';

const NITRADO_API_BASE_URL = 'https://api.nitrado.net';
const CONFIG_DIRECTORY_PATTERN = /\/Config\/WindowsServer\/?$/iu;
const GAME_INI_FILE = 'Game.ini';
const GAME_USER_SETTINGS_FILE = 'GameUserSettings.ini';
const SERVER_PROBE_TIMEOUT_MS = 4000;
const MAP_LABELS = {
    TheIsland_WP: 'The Island',
    ScorchedEarth_WP: 'Scorched Earth',
    TheCenter_WP: 'The Center',
    Aberration_WP: 'Aberration',
    Extinction_WP: 'Extinction',
    Ragnarok_WP: 'Ragnarok',
    AstraeosDLC: 'Astraeos',
    Valguero_WP: 'Valguero',
    LostColonyDLC: 'Lost Colony',
    GenesisDLC: 'Genesis 1',
    Astraeos: 'Astraeos (Mod map)'
};

export async function fetchNitradoGameServer(config) {
    if (!config.nitradoToken || !config.nitradoServiceId) {
        throw new Error('Nitrado連携が設定されていません。');
    }

    const data = await fetchNitradoJson(config, '/gameservers');

    return data?.data?.gameserver || data?.data || {};
}

export async function fetchNitradoServerStatus(config) {
    const gameServer = await fetchNitradoGameServer(config);
    const state = await probeArkServer(gameServer);

    return normalizeNitradoStatus(gameServer, state);
}

export async function fetchNitradoJoinInfo(config) {
    const gameServer = await fetchNitradoGameServer(config);
    const files = await fetchNitradoConfigFiles(config, [GAME_USER_SETTINGS_FILE]);
    const gameUserSettings = parseIni(files[GAME_USER_SETTINGS_FILE]);

    return normalizeNitradoJoinInfo(gameServer, gameUserSettings);
}

export async function fetchNitradoSettings(config) {
    assertNitradoConfig(config);
    const files = await fetchNitradoConfigFiles(config, [GAME_INI_FILE, GAME_USER_SETTINGS_FILE]);

    return normalizeNitradoFileSettings(
        parseIni(files[GAME_USER_SETTINGS_FILE]),
        parseIni(files[GAME_INI_FILE])
    );
}

export async function fetchNitradoRestartSchedule(config) {
    assertNitradoConfig(config);
    const data = await fetchNitradoJson(config, '/tasks');
    const task = (data?.data?.tasks || []).find(function(item) {
        return item.action_method === 'game_server_restart';
    });

    if (!task) {
        return '';
    }

    const hour = Number(task.hour);
    const minute = Number(task.minute);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
        return '';
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export async function fetchNitradoServerConfig(config) {
    const gameServer = await fetchNitradoGameServer(config);

    return normalizeNitradoServerConfig(gameServer);
}

export async function updateNitradoServerConfig(config, settings) {
    assertNitradoConfig(config);

    if (Object.prototype.hasOwnProperty.call(settings, 'map')) {
        await updateNitradoSetting(config, 'config', 'map', settings.map);
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'activeMods')) {
        await updateNitradoSetting(config, 'config', 'active-mods', settings.activeMods.join(','));
    }
}

export async function restartNitradoServer(config) {
    assertNitradoConfig(config);
    await postNitradoJson(config, '/gameservers/restart', null);
}

async function updateNitradoSetting(config, category, key, value) {
    await postNitradoJson(config, '/gameservers/settings', {
        category: category,
        key: key,
        value: String(value ?? '')
    });
}

function normalizeNitradoServerConfig(gameServer) {
    const map = getFirstValue(gameServer, [
        'settings.config.map',
        'query.map',
        'map',
        'game_specific.map'
    ]);
    const activeMods = getFirstValue(gameServer, [
        'settings.config.active-mods',
        'settings.config.ActiveMods',
        'game_specific.active-mods'
    ]);
    const playerCount = getFirstNumber(gameServer, [
        'query.player_current',
        'query.players',
        'players',
        'player_current',
        'online_players',
        'game_specific.online_players'
    ]);
    const maxPlayers = getFirstNumber(gameServer, [
        'query.player_max',
        'query.maxplayers',
        'slots',
        'max_players',
        'game_specific.max_players'
    ]);

    return {
        serverName: normalizeServerName(getFirstValue(gameServer, [
            'query.server_name',
            'settings.config.hostname',
            'settings.config.server-name',
            'settings.config.server_name',
            'query.name',
            'name'
        ])),
        map: map,
        mapLabel: normalizeMapName(map),
        activeMods: parseModIds(activeMods),
        playerCount: Number.isFinite(playerCount) ? playerCount : null,
        maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null
    };
}

function normalizeNitradoStatus(gameServer, state) {
    const playerCount = getFirstNumber(gameServer, [
        'query.player_current',
        'query.players',
        'players',
        'player_current',
        'online_players',
        'game_specific.online_players'
    ]);
    const maxPlayers = getFirstNumber(gameServer, [
        'query.player_max',
        'query.maxplayers',
        'slots',
        'max_players',
        'game_specific.max_players'
    ]);
    const map = normalizeMapName(getFirstValue(gameServer, [
        'query.map',
        'map',
        'game_specific.map',
        'settings.config.map'
    ]));
    const ip = getFirstValue(gameServer, [
        'ip',
        'hostsystems.linux.ip',
        'query.ip'
    ]);
    const port = getFirstNumber(gameServer, [
        'port',
        'query.port',
        'game_specific.port'
    ]);
    const address = ip && port ? `${ip}:${port}` : getFirstValue(gameServer, [
        'address',
        'connect_address',
        'query.address'
    ]);

    return {
        serverName: normalizeServerName(getFirstValue(gameServer, [
            'query.server_name',
            'settings.config.hostname',
            'settings.config.server-name',
            'settings.config.server_name',
            'query.name',
            'name'
        ])),
        map: map,
        playerCount: Number.isFinite(playerCount) ? playerCount : null,
        maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
        state: state,
        address: address,
        source: 'nitrado'
    };
}

async function probeArkServer(gameServer) {
    const host = getFirstValue(gameServer, [
        'ip',
        'hostsystems.linux.ip',
        'query.ip'
    ]);
    const port = getFirstNumber(gameServer, [
        'rcon_port'
    ]);

    if (!host || !Number.isFinite(port)) {
        throw new Error('NitradoからARKサーバーの稼働確認先を取得できませんでした。');
    }

    return await canConnect(host, port) ? 'online' : 'offline';
}

async function canConnect(host, port) {
    return await new Promise(function(resolve) {
        const socket = net.createConnection({
            host: host,
            port: port
        });
        let finished = false;

        function finish(value) {
            if (finished) {
                return;
            }

            finished = true;
            socket.destroy();
            resolve(value);
        }

        socket.setTimeout(SERVER_PROBE_TIMEOUT_MS);
        socket.once('connect', function() {
            finish(true);
        });
        socket.once('timeout', function() {
            finish(false);
        });
        socket.once('error', function() {
            finish(false);
        });
    });
}

function normalizeNitradoJoinInfo(gameServer, gameUserSettings) {
    return {
        serverName: normalizeServerName(firstText(getIniValue(gameUserSettings, 'SessionName'), getFirstValue(gameServer, [
            'query.server_name',
            'settings.config.server-name',
            'settings.config.hostname',
            'name'
        ]))),
        map: normalizeMapName(getFirstValue(gameServer, [
            'query.map',
            'settings.config.map',
            'map'
        ])),
        password: firstText(getIniValue(gameUserSettings, 'ServerPassword'), getFirstValue(gameServer, [
            'settings.config.server-password',
            'settings.config.password'
        ])),
        address: getServerAddress(gameServer),
        source: 'nitrado'
    };
}

function normalizeNitradoFileSettings(gameUserSettings, gameIni) {
    return {
        settings: {
            experience: formatMultiplier(getIniValue(gameUserSettings, 'XPMultiplier')),
            taming: formatMultiplier(getIniValue(gameUserSettings, 'TamingSpeedMultiplier')),
            harvesting: formatMultiplier(getIniValue(gameUserSettings, 'HarvestAmountMultiplier')),
            hatching: formatMultiplier(getIniValue(gameIni, 'EggHatchSpeedMultiplier')),
            maturation: formatMultiplier(getIniValue(gameIni, 'BabyMatureSpeedMultiplier')),
            weight: formatMultiplier(getIniValue(gameIni, 'PerLevelStatsMultiplier_Player[7]')),
            autosave: formatMinutes(getIniValue(gameUserSettings, 'AutoSavePeriodMinutes'))
        },
        source: 'nitrado-file'
    };
}

async function fetchNitradoConfigFiles(config, fileNames) {
    const data = await fetchNitradoJson(config, '/gameservers/file_server/bookmarks');
    const configDirectory = (data?.data?.bookmarks || []).find(function(directory) {
        return CONFIG_DIRECTORY_PATTERN.test(String(directory));
    });

    if (!configDirectory) {
        throw new Error('Nitrado config directory was not found.');
    }

    const files = await Promise.all(fileNames.map(async function(fileName) {
        const filePath = `${configDirectory.replace(/\/$/u, '')}/${fileName}`;
        const content = await downloadNitradoFile(config, filePath);

        return [fileName, content];
    }));

    return Object.fromEntries(files);
}

async function downloadNitradoFile(config, filePath) {
    const data = await fetchNitradoJson(config, '/gameservers/file_server/download', {
        file: filePath
    });
    const token = data?.data?.token;

    if (!token?.url || !token?.token) {
        throw new Error('Nitrado file download token was not returned.');
    }

    const downloadUrl = new URL(token.url);
    downloadUrl.searchParams.set('token', token.token);
    const response = await fetch(downloadUrl);

    if (!response.ok) {
        throw new Error(`Nitrado file download error: ${response.status}`);
    }

    return await response.text();
}

async function fetchNitradoJson(config, path, query = {}) {
    const url = new URL(`${NITRADO_API_BASE_URL}/services/${config.nitradoServiceId}${path}`);

    Object.entries(query).forEach(function([name, value]) {
        url.searchParams.set(name, value);
    });

    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${config.nitradoToken}`,
            'User-Agent': 'discord-bot/1.0'
        }
    });

    if (!response.ok) {
        throw new Error(`Nitrado API error: ${response.status}`);
    }

    return await response.json();
}

async function postNitradoJson(config, path, body) {
    const url = new URL(`${NITRADO_API_BASE_URL}/services/${config.nitradoServiceId}${path}`);
    const attempts = body === null
        ? [{
            headers: {},
            body: undefined
        }]
        : [{
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams(body).toString()
        }];
    let lastError = '';

    for (const attempt of attempts) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${config.nitradoToken}`,
                'User-Agent': 'discord-bot/1.0',
                ...attempt.headers
            },
            body: attempt.body
        });
        const responseText = await response.text();

        if (response.ok) {
            if (!responseText) {
                return {};
            }

            try {
                return JSON.parse(responseText);
            } catch (error) {
                return {};
            }
        }

        lastError = `Nitrado API error: ${response.status} ${responseText}`;

        if (![400, 415, 422].includes(response.status)) {
            break;
        }
    }

    throw new Error(lastError || 'Nitrado API error');
}

function parseIni(content) {
    const values = {};

    String(content || '').split(/\r?\n/u).forEach(function(rawLine) {
        const line = rawLine.trim();

        if (!line || line.startsWith(';') || line.startsWith('#') || line.startsWith('[')) {
            return;
        }

        const separatorIndex = line.indexOf('=');

        if (separatorIndex < 1) {
            return;
        }

        const key = line.slice(0, separatorIndex).trim().toLowerCase();

        if (!(key in values)) {
            values[key] = line.slice(separatorIndex + 1).trim();
        }
    });

    return values;
}

function getIniValue(values, key) {
    return values?.[key.toLowerCase()] || '';
}

function parseModIds(value) {
    return String(value || '')
        .split(',')
        .map(function(modId) {
            return modId.trim();
        })
        .filter(function(modId) {
            return /^\d+$/u.test(modId);
        });
}

function getServerAddress(gameServer) {
    const ip = getFirstValue(gameServer, [
        'ip',
        'hostsystems.linux.ip',
        'query.ip'
    ]);
    const port = getFirstNumber(gameServer, [
        'port',
        'query.port',
        'game_specific.port'
    ]);

    return ip && port ? `${ip}:${port}` : getFirstValue(gameServer, [
        'address',
        'connect_address',
        'query.address',
        'query.connect_ip'
    ]);
}

function normalizeMapName(value) {
    const mapValue = String(value || '').trim();

    return MAP_LABELS[mapValue] || mapValue.replace(/_WP$/u, '').trim();
}

function normalizeServerName(value) {
    return String(value || '').replace(/\s+-\s+\(v[\d.]+\)$/u, '').trim();
}

function formatMultiplier(value) {
    const text = String(value || '').trim();
    const number = Number(text);

    if (!text) {
        return '';
    }

    if (Number.isFinite(number)) {
        return `${formatNumber(number)}倍`;
    }

    return text;
}

function formatMinutes(value) {
    const text = String(value || '').trim();
    const number = Number(text);

    if (!text) {
        return '';
    }

    if (Number.isFinite(number)) {
        return `${formatNumber(number)}分`;
    }

    return text;
}

function formatNumber(value) {
    if (Number.isInteger(value)) {
        return String(value);
    }

    return String(value).replace(/0+$/u, '').replace(/\.$/u, '');
}

function getFirstValue(source, paths) {
    for (const path of paths) {
        const value = getPathValue(source, path);

        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }

    return '';
}

function getFirstNumber(source, paths) {
    for (const path of paths) {
        const value = Number(getPathValue(source, path));

        if (Number.isFinite(value)) {
            return value;
        }
    }

    return null;
}

function getPathValue(source, path) {
    return path.split('.').reduce(function(value, key) {
        if (value === undefined || value === null) {
            return undefined;
        }

        return value[key];
    }, source);
}

function firstText(...values) {
    for (const value of values) {
        const text = String(value || '').trim();

        if (text) {
            return text;
        }
    }

    return '';
}

function assertNitradoConfig(config) {
    if (!config.nitradoToken || !config.nitradoServiceId) {
        throw new Error('Nitrado連携が設定されていません。');
    }
}
