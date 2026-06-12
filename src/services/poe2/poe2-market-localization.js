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
const CURRENCY_SORT_ORDER = new Map([
    'aug',
    'greater-orb-of-augmentation',
    'perfect-orb-of-augmentation',
    'transmute',
    'greater-orb-of-transmutation',
    'perfect-orb-of-transmutation',
    'regal',
    'greater-regal-orb',
    'perfect-regal-orb',
    'exalted',
    'greater-exalted-orb',
    'perfect-exalted-orb',
    'chaos',
    'greater-chaos-orb',
    'perfect-chaos-orb',
    'vaal',
    'alch',
    'divine',
    'chance',
    'annul',
    'artificers',
    'fracturing-orb',
    'hinekoras-lock',
    'mirror',
    'cryptic-key',
    'thaumaturgic-flux-2',
    'thaumaturgic-flux-3',
    'thaumaturgic-flux-4',
    'thaumaturgic-flux-5',
    'thaumaturgic-flux-6',
    'thaumaturgic-flux-7',
    'thaumaturgic-flux-8',
    'thaumaturgic-flux-9',
    'thaumaturgic-flux-10',
    'thaumaturgic-flux-11',
    'thaumaturgic-flux-12',
    'thaumaturgic-flux-13',
    'thaumaturgic-flux-14',
    'thaumaturgic-flux-15',
    'thaumaturgic-flux-16',
    'thaumaturgic-flux-17',
    'thaumaturgic-flux-18',
    'thaumaturgic-flux-19',
    'thaumaturgic-flux-20',
    'lesser-jewellers-orb',
    'greater-jewellers-orb',
    'perfect-jewellers-orb',
    'transmutation-shard',
    'chance-shard',
    'regal-shard',
    'artificers-shard',
    'scrap',
    'whetstone',
    'etcher',
    'bauble',
    'gcp',
    'wisdom'
].map(function(id, index) {
    return [id, index];
}));
const EXCLUDED_MARKET_PRODUCT_IDS = new Set([
    'idol-of-estazunti',
    'petition-splinter',
    'primary-calamity-fragment',
    'secondary-calamity-fragment',
    'tertiary-calamity-fragment',
    'lavish-wombgift',
    'ornate-wombgift',
    'banded-wombgift',
    'signet-wombgift',
    'revelatory-wombgift',
    'omen-of-corruption',
    'omen-of-homogenising-exaltation',
    'omen-of-homogenising-coronation'
]);
const FRAGMENT_SORT_ORDER = new Map([
    'cowardly-fate',
    'deadly-fate',
    'victorious-fate',
    'ancient-crisis-fragment',
    'faded-crisis-fragment',
    'weathered-crisis-fragment',
    'origin-cradle',
    'origin-spark',
    'origin-core',
    'call-of-the-shadows',
    'twilight-reliquary-key',
    'xeshts-reliquary-key',
    'the-trialmasters-reliquary-key',
    'ritualistic-reliquary-key',
    'tangmazus-reliquary-key',
    'olroths-reliquary-key',
    'the-arbiters-reliquary-key',
    'against-the-darkness',
    'sandstorm-visage',
    'blessed-bonds',
    'sekhemas-resolve',
    'temporalis',
    'azmeri-reliquary-key'
].map(function(id, index) {
    return [id, index];
}));
const DELIRIUM_SORT_ORDER = new Map([
    'simulacrum-splinter',
    'simulacrum',
    'raven-touched-shard',
    'diluted-liquid-ire',
    'diluted-liquid-guilt',
    'diluted-liquid-greed',
    'liquid-paranoia',
    'liquid-envy',
    'liquid-disgust',
    'liquid-despair',
    'concentrated-liquid-fear',
    'concentrated-liquid-suffering',
    'concentrated-liquid-isolation',
    'ancient-diluted-liquid-ire',
    'ancient-diluted-liquid-guilt',
    'ancient-diluted-liquid-greed',
    'ancient-liquid-paranoia',
    'ancient-liquid-envy',
    'ancient-liquid-disgust',
    'ancient-liquid-despair',
    'ancient-concentrated-liquid-fear',
    'ancient-concentrated-liquid-suffering',
    'ancient-concentrated-liquid-isolation',
    'potent-liquid-melancholy',
    'potent-liquid-ferocity',
    'potent-liquid-contempt',
    'ancient-potent-liquid-melancholy',
    'ancient-potent-liquid-ferocity',
    'ancient-potent-liquid-contempt'
].map(function(id, index) {
    return [id, index];
}));
const BREACH_SORT_ORDER = new Map([
    'breach-splinter',
    'breachstone',
    'flesh-catalyst',
    'neural-catalyst',
    'carapace-catalyst',
    'adaptive-catalyst',
    'xophs-catalyst',
    'tuls-catalyst',
    'eshs-catalyst',
    'uul-netols-catalyst',
    'reaver-catalyst',
    'sibilant-catalyst',
    'chayulas-catalyst',
    'skittering-catalyst',
    'necrotic-catalyst',
    'refined-flesh-catalyst',
    'refined-neural-catalyst',
    'refined-carapace-catalyst',
    'refined-uul-netols-catalyst',
    'refined-xophs-catalyst',
    'refined-tuls-catalyst',
    'refined-eshs-catalyst',
    'refined-chayulas-catalyst',
    'refined-reaver-catalyst',
    'refined-sibilant-catalyst',
    'refined-skittering-catalyst',
    'refined-adaptive-catalyst',
    'refined-necrotic-catalyst',
    'breachlord-sac'
].map(function(id, index) {
    return [id, index];
}));
const ABYSS_SORT_ORDER = new Map([
    'gnawed-jawbone',
    'preserved-jawbone',
    'ancient-jawbone',
    'gnawed-rib',
    'preserved-rib',
    'ancient-rib',
    'gnawed-collarbone',
    'preserved-collarbone',
    'ancient-collarbone',
    'preserved-cranium',
    'preserved-vertebrae',
    'altered-collarbone',
    'omen-of-abyssal-echoes',
    'omen-of-the-sovereign',
    'omen-of-the-liege',
    'omen-of-the-blackblooded',
    'omen-of-putrefaction',
    'omen-of-light',
    'omen-of-sinistral-necromancy',
    'omen-of-dextral-necromancy',
    'kulemaks-invitation',
    'amanamus-gaze',
    'tecrods-gaze',
    'kurgals-gaze',
    'ulamans-gaze'
].map(function(id, index) {
    return [id, index];
}));
const RITUAL_SORT_ORDER = new Map([
    'omen-of-refreshment',
    'omen-of-resurgence',
    'omen-of-amelioration',
    'omen-of-sinistral-exaltation',
    'omen-of-dextral-exaltation',
    'omen-of-catalysing-exaltation',
    'omen-of-whittling',
    'omen-of-sinistral-erasure',
    'omen-of-dextral-erasure',
    'omen-of-chaotic-rarity',
    'omen-of-chaotic-quantity',
    'omen-of-chaotic-monsters',
    'omen-of-chaotic-effectiveness',
    'omen-of-sinistral-annulment',
    'omen-of-dextral-annulment',
    'omen-of-chance',
    'omen-of-the-ancients',
    'omen-of-dextral-crystallisation',
    'omen-of-sinistral-crystallisation',
    'omen-of-greater-exaltation',
    'omen-of-the-blessed',
    'omen-of-sanctification',
    'omen-of-gambling',
    'omen-of-bartering',
    'omen-of-answered-prayers',
    'omen-of-the-hunt',
    'omen-of-reinforcements',
    'omen-of-secret-compartments',
    'head-of-the-king',
    'an-audience-with-the-king'
].map(function(id, index) {
    return [id, index];
}));
const SOUL_CORE_SORT_ORDER = new Map([
    'soul-core-of-topotante',
    'soul-core-of-tacati',
    'soul-core-of-opiloti',
    'soul-core-of-jiquani',
    'soul-core-of-zalatl',
    'soul-core-of-citaqualotl',
    'soul-core-of-puhuarte',
    'soul-core-of-tzamoto',
    'soul-core-of-xopec',
    'soul-core-of-quipolatl',
    'soul-core-of-ticaba',
    'soul-core-of-atmohua',
    'soul-core-of-cholotl',
    'soul-core-of-zantipi',
    'soul-core-of-azcapa',
    'atmohuas-soul-core-of-retreat',
    'hayoxis-soul-core-of-heatproofing',
    'zalatls-soul-core-of-insulation',
    'topotantes-soul-core-of-dampening',
    'opilotis-soul-core-of-assault',
    'guatelitzis-soul-core-of-endurance',
    'xopecs-soul-core-of-power',
    'xipocados-soul-core-of-dominion',
    'citaqualotls-soul-core-of-foulness',
    'cholotls-soul-core-of-war',
    'tacatis-soul-core-of-affliction',
    'quipolatls-soul-core-of-flow',
    'tzamotos-soul-core-of-ferocity',
    'uromotis-soul-core-of-attenuation',
    'estazuntis-soul-core-of-convalescence'
].map(function(id, index) {
    return [id, index];
}));
const BASIC_RUNE_SORT_ORDER = new Map([
    'lesser-desert-rune',
    'desert-rune',
    'greater-desert-rune',
    'lesser-glacial-rune',
    'glacial-rune',
    'greater-glacial-rune',
    'lesser-storm-rune',
    'storm-rune',
    'greater-storm-rune',
    'lesser-iron-rune',
    'iron-rune',
    'greater-iron-rune',
    'lesser-body-rune',
    'body-rune',
    'greater-body-rune',
    'lesser-mind-rune',
    'mind-rune',
    'greater-mind-rune',
    'lesser-vision-rune',
    'vision-rune',
    'greater-vision-rune',
    'lesser-rebirth-rune',
    'rebirth-rune',
    'greater-rebirth-rune',
    'lesser-inspiration-rune',
    'inspiration-rune',
    'greater-inspiration-rune',
    'lesser-stone-rune',
    'stone-rune',
    'greater-stone-rune',
    'lesser-robust-rune',
    'robust-rune',
    'greater-robust-rune',
    'lesser-adept-rune',
    'adept-rune',
    'greater-adept-rune',
    'lesser-resolve-rune',
    'resolve-rune',
    'greater-resolve-rune',
    'masterwork-rune',
    'lesser-ward-rune',
    'ward-rune',
    'greater-ward-rune',
    'lesser-charging-rune',
    'charging-rune',
    'greater-charging-rune'
].map(function(id, index) {
    return [id, index];
}));
const GREATER_RUNE_SORT_ORDER = new Map([
    'greater-rune-of-leadership',
    'greater-rune-of-tithing',
    'greater-rune-of-alacrity',
    'greater-rune-of-nobility',
    'farruls-rune-of-the-hunt',
    'thane-myrks-rune-of-summer',
    'lady-hestras-rune-of-winter',
    'thane-lelds-rune-of-spring',
    'fenumus-rune-of-agony',
    'thane-girts-rune-of-wildness',
    'hedgewitch-assandras-rune-of-wisdom',
    'saqawals-rune-of-the-sky',
    'the-greatwolfs-rune-of-willpower',
    'craiceanns-rune-of-recovery',
    'craiceanns-rune-of-warding',
    'countess-seskes-rune-of-archery',
    'saqawals-rune-of-erosion',
    'saqawals-rune-of-memory',
    'the-greatwolfs-rune-of-claws',
    'courtesan-mannans-rune-of-cruelty',
    'thane-grannells-rune-of-mastery',
    'fenumus-rune-of-spinning',
    'fenumus-rune-of-draining',
    'farruls-rune-of-grace',
    'farruls-rune-of-the-chase',
    'ancient-rune-of-splinters',
    'ancient-rune-of-dueling',
    'ancient-rune-of-the-titan',
    'ancient-rune-of-shattering',
    'ancient-rune-of-prowess',
    'ancient-rune-of-control',
    'ancient-rune-of-discovery',
    'ancient-rune-of-decay',
    'ancient-rune-of-witchcraft',
    'ancient-rune-of-the-horde',
    'ancient-rune-of-animosity',
    'ancient-rune-of-detonation',
    'ancient-rune-of-retaliation',
    'rune-of-vitality',
    'rune-of-the-hunt',
    'rune-of-acrobatics',
    'rune-of-culmination',
    'rune-of-renown',
    'rune-of-accumulation',
    'rune-of-foundations',
    'rune-of-the-prism',
    'rune-of-the-blossom',
    'rune-of-consistency',
    'rune-of-reach',
    'rune-of-vital-flame',
    'rune-of-confrontation',
    'warding-rune-of-reinforcement',
    'warding-rune-of-protection',
    'warding-rune-of-disintegration',
    'warding-rune-of-desperation',
    'warding-rune-of-symbiosis',
    'warding-rune-of-courage',
    'warding-rune-of-stability',
    'warding-rune-of-glancing',
    'warding-rune-of-heart',
    'warding-rune-of-nourishment',
    'warding-rune-of-annihilation',
    'warding-rune-of-armature',
    'warding-rune-of-obsession',
    'warding-rune-of-equinox',
    'warding-rune-of-salvaging',
    'warding-rune-of-bodyguards',
    'warding-rune-of-hollowing',
    'emergent-vigour',
    'emergent-possibility',
    'emergent-protection',
    'emergent-instinct',
    'serles-triumph',
    'cadigans-epiphany',
    'astrids-creativity',
    'uhtreds-sidereus',
    'kolrs-hunt',
    'voranas-carnage',
    'thruds-might',
    'medveds-tending',
    'katlas-gloom',
    'aldurs-legacy',
    'passion-of-aldur',
    'breath-of-aldur',
    'ire-of-aldur',
    'betrayal-of-aldur'
].map(function(id, index) {
    return [id, index];
}));
const IDOL_SORT_ORDER = new Map([
    'bear-idol',
    'primate-idol',
    'stag-idol',
    'boar-idol',
    'snake-idol',
    'wolf-idol',
    'cat-idol',
    'owl-idol',
    'ox-idol',
    'fox-idol',
    'rabbit-idol',
    'idol-of-thruldana',
    'idol-of-maxarius',
    'idol-of-eeshta',
    'idol-of-egrin',
    'idol-of-ralakesh',
    'idol-of-sirrius',
    'idol-of-grold',
    'idol-of-greust',
    'idol-of-yeena',
    'idol-of-eramir',
    'idol-of-oak',
    'idol-of-alira',
    'idol-of-kraityn',
    'idol-of-silk',
    'idol-of-the-sycophant',
    'idol-of-the-martyr',
    'idol-of-the-pharisee',
    'carved-cunning',
    'carved-majesty',
    'carved-mischief',
    'carved-tenacity'
].map(function(id, index) {
    return [id, index];
}));
const ABYSS_OMEN_IDS = new Set([
    'omen-of-abyssal-echoes',
    'omen-of-the-sovereign',
    'omen-of-the-liege',
    'omen-of-the-blackblooded',
    'omen-of-putrefaction',
    'omen-of-light',
    'omen-of-sinistral-necromancy',
    'omen-of-dextral-necromancy'
]);
const RITUAL_SPECIAL_OMEN_IDS = new Set([
    'omen-of-answered-prayers',
    'omen-of-the-hunt',
    'omen-of-reinforcements',
    'omen-of-secret-compartments'
]);

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
                description: product.description || metadata.description,
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

            if (shouldExcludeMarketProduct(id)) {
                itemSortOrder += 1;
                continue;
            }

            const mapped = mapOfficialMarketProduct(group.id, group.label, currentSubCategory, label, id, itemSortOrder);

            products.push({
                id: id,
                label: label,
                category: mapped.category,
                sourceCategory: String(group.id || ''),
                subCategory: mapped.subCategory,
                subCategoryOrder: getSubCategoryOrder(mapped.category, mapped.subCategory),
                description: String(entry.description || entry.descrText || entry.tooltip || '').trim(),
                iconUrl: new URL(image, POE2_OFFICIAL_IMAGE_ROOT).toString(),
                sortOrder: Number.isFinite(Number(mapped.sortOrder)) ? Number(mapped.sortOrder) : itemSortOrder
            });
            itemSortOrder += 1;
        }
    }

    return products;
}

function shouldExcludeMarketProduct(id) {
    const productId = String(id || '').trim();

    return EXCLUDED_MARKET_PRODUCT_IDS.has(productId)
        || productId.startsWith('legacy-of-');
}

function mapOfficialMarketProduct(groupId, groupLabel, subCategory, label, id, itemSortOrder) {
    const key = String(groupId || '');
    const section = String(subCategory || '').trim();
    const text = String(label || '');
    const productId = String(id || '').trim();

    if (key === 'Vaal') {
        if (section === 'オーグメント') {
            return {
                category: 'Incursion',
                subCategory: 'ソウルコア',
                sortOrder: itemSortOrder
            };
        }

        if (section === 'ソウルコア') {
            return {
                category: 'SoulCores',
                subCategory: 'ソウルコア',
                sortOrder: SOUL_CORE_SORT_ORDER.get(productId) ?? itemSortOrder
            };
        }

        return {
            category: 'Incursion',
            subCategory: 'カレンシー',
            sortOrder: itemSortOrder
        };
    }

    if (key === 'Ritual') {
        if (section === 'アイドル') {
            return {
                category: 'Idols',
                subCategory: getIdolSubCategory(productId),
                sortOrder: getIdolSortOrder(productId, itemSortOrder)
            };
        }

        if (ABYSS_OMEN_IDS.has(productId)) {
            return {
                category: 'Abyss',
                subCategory: 'お告げ',
                sortOrder: ABYSS_SORT_ORDER.get(productId) ?? itemSortOrder
            };
        }

        if (productId === 'raven-touched-shard') {
            return {
                category: 'Delirium',
                subCategory: 'デリリウム',
                sortOrder: DELIRIUM_SORT_ORDER.get(productId) ?? itemSortOrder
            };
        }

        if (productId === 'call-of-the-shadows') {
            return {
                category: 'Fragments',
                subCategory: 'ピナクルフラグメント',
                sortOrder: FRAGMENT_SORT_ORDER.get(productId) ?? itemSortOrder
            };
        }

        return {
            category: 'Ritual',
            subCategory: getRitualSubCategory(productId, section),
            sortOrder: RITUAL_SORT_ORDER.get(productId) ?? itemSortOrder
        };
    }

    if (key === 'Fragments') {
        if (productId === 'runic-splinter') {
            return {
                category: 'Expedition',
                subCategory: 'エクスペディション',
                sortOrder: 1
            };
        }

        if (productId === 'kulemaks-invitation') {
            return {
                category: 'Abyss',
                subCategory: 'ピナクルフラグメント',
                sortOrder: ABYSS_SORT_ORDER.get(productId) ?? itemSortOrder
            };
        }

        if (productId === 'breachlord-sac') {
            return {
                category: 'Breach',
                subCategory: 'ピナクルフラグメント',
                sortOrder: BREACH_SORT_ORDER.get(productId) ?? itemSortOrder
            };
        }

        if (productId === 'idol-of-estazunti') {
            return {
                category: 'Idols',
                subCategory: 'アイドル',
                sortOrder: 1000
            };
        }

        return {
            category: 'Fragments',
            subCategory: section || 'フラグメント',
            sortOrder: FRAGMENT_SORT_ORDER.get(productId) ?? itemSortOrder
        };
    }

    if (key === 'Idol') {
        return {
            category: 'Idols',
            subCategory: 'アイドル',
            sortOrder: itemSortOrder
        };
    }

    if (key === 'Verisium') {
        return {
            category: 'Expedition',
            subCategory: getVerisiumSubCategory(text),
            sortOrder: itemSortOrder + 100
        };
    }

    if (key === 'Ultimatum') {
        return {
            category: 'SoulCores',
            subCategory: 'ソウルコア',
            sortOrder: itemSortOrder
        };
    }

    if (key === 'Abyss') {
        return {
            category: 'Abyss',
            subCategory: productId.endsWith('-gaze') ? 'アビサルアイ' : 'アビスの骨',
            sortOrder: ABYSS_SORT_ORDER.get(productId) ?? itemSortOrder
        };
    }

    if (key === 'Currency') {
        return {
            category: 'Currency',
            subCategory: getCurrencySubCategory(productId),
            sortOrder: CURRENCY_SORT_ORDER.get(productId) ?? itemSortOrder
        };
    }

    if (key === 'Essences') {
        return {
            category: 'Essences',
            subCategory: getEssenceSubCategory(productId),
            sortOrder: itemSortOrder
        };
    }

    if (key === 'Runes') {
        return {
            category: 'Runes',
            subCategory: getRuneSubCategory(productId, itemSortOrder),
            sortOrder: getRuneSortOrder(productId, itemSortOrder)
        };
    }

    if (key === 'Expedition') {
        if (productId.startsWith('thaumaturgic-flux-')) {
            return {
                category: 'Currency',
                subCategory: 'カレンシー',
                sortOrder: CURRENCY_SORT_ORDER.get(productId) ?? itemSortOrder
            };
        }

        if (productId.startsWith('emergent-')) {
            return {
                category: 'Runes',
                subCategory: 'グレータールーン',
                sortOrder: GREATER_RUNE_SORT_ORDER.get(productId) ?? itemSortOrder
            };
        }

        if (productId.startsWith('carved-')) {
            return {
                category: 'Idols',
                subCategory: 'リチュアル',
                sortOrder: getIdolSortOrder(productId, itemSortOrder)
            };
        }

        return {
            category: 'Expedition',
            subCategory: getExpeditionSubCategory(productId, section),
            sortOrder: itemSortOrder
        };
    }

    if (key === 'Breach') {
        return {
            category: 'Breach',
            subCategory: section || 'ブリーチ',
            sortOrder: BREACH_SORT_ORDER.get(productId) ?? itemSortOrder
        };
    }

    if (key === 'Delirium') {
        return {
            category: 'Delirium',
            subCategory: section || 'デリリウム',
            sortOrder: DELIRIUM_SORT_ORDER.get(productId) ?? itemSortOrder
        };
    }

    if (key === 'UncutGems') {
        return {
            category: 'UncutGems',
            subCategory: section || 'ジェムの原石',
            sortOrder: itemSortOrder
        };
    }

    if (key === 'LineageSupportGems') {
        return {
            category: 'LineageSupportGems',
            subCategory: 'リネージュサポートジェム',
            sortOrder: itemSortOrder
        };
    }

    return {
        category: key,
        subCategory: section || String(groupLabel || key),
        sortOrder: itemSortOrder
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

function getExpeditionSubCategory(id, section) {
    if (id.endsWith('-saga')) {
        return 'お告げ';
    }

    return section || 'エクスペディション';
}

function getCurrencySubCategory(id) {
    if (id === 'wisdom') {
        return '鑑定カレンシー';
    }

    if (id.endsWith('-jewellers-orb')) {
        return '宝飾職人のカレンシー';
    }

    if (id.endsWith('-shard')) {
        return 'カレンシーシャード';
    }

    if (['scrap', 'whetstone', 'etcher', 'bauble', 'gcp'].includes(id)) {
        return '品質カレンシー';
    }

    return 'カレンシー';
}

function getEssenceSubCategory(id) {
    if (id.startsWith('lesser-')) {
        return 'レッサーエッセンス';
    }

    if (id.startsWith('greater-')) {
        return 'グレーターエッセンス';
    }

    if (id.startsWith('perfect-')) {
        return 'パーフェクトエッセンス';
    }

    if (id.includes('hysteria')
        || id.includes('insanity')
        || id.includes('horror')
        || id.includes('delirium')
        || id.includes('abyss')
        || id.includes('breach')) {
        return 'コラプトエッセンス';
    }

    return 'エッセンス';
}

function getRuneSubCategory(id, itemSortOrder) {
    if (isBasicRune(id, itemSortOrder)) {
        return 'ルーン';
    }

    if (id.startsWith('perfect-')) {
        return 'パーフェクトルーン';
    }

    if (isGreaterRune(id, itemSortOrder)) {
        return 'グレータールーン';
    }

    return 'ルーン';
}

function getRuneSortOrder(id, itemSortOrder) {
    if (isBasicRune(id)) {
        return BASIC_RUNE_SORT_ORDER.get(id) ?? itemSortOrder;
    }

    if (isGreaterRune(id, itemSortOrder)) {
        return GREATER_RUNE_SORT_ORDER.get(id) ?? itemSortOrder;
    }

    return itemSortOrder;
}

function isBasicRune(id) {
    return BASIC_RUNE_SORT_ORDER.has(id);
}

function isGreaterRune(id) {
    return GREATER_RUNE_SORT_ORDER.has(id);
}

function getIdolSubCategory(id) {
    return id.startsWith('idol-of-the-')
        ? 'リチュアル'
        : 'アイドル';
}

function getIdolSortOrder(id, itemSortOrder) {
    return IDOL_SORT_ORDER.get(id) ?? itemSortOrder;
}

function getRitualSubCategory(id, section) {
    if (RITUAL_SPECIAL_OMEN_IDS.has(id)) {
        return '特殊お告げ';
    }

    return section || 'ピナクルフラグメント';
}

function getSubCategoryOrder(category, subCategory) {
    const order = {
        Idols: ['アイドル', 'リチュアル'],
        Incursion: ['カレンシー', 'ソウルコア'],
        Abyss: ['アビスの骨', 'お告げ', 'ピナクルフラグメント', 'アビサルアイ'],
        Expedition: ['エクスペディション', 'お告げ', 'ヴェリシウム', '合金', 'フラックス', '星明りの鉱石'],
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
