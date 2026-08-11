import fs from 'node:fs';
import path from 'node:path';

export const MFH_CATEGORY_LABELS = {
    weapons: '武器',
    armor: '防具',
    skills: 'スキル',
    talents: 'タレント',
    items: 'アイテム',
    gems: 'ジェム'
};

const VALUE_LABELS = {
    Mercenary: '傭兵',
    Shadowstrix: 'シャドーアウル',
    Sorcerer: '魔法使い',
    Seer: '預言者',
    Blackarrow: 'ブラックアロー',
    Werewolf: 'ウェアウルフ',

    Common: 'コモン',
    Uncommon: 'アンコモン',
    Rare: 'アンコモン',
    Excellent: 'レア',
    Epic: 'エピック',
    Legendary: 'レジェンダリー',
    Mythic: 'ミシック',

    Head: '頭',
    Chest: '胴',
    Hands: '手',
    Legs: '脚',
    Feet: '足',
    Necklace: '首飾り',
    Ring: '指輪',
    Dagger: '短剣',
    Staff: '杖',
    Bow: '弓',
    'Sword and Shield': '剣と盾',
    Greatsword: '大剣',
    Polearm: '長柄武器',
    Material: '素材',
    'Construction Material': '建設素材',
    'Forging Material': '鍛造素材',
    Yes: '可能',
    No: '不可',
    True: '可能',
    False: '不可',
    Brandrgarde: 'ブランダール要塞',
    'Mine Pit': '鉱山',
    'Goddess Statue Shop': '女神像ショップ',
    'Raffle Ticket': '抽選券',
    Hammer: 'ハンマー',
    Energy: 'エネルギー',
    Physical: '物理',
    Toughness: '強靭度',
    Slow: '減速',
    'dodge distance': '回避距離',
    'Super Armor level': '剛体レベル',
    'Damage resistance': 'ダメージ耐性',
    'physical damage reduction': '物理ダメージ軽減',
    'critical damage reduction': 'クリティカルダメージ軽減',
    duration: '持続時間',
    'maximum stacks': '最大スタック',
    Level: 'レベル',
    'Shared Staff Skills': '杖共通スキル',
    'Shared Dagger Skills': '短剣共通スキル'
};

const VALUE_TERM_LABELS = {
    Gyldenblod: '砂金',
    Energy: 'エネルギー',
    Physical: '物理',
    Toughness: '強靭度',
    Slow: '減速',
    'dodge distance': '回避距離',
    'Super Armor level': '剛体レベル',
    'Damage resistance': 'ダメージ耐性',
    'physical damage reduction': '物理ダメージ軽減',
    'critical damage reduction': 'クリティカルダメージ軽減',
    duration: '持続時間',
    'maximum stacks': '最大スタック',
    Level: 'レベル'
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
    Durability: '耐久値',
    'Repair coefficient': '修理係数',
    'Minimum price': '最低価格',
    'Maximum price': '最高価格',
    'Suggested price': '推奨価格',
    'School / weapon': '系統 / 武器',
    Cooldown: 'クールダウン',
    Cost: 'コスト',
    Effects: '効果',
    Effect: '効果',
    Category: '種類',
    Source: '入手先',
    Use: '用途',
    Tradable: '取引',
    'Stack limit': '所持上限',
    'Stash stack limit': '保管庫上限',
    'Building upgrades': '強化対象',
    Level: 'レベル',
    Affixes: 'アフィックス',
    Health: '体力',
    'Physical damage': '物理ダメージ',
    'Magical damage': '魔法ダメージ',
    'Physical Reduction': '物理ダメージ軽減',
    'Magic Reduction': '魔法ダメージ軽減',
    Defense: '防御力',
    'Forging cost': '鍛造費用',
    Branch: '分岐',
    'Effect Magnitude': '効果量',
    'Talent branch': 'タレント分岐',
    'Unlock level': '解放レベル',
    Ranks: 'ランク',
    'Gem level': 'ジェムレベル'
};

let cachedLocalData = null;
let cachedLocalPathKey = '';

export function getMfhCategoryLabel(key) {
    return MFH_CATEGORY_LABELS[key] || key;
}

export function localizeMfhValue(value) {
    const text = String(value || '').trim();

    if (!text) {
        return '';
    }

    const localData = loadMfhLocalData();
    const normalized = normalizeMfhLookupText(text);

    return localData.valueLabels.get(normalized)
        || VALUE_LABELS[text]
        || localizeMfhValueTerms(text);
}

export function localizeMfhFieldLabel(label) {
    const text = String(label || '').trim();

    if (!text) {
        return '';
    }

    const localData = loadMfhLocalData();
    const normalized = normalizeMfhLookupText(text);

    return localData.fieldLabels.get(normalized) || FIELD_LABELS[text] || text;
}

export function localizeMfhTags(tags) {
    return (Array.isArray(tags) ? tags : [])
        .map(localizeMfhValue)
        .filter(Boolean);
}

export function hasMfhLocalDictionary() {
    return loadMfhLocalData().entriesByKey.size > 0;
}

export function looksLikeJapaneseMfhText(value) {
    return /[\u3040-\u30ff\u3400-\u9fff]/u.test(String(value || ''));
}

export function searchMfhLocalEntries(keyword, limit = 25) {
    const query = normalizeMfhLookupText(keyword);

    if (!query) {
        return [];
    }

    const localData = loadMfhLocalData();

    return Array.from(localData.autocompleteEntries.values())
        .map(function(entry) {
            return {
                entry: entry,
                score: getLocalEntrySearchScore(entry, query)
            };
        })
        .filter(function(item) {
            return item.score !== null;
        })
        .sort(function(left, right) {
            return left.score - right.score
                || left.entry.name.localeCompare(right.entry.name, 'ja-JP');
        })
        .slice(0, limit)
        .map(function(item) {
            return item.entry;
        });
}

export function applyMfhLocalEntry(entry) {
    const localData = loadMfhLocalData();
    const localEntry = findLocalEntry(localData, entry);
    const localizedTags = uniqueValues([
        ...(entry.localizedTags || []),
        ...localizeMfhTags(entry.tags || []),
        ...(localEntry?.tags || [])
    ]);

    if (!localEntry) {
        const localizedName = localData.valueLabels.get(normalizeMfhLookupText(entry.name)) || '';
        const displayName = entry.displayName || localizedName || entry.name;
        const aliases = uniqueValues([
            ...(entry.aliases || []),
            localizedName ? entry.name : ''
        ]);

        return {
            ...entry,
            displayName: displayName,
            localizedName: entry.localizedName || localizedName,
            aliases: aliases,
            localizedTags: localizedTags,
            searchText: buildLocalizedSearchText({
                ...entry,
                displayName: displayName,
                localizedName: entry.localizedName || localizedName,
                aliases: aliases
            }, localizedTags)
        };
    }

    const localizedName = localEntry.name || entry.localizedName || '';
    const displayName = localizedName || entry.displayName || entry.name;
    const aliases = uniqueValues([
        ...(entry.aliases || []),
        ...(localEntry.aliases || []),
        localEntry.sourceName
    ]);
    const description = localEntry.description || entry.description || '';
    const subName = localEntry.subName || entry.subName || '';
    const usage = localEntry.usage || entry.usage || '';

    return {
        ...entry,
        displayName: displayName,
        localizedName: localizedName,
        aliases: aliases,
        localizedTags: localizedTags,
        description: description,
        subName: subName,
        usage: usage,
        searchText: buildLocalizedSearchText({
            ...entry,
            displayName: displayName,
            localizedName: localizedName,
            aliases: aliases,
            description: description,
            subName: subName,
            usage: usage
        }, localizedTags)
    };
}

export function normalizeMfhLookupText(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[’‘´`]/gu, "'")
        .replace(/[\s_\-:：/\\()[\]{}（）「」『』【】"'.,，。、・･]/gu, '');
}

function loadMfhLocalData() {
    const localPaths = getMfhLocalDataPaths();
    const pathKey = getMfhLocalPathKey(localPaths);

    if (cachedLocalData && cachedLocalPathKey === pathKey) {
        return cachedLocalData;
    }

    const localData = createEmptyLocalData();

    for (const localPath of localPaths) {
        mergeLocalDataFile(localData, localPath);
    }

    cachedLocalData = localData;
    cachedLocalPathKey = pathKey;

    return localData;
}

function getMfhLocalPathKey(localPaths) {
    return localPaths.map(function(localPath) {
        try {
            const stats = fs.statSync(localPath);

            return `${localPath}:${stats.mtimeMs}:${stats.size}`;
        } catch (error) {
            return `${localPath}:missing`;
        }
    }).join('|');
}

function getMfhLocalDataPaths() {
    return [
        path.join(process.cwd(), 'src', 'data', 'mfh-localization-ja.json'),
        path.join(process.cwd(), 'data', 'mfh-localization.local.json'),
        path.join(process.cwd(), 'data', 'mfh', 'localization-ja.local.json'),
        process.env.MFH_LOCALIZATION_PATH
    ].filter(Boolean);
}

function createEmptyLocalData() {
    const localData = {
        entriesByKey: new Map(),
        autocompleteEntries: new Map(),
        valueLabels: new Map(),
        fieldLabels: new Map()
    };

    mergeLabelMap(localData.valueLabels, VALUE_LABELS);
    mergeLabelMap(localData.fieldLabels, FIELD_LABELS);

    return localData;
}

function mergeLocalDataFile(localData, localPath) {
    if (!localPath || !fs.existsSync(localPath)) {
        return;
    }

    let payload;

    try {
        payload = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    } catch (error) {
        console.warn(`MFH local localization could not be loaded: ${localPath}`, error.message);
        return;
    }

    mergeEntryList(localData, payload.entries);
    mergeNamesMap(localData, payload.names);
    mergeLabelMap(localData.valueLabels, payload.values);
    mergeLabelMap(localData.valueLabels, payload.tags);
    mergeLabelMap(localData.fieldLabels, payload.fields);
}

function mergeEntryList(localData, entries) {
    if (!Array.isArray(entries)) {
        return;
    }

    for (const entry of entries) {
        registerLocalEntry(localData, normalizeLocalEntry(entry));
    }
}

function mergeNamesMap(localData, names) {
    if (!names || typeof names !== 'object' || Array.isArray(names)) {
        return;
    }

    for (const [sourceName, value] of Object.entries(names)) {
        if (typeof value === 'string') {
            registerLocalEntry(localData, normalizeLocalEntry({
                id: sourceName,
                sourceName: sourceName,
                name: value
            }));
            continue;
        }

        if (value && typeof value === 'object') {
            registerLocalEntry(localData, normalizeLocalEntry({
                ...value,
                id: value.id || sourceName,
                sourceName: value.sourceName || sourceName
            }));
        }
    }
}

function mergeLabelMap(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return;
    }

    for (const [key, value] of Object.entries(source)) {
        if (!key || typeof value !== 'string' || !value.trim()) {
            continue;
        }

        target.set(normalizeMfhLookupText(key), value.trim());
    }
}

function normalizeLocalEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const name = firstText(entry.name, entry.ja, entry.jp, entry.displayName, entry.localizedName);
    const sourceName = firstText(entry.sourceName, entry.en, entry.englishName, entry.originalName);
    const id = firstText(entry.id, entry.key);

    if (!name && !sourceName && !id) {
        return null;
    }

    return {
        id: id,
        sourceName: sourceName,
        name: name,
        description: firstText(entry.description, entry.desc, entry.text),
        subName: firstText(entry.subName, entry.subtitle),
        usage: firstText(entry.usage, entry.use),
        aliases: toTextArray(entry.aliases),
        tags: toTextArray(entry.tags)
    };
}

function registerLocalEntry(localData, localEntry) {
    if (!localEntry) {
        return;
    }

    const keys = [
        localEntry.id,
        localEntry.sourceName,
        localEntry.name,
        ...localEntry.aliases
    ].map(normalizeMfhLookupText).filter(Boolean);

    for (const key of keys) {
        const current = localData.entriesByKey.get(key) || {};

        localData.entriesByKey.set(key, {
            id: localEntry.id || current.id || '',
            sourceName: localEntry.sourceName || current.sourceName || '',
            name: localEntry.name || current.name || '',
            description: localEntry.description || current.description || '',
            subName: localEntry.subName || current.subName || '',
            usage: localEntry.usage || current.usage || '',
            aliases: uniqueValues([...(current.aliases || []), ...localEntry.aliases]),
            tags: uniqueValues([...(current.tags || []), ...localEntry.tags])
        });
    }

    const autocompleteKey = normalizeMfhLookupText(localEntry.sourceName);

    if (autocompleteKey && localEntry.name) {
        const current = localData.autocompleteEntries.get(autocompleteKey) || {};

        localData.autocompleteEntries.set(autocompleteKey, {
            sourceName: localEntry.sourceName,
            name: localEntry.name || current.name || '',
            aliases: uniqueValues([...(current.aliases || []), ...localEntry.aliases])
        });
    }
}

function getLocalEntrySearchScore(entry, query) {
    const name = normalizeMfhLookupText(entry.name);
    const sourceName = normalizeMfhLookupText(entry.sourceName);
    const aliases = (entry.aliases || []).map(normalizeMfhLookupText);
    const values = [name, sourceName, ...aliases].filter(Boolean);

    if (values.some(function(value) { return value === query; })) {
        return 0;
    }

    if (values.some(function(value) { return value.startsWith(query); })) {
        return 1;
    }

    if (values.some(function(value) { return value.includes(query); })) {
        return 2;
    }

    return null;
}

function findLocalEntry(localData, entry) {
    const keys = [
        entry.id,
        entry.name,
        entry.displayName,
        entry.localizedName,
        entry.url,
        ...(entry.aliases || [])
    ].map(normalizeMfhLookupText).filter(Boolean);

    for (const key of keys) {
        const localEntry = localData.entriesByKey.get(key);

        if (localEntry) {
            return localEntry;
        }
    }

    return null;
}

function buildLocalizedSearchText(entry, localizedTags) {
    return [
        entry.searchText,
        entry.name,
        entry.displayName,
        entry.localizedName,
        entry.description,
        entry.subName,
        entry.usage,
        ...(entry.aliases || []),
        ...(entry.tags || []),
        ...(localizedTags || [])
    ].filter(Boolean).join(' ');
}

function firstText(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return '';
}

function toTextArray(value) {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value
            .map(function(item) {
                return String(item || '').trim();
            })
            .filter(Boolean);
    }

    if (typeof value === 'string') {
        return value
            .split(/[|,、，]/gu)
            .map(function(item) {
                return item.trim();
            })
            .filter(Boolean);
    }

    return [];
}

function uniqueValues(values) {
    const seen = new Set();
    const unique = [];

    for (const value of values) {
        const text = String(value || '').trim();
        const key = normalizeMfhLookupText(text);

        if (!text || seen.has(key)) {
            continue;
        }

        seen.add(key);
        unique.push(text);
    }

    return unique;
}

function localizeMfhValueTerms(value) {
    let localized = String(value || '');
    const terms = Object.entries(VALUE_TERM_LABELS)
        .sort(function(a, b) {
            return b[0].length - a[0].length;
        });

    for (const [source, replacement] of terms) {
        localized = localized.replace(new RegExp(`(?<![a-z])${escapeRegex(source)}(?![a-z])`, 'giu'), replacement);
    }

    return localized;
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function resetMfhLocalDataCache() {
    cachedLocalData = null;
    cachedLocalPathKey = '';
}

export const __testables = {
    hasMfhLocalDictionary,
    loadMfhLocalData,
    looksLikeJapaneseMfhText,
    normalizeMfhLookupText,
    resetMfhLocalDataCache
};
