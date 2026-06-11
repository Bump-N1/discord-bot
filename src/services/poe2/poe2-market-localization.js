const POE2_JAPANESE_TRADE_DATA_ROOT = 'https://jp.pathofexile.com/api/trade2/data';
const POE2_ENGLISH_TRADE_DATA_ROOT = 'https://www.pathofexile.com/api/trade2/data';
const POE2_OFFICIAL_IMAGE_ROOT = 'https://www.pathofexile.com';
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
let cachedMarketProducts = null;
let loadingMarketProducts = null;

export async function localizePoe2MarketProducts(products, userAgent) {
    let marketProducts;

    try {
        marketProducts = await getPoe2JapaneseMarketProducts(userAgent);
    } catch (error) {
        console.warn('PoE2 Japanese item names could not be loaded:', error.message);
        return products;
    }

    const marketProductById = new Map(marketProducts.map(function(product) {
        return [product.id, product];
    }));

    return products.map(function(product) {
        const metadata = marketProductById.get(product.id);

        return metadata
            ? {
                ...product,
                label: metadata.label,
                category: metadata.category,
                sourceCategory: metadata.sourceCategory,
                subCategory: metadata.subCategory,
                subCategoryOrder: metadata.subCategoryOrder,
                iconUrl: product.iconUrl || metadata.iconUrl,
                sortOrder: metadata.sortOrder
            }
            : product;
    });
}

export async function getPoe2JapaneseMarketProducts(userAgent) {
    if (cachedMarketProducts && cachedMarketProducts.expiresAt > Date.now()) {
        return cachedMarketProducts.products;
    }

    if (!loadingMarketProducts) {
        loadingMarketProducts = fetchPoe2MarketProducts(userAgent).finally(function() {
            loadingMarketProducts = null;
        });
    }

    const products = await loadingMarketProducts;

    cachedMarketProducts = {
        expiresAt: Date.now() + LABEL_CACHE_MS,
        products: products
    };

    return products;
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

async function fetchPoe2MarketProducts(userAgent) {
    const url = new URL(`${POE2_JAPANESE_TRADE_DATA_ROOT}/static`);

    url.searchParams.set('realm', POE2_REALM);

    const response = await fetch(url, {
        headers: {
            'User-Agent': userAgent,
            Accept: 'application/json',
            'Accept-Language': 'ja-JP,ja;q=0.9'
        }
    });

    if (!response.ok) {
        throw new Error(`official trade data request failed (${response.status})`);
    }

    const payload = await response.json();
    const products = [];

    for (const group of payload.result || []) {
        let currentSubCategory = '';
        let itemSortOrder = 0;

        for (const entry of group.entries || []) {
            if (entry.id === 'sep') {
                currentSubCategory = String(entry.text || '').trim();
                continue;
            }

            const id = String(entry.id || '').trim();
            const label = String(entry.text || '').trim();
            const image = String(entry.image || '').trim();

            if (!id || !label || !image) {
                continue;
            }

            const mapped = mapOfficialMarketProduct(group.id, group.label, currentSubCategory, label);

            products.push({
                id: id,
                label: label,
                category: mapped.category,
                sourceCategory: String(group.id || ''),
                subCategory: mapped.subCategory,
                subCategoryOrder: getSubCategoryOrder(mapped.category, mapped.subCategory),
                iconUrl: new URL(image, POE2_OFFICIAL_IMAGE_ROOT).toString(),
                sortOrder: itemSortOrder
            });
            itemSortOrder += 1;
        }
    }

    return products;
}

function mapOfficialMarketProduct(groupId, groupLabel, subCategory, label) {
    const key = String(groupId || '');
    const section = String(subCategory || '').trim();
    const text = String(label || '');

    if (key === 'Vaal') {
        if (section === 'オーグメント') {
            return {
                category: 'SoulCores',
                subCategory: 'ソウルコア'
            };
        }

        return {
            category: 'Incursion',
            subCategory: section || 'カレンシー'
        };
    }

    if (key === 'Ritual' && section === 'アイドル') {
        return {
            category: 'Idols',
            subCategory: 'アイドル'
        };
    }

    if (key === 'Verisium') {
        return {
            category: 'Expedition',
            subCategory: getVerisiumSubCategory(text)
        };
    }

    if (key === 'Idol') {
        return {
            category: 'Idols',
            subCategory: 'アイドル'
        };
    }

    if (key === 'Ultimatum') {
        return {
            category: 'SoulCores',
            subCategory: 'ソウルコア'
        };
    }

    if (key === 'Abyss') {
        return {
            category: 'Abyss',
            subCategory: section || 'アビスの骨'
        };
    }

    if (key === 'Currency') {
        return {
            category: 'Currency',
            subCategory: getCurrencySubCategory(text, section)
        };
    }

    if (key === 'Essences') {
        return {
            category: 'Essences',
            subCategory: getEssenceSubCategory(text, section)
        };
    }

    if (key === 'Runes') {
        return {
            category: 'Runes',
            subCategory: getRuneSubCategory(text, section)
        };
    }

    if (key === 'Expedition') {
        return {
            category: 'Expedition',
            subCategory: section || 'エクスペディション'
        };
    }

    if (key === 'Ritual') {
        return {
            category: 'Ritual',
            subCategory: getRitualSubCategory(section)
        };
    }

    if (key === 'Breach') {
        return {
            category: 'Breach',
            subCategory: section || 'ブリーチ'
        };
    }

    if (key === 'Delirium') {
        return {
            category: 'Delirium',
            subCategory: section || 'デリリウム'
        };
    }

    if (key === 'Fragments') {
        return {
            category: 'Fragments',
            subCategory: section || 'フラグメント'
        };
    }

    if (key === 'UncutGems') {
        return {
            category: 'UncutGems',
            subCategory: section || 'ジェムの原石'
        };
    }

    if (key === 'LineageSupportGems') {
        return {
            category: 'LineageSupportGems',
            subCategory: 'リネージュサポートジェム'
        };
    }

    return {
        category: key,
        subCategory: section || String(groupLabel || key)
    };
}

function getVerisiumSubCategory(label) {
    if (label.includes('合金')) {
        return '合金';
    }

    if (label.includes('フラックス')) {
        return 'フラックス';
    }

    if (label.includes('星明り')) {
        return '星明りの鉱石';
    }

    return 'ヴェリシウム';
}

function getCurrencySubCategory(label, section) {
    if (label.includes('宝飾職人')) {
        return '宝飾職人のカレンシー';
    }

    if (label.includes('シャード')) {
        return 'カレンシーシャード';
    }

    if (label.includes('品質')) {
        return '品質カレンシー';
    }

    if (label.includes('鑑定')) {
        return '鑑定カレンシー';
    }

    return section || 'カレンシー';
}

function getEssenceSubCategory(label, section) {
    if (label.includes('レッサーエッセンス')) {
        return 'レッサーエッセンス';
    }

    if (label.includes('グレーターエッセンス')) {
        return 'グレーターエッセンス';
    }

    if (label.includes('パーフェクトエッセンス')) {
        return 'パーフェクトエッセンス';
    }

    if (label.includes('コラプトエッセンス')) {
        return 'コラプトエッセンス';
    }

    return section || 'エッセンス';
}

function getRuneSubCategory(label, section) {
    if (label.includes('パーフェクトルーン')) {
        return 'パーフェクトルーン';
    }

    if (label.includes('グレータールーン')) {
        return 'グレータールーン';
    }

    return section || 'ルーン';
}

function getRitualSubCategory(section) {
    if (section === 'オーグメント') {
        return '特殊お告げ';
    }

    return section || 'お告げ';
}

function getSubCategoryOrder(category, subCategory) {
    const order = {
        Idols: ['アイドル'],
        Incursion: ['カレンシー', 'ソウルコア'],
        Abyss: ['アビスの骨', 'お告げ', 'ピナクルフラグメント', 'アビサルアイ'],
        Expedition: ['エクスペディション', 'お告げ', 'ヴェリシウム', '合金', 'フラックス', '星明りの鉱石', 'オーグメント'],
        Essences: ['レッサーエッセンス', 'エッセンス', 'グレーターエッセンス', 'パーフェクトエッセンス', 'コラプトエッセンス'],
        Currency: ['カレンシー', '宝飾職人のカレンシー', 'カレンシーシャード', '品質カレンシー', '鑑定カレンシー'],
        LineageSupportGems: ['リネージュサポートジェム'],
        UncutGems: ['サポートジェムの原石', 'リザーブジェムの原石', 'スキルジェムの原石', 'ジェムの原石'],
        SoulCores: ['ソウルコア'],
        Delirium: ['デリリウム', '液化した感情'],
        Fragments: ['フラグメント', 'アルティメイタムフラグメント', 'ピナクルフラグメント', '聖廟の鍵'],
        Breach: ['ブリーチ', 'カタリスト', 'ピナクルフラグメント'],
        Ritual: ['お告げ', '特殊お告げ', 'ピナクルフラグメント'],
        Runes: ['ルーン', 'パーフェクトルーン', 'グレータールーン']
    };
    const index = (order[category] || []).indexOf(subCategory);

    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
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
