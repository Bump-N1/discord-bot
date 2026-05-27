const ICON_ROOT = 'https://www.pathofexile.com';

export const POE2_MARKET_BASE_CURRENCY_ID = 'exalted';
export const POE2_MARKET_DIVINE_CURRENCY_ID = 'divine';
export const POE2_MARKET_MAX_PRODUCTS = 12;
export const POE2_MARKET_DEFAULT_POST_INTERVAL_HOURS = 1;
export const POE2_MARKET_MIN_POST_INTERVAL_HOURS = 1;
export const POE2_MARKET_MAX_POST_INTERVAL_HOURS = 24;
export const POE2_MARKET_CATEGORIES = [
    {
        key: 'Currency',
        label: 'カレンシー'
    },
    {
        key: 'Essences',
        label: 'エッセンス'
    },
    {
        key: 'Delirium',
        label: 'デリリウム'
    },
    {
        key: 'Breach',
        label: 'ブリーチ'
    },
    {
        key: 'Ritual',
        label: 'リチュアル'
    },
    {
        key: 'Expedition',
        label: 'エクスペディション'
    },
    {
        key: 'Abyss',
        label: 'アビス'
    },
    {
        key: 'Incursion',
        label: 'インカージョン'
    },
    {
        key: 'Fragments',
        label: 'フラグメント'
    },
    {
        key: 'Runes',
        label: 'ルーン'
    },
    {
        key: 'SoulCores',
        label: 'ソウルコア'
    },
    {
        key: 'Idols',
        label: 'アイドル'
    },
    {
        key: 'UncutGems',
        label: 'ジェムの原石'
    },
    {
        key: 'LineageSupportGems',
        label: 'ジェム'
    }
];

const KNOWN_PRODUCTS = {
    exalted: {
        label: '高貴なオーブ',
        category: 'Currency',
        iconUrl: `${ICON_ROOT}/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/ad7c366789/CurrencyAddModToRare.png`
    },
    chaos: {
        label: 'カオスオーブ',
        category: 'Currency',
        iconUrl: `${ICON_ROOT}/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lSZXJvbGxSYXJlIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c0ca392a78/CurrencyRerollRare.png`
    },
    annul: {
        label: '消去のオーブ',
        category: 'Currency',
        iconUrl: `${ICON_ROOT}/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQW5udWxsT3JiIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/2daba8ccca/AnnullOrb.png`
    },
    divine: {
        label: '神のオーブ',
        category: 'Currency',
        iconUrl: `${ICON_ROOT}/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/2986e220b3/CurrencyModValues.png`
    },
    'uncut-skill-gem-20': {
        label: 'スキルジェムの原石 (レベル20)',
        category: 'UncutGems',
        iconUrl: `${ICON_ROOT}/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvR2Vtcy9VbmN1dFNraWxsR2VtIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/97f0ceba15/UncutSkillGem.png`
    },
    'uncut-spirit-gem-20': {
        label: 'スピリットジェムの原石 (レベル20)',
        category: 'UncutGems',
        iconUrl: `${ICON_ROOT}/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvR2Vtcy9VbmN1dFNraWxsR2VtQnVmZiIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/ab25e9aa3b/UncutSkillGemBuff.png`
    },
    'architects-orb': {
        label: 'アーキテクトオーブ',
        category: 'Incursion'
    },
    'crystallised-corruption': {
        label: 'コラプトの結晶',
        category: 'Incursion'
    },
    'core-destabiliser': {
        label: 'コア不安定化装置',
        category: 'Incursion'
    },
    'ancient-infuser': {
        label: '古代のインフューザー',
        category: 'Incursion'
    },
    'vaal-cultivation-orb': {
        label: 'ヴァール培養のオーブ',
        category: 'Incursion'
    },
    'vaal-infuser': {
        label: 'ヴァールインフューザー',
        category: 'Incursion'
    },
    'orb-of-extraction': {
        label: '抽出のオーブ',
        category: 'Incursion'
    },
    'vaal-siphoner': {
        label: 'ヴァールサイフォナー',
        category: 'Incursion'
    }
};

export function getKnownPoe2MarketProducts() {
    return Object.keys(KNOWN_PRODUCTS).map(function(id) {
        return createPoe2MarketProduct(id);
    });
}

export function createPoe2MarketProduct(id, fields = {}) {
    const known = KNOWN_PRODUCTS[id] || {};

    return {
        id: String(id),
        label: String(fields.label || known.label || formatProductId(id)),
        category: String(fields.category || known.category || 'Currency'),
        iconUrl: String(fields.iconUrl || known.iconUrl || '')
    };
}

export function getQuoteCurrencyProducts() {
    return [
        createPoe2MarketProduct(POE2_MARKET_BASE_CURRENCY_ID),
        createPoe2MarketProduct(POE2_MARKET_DIVINE_CURRENCY_ID)
    ];
}

function formatProductId(id) {
    return String(id || '')
        .split('-')
        .filter(Boolean)
        .map(function(part) {
            if (/^lv\d+$/iu.test(part)) {
                return part.replace(/^lv/iu, 'Lv');
            }

            return `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
        })
        .join(' ');
}
