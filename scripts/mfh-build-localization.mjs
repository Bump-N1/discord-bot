import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_GAME_DIR = 'D:\\Game\\Steam\\steamapps\\common\\Mistfall Hunter';
const DEFAULT_OUTPUT = path.join(process.cwd(), 'src', 'data', 'mfh-localization-ja.json');
const TARGET_FILE_NAMES = new Set([
    'AffixGemLibrary.json',
    'AffixSkill.json',
    'AmmoTalent.json',
    'AppearanceSkill.json',
    'DerivedSkill.json',
    'EquipAffixGemRandom.json',
    'I18NText.json',
    'ItemCommon.json',
    'ItemWeapon.json',
    'ItemArmor.json',
    'ItemLibrary.json',
    'ItemAffixGem.json',
    'Skill.json',
    'SkillScore.json',
    'Talent.json',
    'TalentTree.json',
    'Gem.json'
]);
const SKIP_DIR_NAMES = new Set([
    '.git',
    'Binaries',
    'Intermediate',
    'Paks',
    'Saved'
]);
const KEY_FIELDS = [
    'id',
    'ID',
    'Id',
    'key',
    'Key',
    'text_id',
    'TextId',
    'TextID',
    'NameTextId',
    'NameTextID',
    'DescTextId',
    'DescTextID'
];
const TEXT_FIELDS = [
    'ja',
    'JA',
    'jp',
    'JP',
    'Japanese',
    'japanese',
    'text',
    'Text',
    'value',
    'Value',
    'content',
    'Content',
    'str',
    'Str'
];
const NAME_FIELDS = [
    'Name',
    'name',
    'DisplayName',
    'displayName',
    'Title',
    'title',
    'ItemName',
    'itemName',
    'NameText',
    'nameId',
    'NameTextId',
    'NameTextID',
    'NameId',
    'NameID'
];
const DESCRIPTION_FIELDS = [
    'Description',
    'description',
    'Desc',
    'desc',
    'Text',
    'text',
    'DescText',
    'descId',
    'DescTextId',
    'DescTextID',
    'DescriptionTextId',
    'DescriptionTextID'
];

const options = parseArgs(process.argv.slice(2));
const inputDir = options.input || process.env.MFH_EXTRACTED_DATA_DIR || DEFAULT_GAME_DIR;
const outputPath = options.output || process.env.MFH_LOCALIZATION_PATH || DEFAULT_OUTPUT;
const files = findTargetFiles(inputDir);

if (files.length === 0) {
    console.log('MFHの抽出済みJSONが見つかりませんでした。');
    console.log('FModelなどで以下のようなファイルを抽出してから再実行してください。');
    console.log('- MistfallHunter/Content/JavaScript/config/gen/data/I18NText.json');
    console.log('- MistfallHunter/Content/JavaScript/config/gen/data/ItemCommon.json');
    console.log('- MistfallHunter/Content/JavaScript/config/gen/data/ItemWeapon.json');
    console.log('- MistfallHunter/Content/JavaScript/config/gen/data/Skill.json');
    console.log('- MistfallHunter/Content/JavaScript/config/gen/data/Talent.json');
    process.exit(1);
}

const i18n = new Map();
const entries = [];

for (const file of files) {
    const payload = readJson(file);

    if (!payload) {
        continue;
    }

    if (path.basename(file) === 'I18NText.json') {
        collectI18nPairs(payload, i18n);
        continue;
    }

    entries.push(...collectEntries(payload, i18n, file));
}

const output = {
    formatVersion: 1,
    source: 'Mistfall Hunter extracted game data',
    entries: uniqueEntries(entries),
    values: {},
    fields: {}
};

fs.mkdirSync(path.dirname(outputPath), {
    recursive: true
});
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}${os.EOL}`, 'utf8');

console.log(`MFHローカル辞書を生成しました: ${outputPath}`);
console.log(`entries: ${output.entries.length}`);

function parseArgs(args) {
    const parsed = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const next = args[i + 1];

        if (arg === '--input' && next) {
            parsed.input = next;
            i++;
            continue;
        }

        if (arg === '--output' && next) {
            parsed.output = next;
            i++;
        }
    }

    return parsed;
}

function findTargetFiles(rootDir) {
    const found = [];

    if (!fs.existsSync(rootDir)) {
        return found;
    }

    visit(rootDir);

    return found;

    function visit(currentDir) {
        let children;

        try {
            children = fs.readdirSync(currentDir, {
                withFileTypes: true
            });
        } catch (error) {
            return;
        }

        for (const child of children) {
            const childPath = path.join(currentDir, child.name);

            if (child.isDirectory()) {
                if (!SKIP_DIR_NAMES.has(child.name)) {
                    visit(childPath);
                }
                continue;
            }

            if (child.isFile() && TARGET_FILE_NAMES.has(child.name)) {
                found.push(childPath);
            }
        }
    }
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.warn(`JSONを読み込めませんでした: ${file} (${error.message})`);
        return null;
    }
}

function collectI18nPairs(value, i18n) {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectI18nPairs(item, i18n);
        }
        return;
    }

    if (!value || typeof value !== 'object') {
        return;
    }

    const key = firstFieldValue(value, KEY_FIELDS);
    const japanese = firstFieldValue(value, TEXT_FIELDS);
    const english = firstFieldValue(value, ['english', 'English', 'en', 'EN']);

    if (key && japanese && containsJapanese(japanese)) {
        i18n.set(String(key), {
            japanese: String(japanese).trim(),
            english: String(english || '').trim()
        });
    }

    for (const item of Object.values(value)) {
        collectI18nPairs(item, i18n);
    }
}

function collectEntries(value, i18n, file) {
    const records = flattenRecords(value);
    const entries = [];

    for (const record of records) {
        const id = firstFieldValue(record, KEY_FIELDS) || firstFieldValue(record, ['TableId', 'tableId', 'ConfigId', 'configId']);
        const nameRef = firstFieldValue(record, NAME_FIELDS);
        const descriptionRef = firstFieldValue(record, DESCRIPTION_FIELDS);
        const localizedName = resolveLocalizedText(nameRef, i18n);
        const sourceName = resolveEnglishText(nameRef, i18n);

        if (!localizedName) {
            continue;
        }

        entries.push({
            id: id ? `${path.basename(file, '.json')}:${id}` : '',
            sourceName: sourceName,
            name: localizedName,
            description: resolveLocalizedText(descriptionRef, i18n),
            aliases: [],
            tags: []
        });
    }

    return entries;
}

function flattenRecords(value) {
    const records = [];

    visit(value);

    return records;

    function visit(item) {
        if (Array.isArray(item)) {
            for (const child of item) {
                visit(child);
            }
            return;
        }

        if (!item || typeof item !== 'object') {
            return;
        }

        if (looksLikeRecord(item)) {
            records.push(item);
        }

        for (const child of Object.values(item)) {
            visit(child);
        }
    }
}

function looksLikeRecord(record) {
    return Boolean(firstFieldValue(record, NAME_FIELDS))
        && Object.keys(record).length > 1;
}

function resolveLocalizedText(value, i18n) {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return '';
    }

    const key = String(value).trim();

    if (!key) {
        return '';
    }

    if (containsJapanese(key)) {
        return key;
    }

    return i18n.get(key)?.japanese || '';
}

function resolveEnglishText(value, i18n) {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return '';
    }

    const key = String(value).trim();

    if (!key) {
        return '';
    }

    return i18n.get(key)?.english || '';
}

function firstFieldValue(record, fields) {
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(record, field)) {
            const value = record[field];

            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }

            if (typeof value === 'number') {
                return String(value);
            }
        }
    }

    return '';
}

function uniqueEntries(entries) {
    const seen = new Set();
    const unique = [];

    for (const entry of entries) {
        const key = normalizeLookupText(entry.sourceName || entry.name || entry.id);

        if (!key || seen.has(key)) {
            continue;
        }

        seen.add(key);
        unique.push(entry);
    }

    return unique;
}

function containsJapanese(value) {
    return /[\u3040-\u30ff\u3400-\u9fff]/u.test(String(value || ''));
}

function normalizeLookupText(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\s_\-:：/\\()[\]{}（）「」『』【】"'.,，。、・･]/gu, '');
}
