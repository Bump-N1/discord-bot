export const DEFAULT_ARK_CONFIG = {
    statusPollMs: 15 * 1000,
    configHistoryPollMs: 5 * 60 * 1000
};

export function getArkConfig() {
    return {
        statusPollMs: getEnvNumber('ARK_STATUS_POLL_MS', DEFAULT_ARK_CONFIG.statusPollMs),
        configHistoryPollMs: getEnvNumber('ARK_CONFIG_HISTORY_POLL_MS', DEFAULT_ARK_CONFIG.configHistoryPollMs),
        notifyChannelId: getEnv('ARK_NOTIFY_CHANNEL_ID', ''),
        nitradoToken: getEnv('NITRADO_TOKEN', ''),
        nitradoServiceId: getEnv('NITRADO_SERVICE_ID', ''),
        serverName: getEnv('ARK_SERVER_NAME', ''),
        mapOptions: getMapOptions()
    };
}

function getEnv(name, fallback) {
    return String(process.env[name] || '').trim() || fallback;
}

function getEnvNumber(name, fallback) {
    const value = Number(process.env[name]);

    return Number.isFinite(value) && value > 0 ? value : fallback;
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
        { value: 'TheIsland_WP', label: 'The Island' },
        { value: 'ScorchedEarth_WP', label: 'Scorched Earth' },
        { value: 'TheCenter_WP', label: 'The Center' },
        { value: 'Aberration_WP', label: 'Aberration' },
        { value: 'Extinction_WP', label: 'Extinction' },
        { value: 'Ragnarok_WP', label: 'Ragnarok' },
        { value: 'Astraeos_WP', label: 'Astraeos' },
        { value: 'Valguero_WP', label: 'Valguero' },
        { value: 'LostColony_WP', label: 'Lost Colony' },
        { value: 'Genesis_WP', label: 'Genesis 1' }
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
