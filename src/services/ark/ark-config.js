export const DEFAULT_ARK_CONFIG = {
    statusPollMs: 15 * 1000,
    configHistoryPollMs: 5 * 60 * 1000,
    backupPollMs: 10 * 60 * 1000,
    backupIntervalHours: 24 * 7,
    backupRetentionCount: 5
};

const MIN_STATUS_POLL_MS = 1000;
const MIN_CONFIG_HISTORY_POLL_MS = 10 * 1000;
const MIN_BACKUP_POLL_MS = 60 * 1000;

export function getArkConfig() {
    return {
        statusPollMs: getEnvNumber('ARK_STATUS_POLL_MS', DEFAULT_ARK_CONFIG.statusPollMs, MIN_STATUS_POLL_MS),
        configHistoryPollMs: getEnvNumber('ARK_CONFIG_HISTORY_POLL_MS', DEFAULT_ARK_CONFIG.configHistoryPollMs, MIN_CONFIG_HISTORY_POLL_MS),
        backupPollMs: getEnvNumber('ARK_BACKUP_POLL_MS', DEFAULT_ARK_CONFIG.backupPollMs, MIN_BACKUP_POLL_MS),
        backupIntervalHours: getEnvNumber('ARK_BACKUP_INTERVAL_HOURS', DEFAULT_ARK_CONFIG.backupIntervalHours, 1),
        backupRetentionCount: getEnvNumber('ARK_BACKUP_RETENTION_COUNT', DEFAULT_ARK_CONFIG.backupRetentionCount, 1),
        backupDirectory: getEnv('ARK_BACKUP_DIR', 'data/ark-backups'),
        notifyChannelId: getEnv('ARK_NOTIFY_CHANNEL_ID', ''),
        nitradoToken: getEnv('NITRADO_TOKEN', ''),
        nitradoServiceId: getEnv('NITRADO_SERVICE_ID', ''),
        curseForgeApiKey: getEnv('CURSEFORGE_API_KEY', ''),
        serverName: getEnv('ARK_SERVER_NAME', ''),
        mapOptions: getMapOptions()
    };
}

function getEnv(name, fallback) {
    return String(process.env[name] || '').trim() || fallback;
}

function getEnvNumber(name, fallback, minimum = 0) {
    const value = Number(process.env[name]);

    return Number.isFinite(value) && value >= minimum ? value : fallback;
}

function getMapOptions() {
    const configured = getEnv('ARK_MAP_OPTIONS', '');

    if (configured) {
        return configured.split(',')
            .map(parseMapOption)
            .filter(function(option) {
                return option.value && option.label;
            });
    }

    return [
        { value: 'TheIsland', label: 'The Island' },
        { value: 'ScorchedEarth', label: 'Scorched Earth' },
        { value: 'TheCenter', label: 'The Center' },
        { value: 'Aberration', label: 'Aberration' },
        { value: 'Extinction', label: 'Extinction' },
        { value: 'Ragnarok', label: 'Ragnarok' },
        { value: 'AstraeosDLC', label: 'Astraeos' },
        { value: 'Valguero', label: 'Valguero' },
        { value: 'LostColony', label: 'Lost Colony' },
        { value: 'Genesis', label: 'Genesis 1' }
    ];
}

function parseMapOption(value) {
    const [mapValue, label] = String(value || '').split(':', 2).map(function(part) {
        return part.trim();
    });

    return {
        value: mapValue || '',
        label: label || mapValue || ''
    };
}
