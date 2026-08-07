const DEFAULT_MONITOR_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_LOOKBACK_HOURS = 24;
const DEFAULT_LEAGUE = 'auto';
const DEFAULT_REALM = 'poe2';
const ALLOWED_REALMS = new Set(['poe2', 'xbox', 'sony']);

export function getPoe2MarketConfig() {
    return {
        league: readText('POE2_LEAGUE') || DEFAULT_LEAGUE,
        realm: readText('POE2_REALM') || DEFAULT_REALM,
        userAgent: readText('POE2_USER_AGENT'),
        monitorIntervalMs: readPositiveNumber('POE2_MARKET_MONITOR_INTERVAL_MS', DEFAULT_MONITOR_INTERVAL_MS),
        lookbackHours: readPositiveNumber('POE2_MARKET_LOOKBACK_HOURS', DEFAULT_LOOKBACK_HOURS),
        alertPercent: readNonNegativeNumber('POE2_MARKET_ALERT_PERCENT', 10)
    };
}

export function validatePoe2MarketConfig(config) {
    if (!ALLOWED_REALMS.has(config.realm)) {
        throw new Error('POE2_REALM must be poe2, xbox or sony.');
    }

    if (!config.league) {
        throw new Error('POE2_LEAGUE is not set.');
    }

    if (!config.userAgent) {
        throw new Error('POE2_USER_AGENT is not set.');
    }

}

function readText(name) {
    return String(process.env[name] || '').trim();
}

function readPositiveNumber(name, fallback) {
    const value = Number(process.env[name]);

    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readNonNegativeNumber(name, fallback) {
    const value = Number(process.env[name]);

    return Number.isFinite(value) && value >= 0 ? value : fallback;
}
