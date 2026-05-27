const POE2_JAPANESE_TRADE_DATA_ROOT = 'https://jp.pathofexile.com/api/trade2/data';
const POE2_ENGLISH_TRADE_DATA_ROOT = 'https://www.pathofexile.com/api/trade2/data';
const POE2_TRADE_DATA_TYPES = ['static', 'items'];
const POE2_REALM = 'poe2';
const LABEL_CACHE_MS = 24 * 60 * 60 * 1000;
const LEGACY_JAPANESE_LABELS = new Map([
    ['高貴のオーブ', '高貴なオーブ'],
    ['Uncut Skill Gem Lv20', 'スキルジェムの原石 (レベル20)'],
    ['Uncut Spirit Gem Lv20', 'スピリットジェムの原石 (レベル20)'],
    ['スキルジェム Lv20', 'スキルジェムの原石 (レベル20)'],
    ['スピリットジェム Lv20', 'スピリットジェムの原石 (レベル20)']
]);
let cachedLabels = null;
let loadingLabels = null;
let cachedEnglishLabels = null;
let loadingEnglishLabels = null;

export async function localizePoe2MarketProducts(products, userAgent) {
    let labels;

    try {
        labels = await getPoe2JapaneseItemLabels(userAgent);
    } catch (error) {
        console.warn('PoE2 Japanese item names could not be loaded:', error.message);
        return products;
    }

    return products.map(function(product) {
        const label = labels.get(product.id);

        return label
            ? {
                ...product,
                label: label
            }
            : product;
    });
}

export async function getPoe2JapaneseItemLabels(userAgent) {
    if (cachedLabels && cachedLabels.expiresAt > Date.now()) {
        return cachedLabels.labels;
    }

    if (!loadingLabels) {
        loadingLabels = fetchPoe2ItemLabels(POE2_JAPANESE_TRADE_DATA_ROOT, userAgent, 'ja-JP,ja;q=0.9').finally(function() {
            loadingLabels = null;
        });
    }

    const labels = await loadingLabels;

    cachedLabels = {
        expiresAt: Date.now() + LABEL_CACHE_MS,
        labels: labels
    };

    return labels;
}

export async function localizePoe2MarketLabelTexts(labels, userAgent) {
    try {
        const [japaneseLabels, englishLabels] = await Promise.all([
            getPoe2JapaneseItemLabels(userAgent),
            getPoe2EnglishItemLabels(userAgent)
        ]);
        const japaneseLabelByEnglishText = new Map();

        for (const [id, englishLabel] of englishLabels) {
            const japaneseLabel = japaneseLabels.get(id);

            if (japaneseLabel) {
                japaneseLabelByEnglishText.set(englishLabel, japaneseLabel);
            }
        }

        return labels.map(function(label) {
            return japaneseLabelByEnglishText.get(label)
                || LEGACY_JAPANESE_LABELS.get(label)
                || label;
        });
    } catch (error) {
        console.warn('PoE2 Japanese history names could not be loaded:', error.message);
        return labels;
    }
}

async function getPoe2EnglishItemLabels(userAgent) {
    if (cachedEnglishLabels && cachedEnglishLabels.expiresAt > Date.now()) {
        return cachedEnglishLabels.labels;
    }

    if (!loadingEnglishLabels) {
        loadingEnglishLabels = fetchPoe2ItemLabels(POE2_ENGLISH_TRADE_DATA_ROOT, userAgent, 'en-US,en;q=0.9').finally(function() {
            loadingEnglishLabels = null;
        });
    }

    const labels = await loadingEnglishLabels;

    cachedEnglishLabels = {
        expiresAt: Date.now() + LABEL_CACHE_MS,
        labels: labels
    };

    return labels;
}

async function fetchPoe2ItemLabels(dataRoot, userAgent, language) {
    const payloads = await Promise.all(POE2_TRADE_DATA_TYPES.map(async function(dataType) {
        const url = new URL(`${dataRoot}/${dataType}`);

        url.searchParams.set('realm', POE2_REALM);

        const response = await fetch(url, {
            headers: {
                'User-Agent': userAgent,
                Accept: 'application/json',
                'Accept-Language': language
            }
        });

        if (!response.ok) {
            throw new Error(`official trade data request failed (${response.status})`);
        }

        return await response.json();
    }));
    const labels = new Map();

    for (const payload of payloads) {
        for (const group of payload.result || []) {
            for (const entry of group.entries || []) {
                const id = String(entry.id || '').trim();
                const label = String(entry.text || '').trim();

                if (id && label) {
                    labels.set(id, label);
                }
            }
        }
    }

    return labels;
}
