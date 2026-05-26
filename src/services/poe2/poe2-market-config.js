const DEFAULT_MONITOR_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_LOOKBACK_HOURS = 24;

export function getPoe2MarketConfig() {
    return {
        accessToken: readText('POE2_ACCESS_TOKEN'),
        clientId: readText('POE2_CLIENT_ID'),
        clientSecret: readText('POE2_CLIENT_SECRET'),
        league: readText('POE2_LEAGUE'),
        userAgent: readText('POE2_USER_AGENT'),
        monitorIntervalMs: readPositiveNumber('POE2_MARKET_MONITOR_INTERVAL_MS', DEFAULT_MONITOR_INTERVAL_MS),
        lookbackHours: readPositiveNumber('POE2_MARKET_LOOKBACK_HOURS', DEFAULT_LOOKBACK_HOURS)
    };
}

export function validatePoe2MarketConfig(config) {
    if (!config.league) {
        throw new Error('POE2_LEAGUE is not set.');
    }

    if (!config.userAgent) {
        throw new Error('POE2_USER_AGENT is not set.');
    }

    if (!config.accessToken && !(config.clientId && config.clientSecret)) {
        throw new Error('POE2_ACCESS_TOKEN or POE2_CLIENT_ID/POE2_CLIENT_SECRET is not set.');
    }
}

function readText(name) {
    return String(process.env[name] || '').trim();
}

function readPositiveNumber(name, fallback) {
    const value = Number(process.env[name]);

    return Number.isFinite(value) && value > 0 ? value : fallback;
}

