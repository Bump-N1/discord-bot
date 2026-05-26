import { getPoe2MarketConfig, validatePoe2MarketConfig } from './poe2-market-config.js';
import {
    POE2_MARKET_BASE_CURRENCY_ID,
    POE2_MARKET_PRODUCTS
} from './poe2-market-definition.js';

const TOKEN_URL = 'https://www.pathofexile.com/oauth/token';
const API_ROOT = 'https://api.pathofexile.com';
const HOUR_SECONDS = 60 * 60;
let requestedAccessToken = null;

export async function fetchPoe2MarketSnapshot(now = new Date()) {
    const config = getPoe2MarketConfig();
    validatePoe2MarketConfig(config);

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

async function buildResponseError(prefix, response) {
    const responseText = await response.text();
    const suffix = responseText ? `: ${responseText.slice(0, 300)}` : '';

    return new Error(`${prefix} (${response.status})${suffix}`);
}
