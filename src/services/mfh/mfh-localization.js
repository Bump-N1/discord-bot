export const MFH_CATEGORY_LABELS = {
    weapons: '武器',
    armor: '防具',
    skills: 'スキル',
    talents: 'タレント',
    items: 'アイテム',
    gems: 'ジェム'
};

const VALUE_LABELS = {
    // Classes
    Mercenary: 'マーセナリー',
    Shadowstrix: 'シャドウストリクス',
    Sorcerer: 'ソーサラー',
    Seer: 'シーア',
    Blackarrow: 'ブラックアロー',
    Werewolf: 'ウェアウルフ',

    // Rarities
    Common: 'コモン',
    Uncommon: 'アンコモン',
    Rare: 'レア',
    Epic: 'エピック',
    Legendary: 'レジェンダリー',
    Mythic: 'ミシック',

    // Equipment slots / types
    Head: '頭',
    Chest: '胴',
    Hands: '手',
    Legs: '脚',
    Feet: '足',
    Necklace: '首飾り',
    Ring: '指輪',
    Dagger: 'ダガー',
    Staff: 'スタッフ',
    Bow: '弓',
    'Sword and Shield': 'ソード&シールド',
    Greatsword: 'グレートソード',
    Polearm: 'ポールアーム',
    'Shared Staff Skills': 'スタッフ共通スキル',
    'Shared Dagger Skills': 'ダガー共通スキル'
};

const FIELD_LABELS = {
    Weapon: '武器',
    Armor: '防具',
    Skill: 'スキル',
    Talent: 'タレント',
    Item: 'アイテム',
    Gem: 'ジェム',
    Type: '種類',
    Slot: '部位',
    Class: 'クラス',
    Rarity: 'レアリティ',
    Attack: '攻撃力',
    Combat: '戦闘力',
    'Combat value': '戦闘力',
    Durability: '耐久',
    'Repair coefficient': '修理係数',
    'Minimum price': '最低価格',
    'Maximum price': '最高価格',
    'Suggested price': '目安価格',
    'School / weapon': '系統 / 武器',
    Cooldown: 'クールダウン',
    Cost: 'コスト',
    Effects: '効果',
    Effect: '効果',
    Category: 'カテゴリ',
    Source: '入手元',
    Use: '用途',
    Level: 'レベル',
    Affixes: 'アフィックス',
    Health: '体力'
};

export function getMfhCategoryLabel(key) {
    return MFH_CATEGORY_LABELS[key] || key;
}

export function localizeMfhValue(value) {
    const text = String(value || '').trim();

    if (!text) {
        return '';
    }

    return VALUE_LABELS[text] || text;
}

export function localizeMfhFieldLabel(label) {
    const text = String(label || '').trim();

    if (!text) {
        return '';
    }

    return FIELD_LABELS[text] || text;
}

export function localizeMfhTags(tags) {
    return (Array.isArray(tags) ? tags : [])
        .map(localizeMfhValue)
        .filter(Boolean);
}
