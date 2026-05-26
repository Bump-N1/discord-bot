import {
    getPoe2MarketConfig,
    shouldUseOfficialMarketApi,
    validatePoe2MarketConfig
} from './poe2-market-config.js';
import {
    POE2_MARKET_BASE_CURRENCY_ID,
    POE2_MARKET_PRODUCTS
} from './poe2-market-definition.js';

const TOKEN_URL = 'https://www.pathofexile.com/oauth/token';
const API_ROOT = 'https://api.pathofexile.com';
const POE_NINJA_API_ROOT = 'https://poe.ninja/poe2/api/economy/exchange/current/overview';
const HOUR_SECONDS = 60 * 60;
let requestedAccessToken = null;

export async function fetchPoe2MarketSnapshot(now = new Date()) {
    const config = getPoe2MarketConfig();
    validatePoe2MarketConfig(config);

    if (!shouldUseOfficialMarketApi(config)) {
        return await fetchPoeNinjaMarketSnapshot(config, now);
    }

    return await fetchOfficialMarketSnapshot(config, now);
}

async function fetchOfficialMarketSnapshot(config, now) {
    const accessToken = await getAccessToken(config);
    const latestCompletedHour = getLatestCompletedHour(now);
    const quotesByProductId = new Map();
    let availableHour = null;

    for (let index = 0; index < config.lookbackHours; index += 1) {
        const changeId = latestCompletedHour - (index * HOUR_SECONDS);
        const response = await fetchExchangeDigest(config, accessToken, changeId);
        const leagueMarkets = (response.markets || []).filter(function(market) {
            return market.league === config.league;
        });

        if (availableHour === null) {
            if (leagueMarkets.length === 0) {
                continue;
            }

            availableHour = changeId;
        }

        collectQuotes(leagueMarkets, changeId, quotesByProductId);

        if (hasAllQuotes(quotesByProductId)) {
            break;
        }
    }

    if (availableHour === null) {
        throw new Error(`No Currency Exchange history was found for league: ${config.league}.`);
    }

    return {
        source: 'official',
        league: config.league,
        changeId: String(availableHour),
        completedHour: availableHour,
        products: POE2_MARKET_PRODUCTS.map(function(product) {
            if (product.base) {
                return {
                    ...product,
                    lowestPrice: 1,
                    highestPrice: 1,
                    volume: null,
                    quoteChangeId: availableHour
                };
            }

            return {
                ...product,
                ...(quotesByProductId.get(product.id) || {
                    lowestPrice: null,
                    highestPrice: null,
                    volume: null,
                    quoteChangeId: null
                })
            };
        })
    };
}

async function fetchPoeNinjaMarketSnapshot(config, now) {
    const [currencyOverview, gemOverview] = await Promise.all([
        fetchPoeNinjaOverview(config, 'Currency'),
        fetchPoeNinjaOverview(config, 'UncutGems')
    ]);
    const overviews = [currencyOverview, gemOverview];
    const hourlyBucket = getCurrentHour(now);

    return {
        source: 'poe-ninja',
        league: config.league,
        changeId: `poe-ninja:${hourlyBucket}`,
        completedHour: hourlyBucket,
        capturedAt: now.toISOString(),
        products: POE2_MARKET_PRODUCTS.map(function(product) {
            if (product.base) {
                return {
                    ...product,
                    lowestPrice: 1,
                    highestPrice: 1,
                    volume: null,
                    quoteChangeId: hourlyBucket
                };
            }

            const overview = overviews.find(function(candidate) {
                return (candidate.lines || []).some(function(entry) {
                    return entry.id === product.id;
                });
            });
            const line = (overview?.lines || []).find(function(entry) {
                return entry.id === product.id;
            });
            const primaryValue = Number(line?.primaryValue);
            const exaltedPerPrimary = getPoeNinjaExaltedPerPrimary(overview?.core);

            if (!Number.isFinite(primaryValue)
                || primaryValue <= 0
                || !Number.isFinite(exaltedPerPrimary)
                || exaltedPerPrimary <= 0) {
                return {
                    ...product,
                    lowestPrice: null,
                    highestPrice: null,
                    volume: null,
                    quoteChangeId: null
                };
            }

            return {
                ...product,
                lowestPrice: primaryValue * exaltedPerPrimary,
                highestPrice: primaryValue * exaltedPerPrimary,
                volume: calculatePoeNinjaVolume(line),
                quoteChangeId: hourlyBucket
            };
        })
    };
}

function getPoeNinjaExaltedPerPrimary(core) {
    if (core?.primary === POE2_MARKET_BASE_CURRENCY_ID) {
        return 1;
    }

    return Number(core?.rates?.[POE2_MARKET_BASE_CURRENCY_ID]);
}

async function fetchPoeNinjaOverview(config, type) {
    const query = new URLSearchParams({
        league: config.league,
        type: type
    });
    const response = await fetch(`${POE_NINJA_API_ROOT}?${query.toString()}`, {
        headers: {
            'User-Agent': config.userAgent,
            Accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw await buildResponseError('poe.ninja market request failed', response);
    }

    return await response.json();
}

function calculatePoeNinjaVolume(line) {
    const value = Number(line?.volumePrimaryValue);
    const price = Number(line?.primaryValue);

    if (!Number.isFinite(value) || !Number.isFinite(price) || price <= 0) {
        return null;
    }

    return Math.round(value / price);
}

async function getAccessToken(config) {
    if (config.accessToken) {
        return config.accessToken;
    }

    if (!requestedAccessToken) {
        requestedAccessToken = requestAccessToken(config).catch(function(error) {
            requestedAccessToken = null;
            throw error;
        });
    }

    return await requestedAccessToken;
}

async function requestAccessToken(config) {
    const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'client_credentials',
        scope: 'service:cxapi'
    });
    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': config.userAgent
        },
        body: body.toString()
    });

    if (!response.ok) {
        throw await buildResponseError('PoE2 OAuth token request failed', response);
    }

    const payload = await response.json();

    if (!payload.access_token) {
        throw new Error('PoE2 OAuth token response does not contain access_token.');
    }

    return payload.access_token;
}

async function fetchExchangeDigest(config, accessToken, changeId) {
    const response = await fetch(`${API_ROOT}/currency-exchange/poe2/${changeId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': config.userAgent
        }
    });

    if (!response.ok) {
        throw await buildResponseError('PoE2 currency exchange request failed', response);
    }

    return await response.json();
}

function collectQuotes(markets, changeId, quotesByProductId) {
    for (const product of POE2_MARKET_PRODUCTS) {
        if (product.base || quotesByProductId.has(product.id)) {
            continue;
        }

        const market = markets.find(function(entry) {
            return isMarketPair(entry.market_id, product.id, POE2_MARKET_BASE_CURRENCY_ID);
        });

        if (!market) {
            continue;
        }

        const prices = [
            calculatePriceInExalted(market.lowest_ratio, product.id),
            calculatePriceInExalted(market.highest_ratio, product.id)
        ].filter(function(value) {
            return Number.isFinite(value);
        });

        if (prices.length === 0) {
            continue;
        }

        quotesByProductId.set(product.id, {
            lowestPrice: Math.min(...prices),
            highestPrice: Math.max(...prices),
            volume: Number(market.volume_traded?.[product.id] || 0),
            quoteChangeId: changeId
        });
    }
}

function isMarketPair(marketId, productId, currencyId) {
    const ids = String(marketId || '').split('|');

    return ids.includes(productId) && ids.includes(currencyId);
}

function calculatePriceInExalted(ratio, productId) {
    const productAmount = Number(ratio?.[productId]);
    const exaltedAmount = Number(ratio?.[POE2_MARKET_BASE_CURRENCY_ID]);

    if (!Number.isFinite(productAmount) || !Number.isFinite(exaltedAmount) || productAmount <= 0) {
        return null;
    }

    return exaltedAmount / productAmount;
}

function hasAllQuotes(quotesByProductId) {
    return POE2_MARKET_PRODUCTS
        .filter(function(product) {
            return !product.base;
        })
        .every(function(product) {
            return quotesByProductId.has(product.id);
        });
}

function getLatestCompletedHour(now) {
    return Math.floor(now.getTime() / (HOUR_SECONDS * 1000)) * HOUR_SECONDS - HOUR_SECONDS;
}

function getCurrentHour(now) {
    return Math.floor(now.getTime() / (HOUR_SECONDS * 1000)) * HOUR_SECONDS;
}

async function buildResponseError(prefix, response) {
    const responseText = await response.text();
    const suffix = responseText ? `: ${responseText.slice(0, 300)}` : '';

    return new Error(`${prefix} (${response.status})${suffix}`);
}
