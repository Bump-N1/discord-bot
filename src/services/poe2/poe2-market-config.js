const DEFAULT_MONITOR_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_LOOKBACK_HOURS = 24;
const DEFAULT_PROVIDER = 'auto';
const DEFAULT_LEAGUE = 'Standard';
const ALLOWED_PROVIDERS = new Set(['poe-ninja', 'official', 'auto']);

export function getPoe2MarketConfig() {
    return {
        provider: readText('POE2_MARKET_PROVIDER') || DEFAULT_PROVIDER,
        accessToken: readText('POE2_ACCESS_TOKEN'),
        clientId: readText('POE2_CLIENT_ID'),
        clientSecret: readText('POE2_CLIENT_SECRET'),
        league: readText('POE2_LEAGUE') || DEFAULT_LEAGUE,
        userAgent: readText('POE2_USER_AGENT'),
        monitorIntervalMs: readPositiveNumber('POE2_MARKET_MONITOR_INTERVAL_MS', DEFAULT_MONITOR_INTERVAL_MS),
        lookbackHours: readPositiveNumber('POE2_MARKET_LOOKBACK_HOURS', DEFAULT_LOOKBACK_HOURS)
    };
}

export function validatePoe2MarketConfig(config) {
    if (!ALLOWED_PROVIDERS.has(config.provider)) {
        throw new Error('POE2_MARKET_PROVIDER must be poe-ninja, official or auto.');
    }

    if (!config.league) {
        throw new Error('POE2_LEAGUE is not set.');
    }

    if (!config.userAgent) {
        throw new Error('POE2_USER_AGENT is not set.');
    }

    if (requiresOfficialCredentials(config) && !hasOfficialCredentials(config)) {
        throw new Error('POE2_ACCESS_TOKEN or POE2_CLIENT_ID/POE2_CLIENT_SECRET is not set.');
    }
}

export function shouldUseOfficialMarketApi(config) {
    return config.provider === 'official'
        || (config.provider === 'auto' && hasOfficialCredentials(config));
}

function requiresOfficialCredentials(config) {
    return config.provider === 'official';
}

function hasOfficialCredentials(config) {
    return Boolean(config.accessToken || (config.clientId && config.clientSecret));
}

function readText(name) {
    return String(process.env[name] || '').trim();
}

function readPositiveNumber(name, fallback) {
    const value = Number(process.env[name]);

    return Number.isFinite(value) && value > 0 ? value : fallback;
}
