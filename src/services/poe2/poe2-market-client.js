import {
    getPoe2MarketConfig,
    shouldUseOfficialMarketApi,
    validatePoe2MarketConfig
} from './poe2-market-config.js';
import {
    createPoe2MarketProduct,
    getKnownPoe2MarketProducts,
    POE2_MARKET_BASE_CURRENCY_ID,
    POE2_MARKET_CATEGORIES,
    POE2_MARKET_DIVINE_CURRENCY_ID
} from './poe2-market-definition.js';
import {
    getPoe2JapaneseMarketProducts,
    localizePoe2MarketProducts
} from './poe2-market-localization.js';

const TOKEN_URL = 'https://www.pathofexile.com/oauth/token';
const API_ROOT = 'https://api.pathofexile.com';
const POE_NINJA_API_ROOT = 'https://poe.ninja/poe2/api/economy/exchange/current/overview';
const POE_NINJA_INDEX_STATE_URL = 'https://poe.ninja/poe2/api/data/index-state?';
const POE_NINJA_IMAGE_ROOT = 'https://www.pathofexile.com';
const HOUR_SECONDS = 60 * 60;
const CATALOG_CACHE_MS = 5 * 60 * 1000;
const LEAGUE_CACHE_MS = 5 * 60 * 1000;
const AUTO_LEAGUE = 'auto';
const QUOTE_CURRENCY_IDS = [POE2_MARKET_BASE_CURRENCY_ID, POE2_MARKET_DIVINE_CURRENCY_ID];
const LEGACY_CATEGORY_ALIASES = {
    Ultimatum: 'SoulCores',
    Idol: 'Idols',
    Vaal: 'Incursion',
    Verisium: 'Expedition'
};
const GAME_DISPLAY_OVERRIDES = {
    'runic-splinter': {
        category: 'Expedition',
        sortOrder: -1
    }
};
const POE_NINJA_SOURCE_CATEGORY_OVERRIDES = {
    'simulacrum-splinter': 'Fragments',
    simulacrum: 'Fragments',
    'runic-splinter': 'Fragments'
};
const POE_NINJA_SOURCE_CATEGORY_BY_DISPLAY_CATEGORY = {
    Incursion: 'SoulCores',
    SoulCores: 'SoulCores',
    Idols: 'Idols'
};
let requestedAccessToken = null;
let cachedCatalog = null;
let cachedAutoLeague = null;

export async function fetchPoe2MarketCatalog() {
    const config = await resolvePoe2MarketConfig(getPoe2MarketConfig());

    validatePoe2MarketConfig(config);

    if (cachedCatalog
        && cachedCatalog.league === config.league
        && cachedCatalog.expiresAt > Date.now()) {
        return cachedCatalog.catalog;
    }

    const products = (await loadCatalogProducts(config))
        .map(normalizeMarketProductCategory)
        .filter(isSupportedMarketCategory)
        .sort(compareCatalogProducts);

    const catalog = {
        league: config.league,
        categories: POE2_MARKET_CATEGORIES,
        products: products
    };

    cachedCatalog = {
        league: config.league,
        expiresAt: Date.now() + CATALOG_CACHE_MS,
        catalog: catalog
    };

    return catalog;
}

async function loadCatalogProducts(config) {
    try {
        return await getPoe2JapaneseMarketProducts(config.userAgent);
    } catch (error) {
        console.warn('PoE2 official catalog could not be loaded; using price-provider items:', error.message);
        return await loadPoeNinjaCatalogProducts(config);
    }
}

async function loadPoeNinjaCatalogProducts(config) {
    const overviews = await fetchPoeNinjaOverviews(config);
    const productMap = new Map();
    const knownProducts = new Map(getKnownPoe2MarketProducts().map(function(product) {
        return [product.id, product];
    }));

    for (const product of knownProducts.values()) {
        productMap.set(product.id, product);
    }

    for (const overview of overviews) {
        for (const line of overview.data.lines || []) {
            const id = String(line.id || '').trim();

            if (!id) {
                continue;
            }

            const metadata = findPoeNinjaMetadata(overview.data, id);
            const candidate = createPoe2MarketProduct(id, {
                category: overview.category,
                label: getPoeNinjaLabel(line, metadata),
                iconUrl: normalizePoeNinjaIconUrl(getPoeNinjaIconUrl(line, metadata))
            });
            const known = knownProducts.get(id);

            productMap.set(id, {
                ...candidate,
                label: known?.label || candidate.label,
                category: known?.category || candidate.category,
                iconUrl: known?.iconUrl || candidate.iconUrl
            });
        }
    }

    return await localizePoe2MarketProducts(Array.from(productMap.values()), config.userAgent);
}

export async function fetchPoe2MarketSnapshot(selectedProducts, now = new Date()) {
    const config = await resolvePoe2MarketConfig(getPoe2MarketConfig());

    validatePoe2MarketConfig(config);
    requireSelectedProducts(selectedProducts);
    const localizedProducts = (await localizePoe2MarketProducts(selectedProducts, config.userAgent))
        .map(normalizeMarketProductCategory)
        .sort(compareCatalogProducts);

    if (!shouldUseOfficialMarketApi(config)) {
        return await fetchPoeNinjaMarketSnapshot(config, localizedProducts, now);
    }

    return await fetchOfficialMarketSnapshot(config, localizedProducts, now);
}

async function resolvePoe2MarketConfig(config) {
    validatePoe2MarketConfig(config);

    if (config.league.toLowerCase() !== AUTO_LEAGUE) {
        return config;
    }

    return {
        ...config,
        league: await fetchAutomaticLeague(config)
    };
}

async function fetchAutomaticLeague(config) {
    if (cachedAutoLeague && cachedAutoLeague.expiresAt > Date.now()) {
        return cachedAutoLeague.league;
    }

    const response = await fetch(POE_NINJA_INDEX_STATE_URL, {
        headers: {
            'User-Agent': config.userAgent,
            Accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw await buildResponseError('poe.ninja league request failed', response);
    }

    const payload = await response.json();
    const activeLeague = findLatestTradeChallengeLeague(payload.economyLeagues);
    const previousLeague = findLatestTradeChallengeLeague(payload.oldEconomyLeagues);
    const league = activeLeague || previousLeague;

    if (!league) {
        throw new Error('Current PoE2 challenge league was not found.');
    }

    cachedAutoLeague = {
        league: league,
        expiresAt: Date.now() + LEAGUE_CACHE_MS
    };

    return league;
}

function findLatestTradeChallengeLeague(leagues) {
    const permanentLeagues = new Set(['Standard', 'Hardcore']);

    return (Array.isArray(leagues) ? leagues : []).find(function(league) {
        return league
            && league.name
            && !league.hardcore
            && league.indexed !== false
            && !permanentLeagues.has(league.name);
    })?.name || '';
}

function requireSelectedProducts(selectedProducts) {
    if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) {
        throw new Error('PoE2 market products are not configured.');
    }
}

async function fetchOfficialMarketSnapshot(config, selectedProducts, now) {
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

        collectOfficialQuotes(leagueMarkets, changeId, selectedProducts, quotesByProductId);

        if (hasAllOfficialQuotes(selectedProducts, quotesByProductId)) {
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
        products: selectedProducts.map(function(product) {
            return {
                ...product,
                prices: buildOfficialProductPrices(product, quotesByProductId, availableHour)
            };
        })
    };
}

async function fetchPoeNinjaMarketSnapshot(config, selectedProducts, now) {
    const requiredCategories = Array.from(new Set([
        'Currency',
        ...selectedProducts.map(function(product) {
            return getPoeNinjaSourceCategory(product);
        })
    ]));
    const overviews = await fetchPoeNinjaOverviews(config, requiredCategories);
    const hourlyBucket = getCurrentHour(now);

    return {
        source: 'poe-ninja',
        league: config.league,
        changeId: `poe-ninja:${hourlyBucket}`,
        completedHour: hourlyBucket,
        capturedAt: now.toISOString(),
        products: selectedProducts.map(function(product) {
            return {
                ...product,
                prices: buildPoeNinjaProductPrices(product, overviews, hourlyBucket)
            };
        })
    };
}

function getPoeNinjaSourceCategory(product) {
    return POE_NINJA_SOURCE_CATEGORY_OVERRIDES[product.id]
        || POE_NINJA_SOURCE_CATEGORY_BY_DISPLAY_CATEGORY[product.category]
        || LEGACY_CATEGORY_ALIASES[product.sourceCategory]
        || product.sourceCategory
        || product.category;
}

async function fetchPoeNinjaOverviews(config, categoryKeys = POE2_MARKET_CATEGORIES.map(function(category) {
    return category.key;
})) {
    return await Promise.all(categoryKeys.map(async function(categoryKey) {
        return {
            category: categoryKey,
            data: await fetchPoeNinjaOverview(config, categoryKey)
        };
    }));
}

function buildPoeNinjaProductPrices(product, overviews, quoteChangeId) {
    const productOverview = findPoeNinjaProductOverview(overviews, product.id);
    const referenceOverview = productOverview || overviews.find(function(overview) {
        return overview.category === 'Currency';
    });
    const line = (productOverview?.data.lines || []).find(function(candidate) {
        return candidate.id === product.id;
    });
    const valueInPrimary = getPoeNinjaValueInPrimary(product.id, line, referenceOverview?.data.core);

    return Object.fromEntries(QUOTE_CURRENCY_IDS.map(function(currencyId) {
        const price = convertPoeNinjaPrice(valueInPrimary, product.id, currencyId, referenceOverview?.data.core);

        return [currencyId, createPrice(price, quoteChangeId)];
    }));
}

function findPoeNinjaProductOverview(overviews, productId) {
    return overviews.find(function(overview) {
        return (overview.data.lines || []).some(function(line) {
            return line.id === productId;
        }) || overview.data.core?.primary === productId
            || Number.isFinite(Number(overview.data.core?.rates?.[productId]));
    }) || null;
}

function normalizeMarketProductCategory(product) {
    const override = GAME_DISPLAY_OVERRIDES[product.id] || {};
    const category = override.category || LEGACY_CATEGORY_ALIASES[product.category] || product.category;
    const sourceCategory = product.sourceCategory || product.category;
    const sortOrder = override.sortOrder ?? product.sortOrder;

    return category === product.category && sourceCategory === product.sourceCategory && sortOrder === product.sortOrder
        ? product
        : {
            ...product,
            category: category,
            sourceCategory: sourceCategory,
            sortOrder: sortOrder
        };
}

function isSupportedMarketCategory(product) {
    return POE2_MARKET_CATEGORIES.some(function(category) {
        return category.key === product.category;
    });
}

function getPoeNinjaValueInPrimary(productId, line, core) {
    if (!core) {
        return null;
    }

    if (productId === core.primary) {
        return 1;
    }

    const primaryValue = Number(line?.primaryValue);

    if (Number.isFinite(primaryValue) && primaryValue > 0) {
        return primaryValue;
    }

    const productPerPrimary = Number(core.rates?.[productId]);

    if (Number.isFinite(productPerPrimary) && productPerPrimary > 0) {
        return 1 / productPerPrimary;
    }

    return null;
}

function convertPoeNinjaPrice(valueInPrimary, productId, currencyId, core) {
    if (productId === currencyId) {
        return 1;
    }

    if (!Number.isFinite(valueInPrimary) || valueInPrimary <= 0 || !core) {
        return null;
    }

    if (core.primary === currencyId) {
        return valueInPrimary;
    }

    const targetPerPrimary = Number(core.rates?.[currencyId]);

    return Number.isFinite(targetPerPrimary) && targetPerPrimary > 0
        ? valueInPrimary * targetPerPrimary
        : null;
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

function findPoeNinjaMetadata(overview, id) {
    const candidates = [
        ...(overview.items || []),
        ...(overview.core?.items || [])
    ];

    return candidates.find(function(item) {
        return String(item.id || item.detailsId || '') === id;
    }) || {};
}

function getPoeNinjaLabel(line, metadata) {
    return line.name
        || line.currencyTypeName
        || line.label
        || metadata.name
        || metadata.label
        || '';
}

function getPoeNinjaIconUrl(line, metadata) {
    return line.icon
        || line.image
        || metadata.icon
        || metadata.image
        || '';
}

function normalizePoeNinjaIconUrl(value) {
    const iconUrl = String(value || '').trim();

    if (!iconUrl) {
        return '';
    }

    const url = new URL(iconUrl, POE_NINJA_IMAGE_ROOT);
    const allowedHosts = [
        'www.pathofexile.com',
        'pathofexile.com',
        'poe.ninja',
        'www.poe.ninja',
        'web.poecdn.com'
    ];

    return url.protocol === 'https:' && allowedHosts.includes(url.hostname)
        ? url.toString()
        : '';
}

function compareCatalogProducts(left, right) {
    const leftCategory = POE2_MARKET_CATEGORIES.findIndex(function(category) {
        return category.key === left.category;
    });
    const rightCategory = POE2_MARKET_CATEGORIES.findIndex(function(category) {
        return category.key === right.category;
    });

    if (leftCategory !== rightCategory) {
        return leftCategory - rightCategory;
    }

    const leftOrder = Number.isFinite(Number(left.sortOrder)) ? Number(left.sortOrder) : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(Number(right.sortOrder)) ? Number(right.sortOrder) : Number.MAX_SAFE_INTEGER;
    const leftSubCategoryOrder = Number.isFinite(Number(left.subCategoryOrder))
        ? Number(left.subCategoryOrder)
        : Number.MAX_SAFE_INTEGER;
    const rightSubCategoryOrder = Number.isFinite(Number(right.subCategoryOrder))
        ? Number(right.subCategoryOrder)
        : Number.MAX_SAFE_INTEGER;

    if (leftSubCategoryOrder !== rightSubCategoryOrder) {
        return leftSubCategoryOrder - rightSubCategoryOrder;
    }

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
    }

    return left.label.localeCompare(right.label, 'ja-JP');
}

function createPrice(value, quoteChangeId) {
    return {
        lowestPrice: Number.isFinite(value) && value > 0 ? value : null,
        highestPrice: Number.isFinite(value) && value > 0 ? value : null,
        quoteChangeId: Number.isFinite(value) && value > 0 ? quoteChangeId : null
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

function collectOfficialQuotes(markets, changeId, selectedProducts, quotesByProductId) {
    for (const product of selectedProducts) {
        const quotes = quotesByProductId.get(product.id) || {};

        for (const currencyId of QUOTE_CURRENCY_IDS) {
            if (product.id === currencyId || quotes[currencyId]) {
                continue;
            }

            const market = markets.find(function(entry) {
                return isMarketPair(entry.market_id, product.id, currencyId);
            });

            if (!market) {
                continue;
            }

            const prices = [
                calculatePriceInCurrency(market.lowest_ratio, product.id, currencyId),
                calculatePriceInCurrency(market.highest_ratio, product.id, currencyId)
            ].filter(function(value) {
                return Number.isFinite(value);
            });

            if (prices.length === 0) {
                continue;
            }

            quotes[currencyId] = {
                lowestPrice: Math.min(...prices),
                highestPrice: Math.max(...prices),
                quoteChangeId: changeId
            };
        }

        quotesByProductId.set(product.id, quotes);
    }
}

function buildOfficialProductPrices(product, quotesByProductId, quoteChangeId) {
    const quotes = quotesByProductId.get(product.id) || {};

    return Object.fromEntries(QUOTE_CURRENCY_IDS.map(function(currencyId) {
        if (product.id === currencyId) {
            return [currencyId, createPrice(1, quoteChangeId)];
        }

        return [currencyId, quotes[currencyId] || createPrice(null, null)];
    }));
}

function isMarketPair(marketId, productId, currencyId) {
    const ids = String(marketId || '').split('|');

    return ids.includes(productId) && ids.includes(currencyId);
}

function calculatePriceInCurrency(ratio, productId, currencyId) {
    const productAmount = Number(ratio?.[productId]);
    const currencyAmount = Number(ratio?.[currencyId]);

    if (!Number.isFinite(productAmount) || !Number.isFinite(currencyAmount) || productAmount <= 0) {
        return null;
    }

    return currencyAmount / productAmount;
}

function hasAllOfficialQuotes(selectedProducts, quotesByProductId) {
    return selectedProducts.every(function(product) {
        const quotes = quotesByProductId.get(product.id) || {};

        return QUOTE_CURRENCY_IDS.every(function(currencyId) {
            return product.id === currencyId || Boolean(quotes[currencyId]);
        });
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
