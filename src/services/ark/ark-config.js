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
        nitradoServiceId: getEnv('NITRADO_SERVICE_ID', '')
    };
}

function getEnv(name, fallback) {
    return String(process.env[name] || '').trim() || fallback;
}

function getEnvNumber(name, fallback) {
    const value = Number(process.env[name]);

    return Number.isFinite(value) && value > 0 ? value : fallback;
}
