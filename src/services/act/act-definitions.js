export const ACT_COMPONENT_PREFIX = 'act';
export const ACT_STATUS_OPEN = 'open';
export const ACT_STATUS_CLOSED = 'closed';
export const CLOSED_ACT_REOPEN_VISIBLE_MS = 10 * 60 * 1000;
export const LOL_ANY_SLOT_KEY = 'any';
export const OW_FLEX_SLOT_KEY = 'flex';
export const FF14_ALL_ROLE_KEY = 'all';
export const FF14_ANY_JOB_SUFFIX = 'any';
export const FF14_ROLE_SELECTION_ON = 'ON';
export const FF14_ROLE_SELECTION_OFF = 'OFF';

export const LOL_LANE_SLOTS = [
    {
        key: 'top',
        label: 'TOP',
        displayLabel: 'トップ',
        emojiEnv: 'LOL_EMOJI_TOP'
    },
    {
        key: 'jungle',
        label: 'JG',
        displayLabel: 'ジャングル',
        emojiEnv: 'LOL_EMOJI_JG'
    },
    {
        key: 'middle',
        label: 'MID',
        displayLabel: 'ミッド',
        emojiEnv: 'LOL_EMOJI_MID'
    },
    {
        key: 'bottom',
        label: 'ADC',
        displayLabel: 'ボット',
        emojiEnv: 'LOL_EMOJI_ADC'
    },
    {
        key: 'utility',
        label: 'SUP',
        displayLabel: 'サポート',
        emojiEnv: 'LOL_EMOJI_SUP'
    },
    {
        key: LOL_ANY_SLOT_KEY,
        label: 'どこでも',
        displayLabel: 'どこでも',
        emojiEnv: 'LOL_EMOJI_ANY',
        multiple: true
    }
];

export const OW_ROLE_SLOTS = [
    {
        key: 'tank',
        label: 'Tank',
        displayLabel: 'タンク',
        emojiEnv: 'OW_EMOJI_TANK'
    },
    {
        key: 'damage1',
        label: 'Damage',
        displayLabel: 'ダメージ',
        emojiEnv: 'OW_EMOJI_DAMAGE',
        selectKey: 'damage'
    },
    {
        key: 'damage2',
        label: 'Damage',
        displayLabel: 'ダメージ',
        emojiEnv: 'OW_EMOJI_DAMAGE',
        selectKey: 'damage'
    },
    {
        key: 'support1',
        label: 'Support',
        displayLabel: 'サポート',
        emojiEnv: 'OW_EMOJI_SUPPORT',
        selectKey: 'support'
    },
    {
        key: 'support2',
        label: 'Support',
        displayLabel: 'サポート',
        emojiEnv: 'OW_EMOJI_SUPPORT',
        selectKey: 'support'
    },
    {
        key: OW_FLEX_SLOT_KEY,
        label: 'Flex',
        displayLabel: 'すべて',
        emojiEnv: 'OW_EMOJI_FLEX',
        multiple: true
    }
];

export const FF14_PARTY_TYPES = {
    LIGHT: {
        label: 'ライトパーティ',
        maxParticipants: 4,
        capacities: {
            tank: 1,
            healer: 1,
            dps: 2
        }
    },
    FULL: {
        label: 'フルパーティ',
        maxParticipants: 8,
        capacities: {
            tank: 2,
            healer: 2,
            dps: 4
        }
    }
};

export const FF14_ROLE_OPTIONS = [
    {
        key: 'tank',
        label: 'タンク',
        emojiEnv: 'FF14_EMOJI_TANK',
        anyJobKey: buildFf14AnyJobKey('tank'),
        sortOrder: 1
    },
    {
        key: 'healer',
        label: 'ヒーラー',
        emojiEnv: 'FF14_EMOJI_HEALER',
        anyJobKey: buildFf14AnyJobKey('healer'),
        sortOrder: 2
    },
    {
        key: 'dps',
        label: 'DPS',
        emojiEnv: 'FF14_EMOJI_DPS',
        anyJobKey: buildFf14AnyJobKey('dps'),
        sortOrder: 3
    },
    {
        key: FF14_ALL_ROLE_KEY,
        label: 'なんでも可',
        emojiEnv: 'FF14_EMOJI_ALL',
        anyJobKey: buildFf14AnyJobKey(FF14_ALL_ROLE_KEY),
        sortOrder: 4
    }
];

export const FF14_JOBS = [
    {
        key: 'paladin',
        role: 'tank',
        label: 'ナイト',
        emojiEnv: 'FF14_EMOJI_PALADIN',
        sortOrder: 5
    },
    {
        key: 'warrior',
        role: 'tank',
        label: '戦士',
        emojiEnv: 'FF14_EMOJI_WARRIOR',
        sortOrder: 6
    },
    {
        key: 'dark_knight',
        role: 'tank',
        label: '暗黒騎士',
        emojiEnv: 'FF14_EMOJI_DARK_KNIGHT',
        sortOrder: 7
    },
    {
        key: 'gunbreaker',
        role: 'tank',
        label: 'ガンブレイカー',
        emojiEnv: 'FF14_EMOJI_GUNBREAKER',
        sortOrder: 8
    },
    {
        key: 'white_mage',
        role: 'healer',
        label: '白魔道士',
        emojiEnv: 'FF14_EMOJI_WHITE_MAGE',
        sortOrder: 9
    },
    {
        key: 'scholar',
        role: 'healer',
        label: '学者',
        emojiEnv: 'FF14_EMOJI_SCHOLAR',
        sortOrder: 10
    },
    {
        key: 'astrologian',
        role: 'healer',
        label: '占星術師',
        emojiEnv: 'FF14_EMOJI_ASTROLOGIAN',
        sortOrder: 11
    },
    {
        key: 'sage',
        role: 'healer',
        label: '賢者',
        emojiEnv: 'FF14_EMOJI_SAGE',
        sortOrder: 12
    },
    {
        key: 'monk',
        role: 'dps',
        label: 'モンク',
        emojiEnv: 'FF14_EMOJI_MONK',
        sortOrder: 13
    },
    {
        key: 'dragoon',
        role: 'dps',
        label: '竜騎士',
        emojiEnv: 'FF14_EMOJI_DRAGOON',
        sortOrder: 14
    },
    {
        key: 'ninja',
        role: 'dps',
        label: '忍者',
        emojiEnv: 'FF14_EMOJI_NINJA',
        sortOrder: 15
    },
    {
        key: 'samurai',
        role: 'dps',
        label: '侍',
        emojiEnv: 'FF14_EMOJI_SAMURAI',
        sortOrder: 16
    },
    {
        key: 'reaper',
        role: 'dps',
        label: 'リーパー',
        emojiEnv: 'FF14_EMOJI_REAPER',
        sortOrder: 17
    },
    {
        key: 'viper',
        role: 'dps',
        label: 'ヴァイパー',
        emojiEnv: 'FF14_EMOJI_VIPER',
        sortOrder: 18
    },
    {
        key: 'bard',
        role: 'dps',
        label: '吟遊詩人',
        emojiEnv: 'FF14_EMOJI_BARD',
        sortOrder: 19
    },
    {
        key: 'machinist',
        role: 'dps',
        label: '機工士',
        emojiEnv: 'FF14_EMOJI_MACHINIST',
        sortOrder: 20
    },
    {
        key: 'dancer',
        role: 'dps',
        label: '踊り子',
        emojiEnv: 'FF14_EMOJI_DANCER',
        sortOrder: 21
    },
    {
        key: 'black_mage',
        role: 'dps',
        label: '黒魔道士',
        emojiEnv: 'FF14_EMOJI_BLACK_MAGE',
        sortOrder: 22
    },
    {
        key: 'summoner',
        role: 'dps',
        label: '召喚士',
        emojiEnv: 'FF14_EMOJI_SUMMONER',
        sortOrder: 23
    },
    {
        key: 'red_mage',
        role: 'dps',
        label: '赤魔道士',
        emojiEnv: 'FF14_EMOJI_RED_MAGE',
        sortOrder: 24
    },
    {
        key: 'pictomancer',
        role: 'dps',
        label: 'ピクトマンサー',
        emojiEnv: 'FF14_EMOJI_PICTOMANCER',
        sortOrder: 25
    }
];

export function getActDefinition(party) {
    if (party.game === 'lol') {
        return {
            titlePrefix: 'LoL',
            titleEmojiEnv: 'LOL_EMOJI_APP',
            modeLabels: {
                Normal: 'ノーマル（ドラフト）',
                Flex: 'ランク（フレックス）',
                ARAM: 'ランダムミッド'
            },
            color: 0xC89B3C,
            slotFieldName: 'レーン',
            listFieldName: '参加者',
            joinPlaceholder: '参加するレーンを選択',
            slots: party.usesSlots ? LOL_LANE_SLOTS : [],
            maxParticipants: 5
        };
    }

    if (party.game === 'ow') {
        return {
            titlePrefix: 'OW',
            titleEmojiEnv: 'OW_EMOJI_APP',
            modeLabels: {
                Quick: 'クイック・プレイ',
                Rival: 'ライバル・プレイ',
                Stadium: 'スタジアム'
            },
            color: 0xF06414,
            slotFieldName: 'ロール',
            listFieldName: '参加者',
            joinPlaceholder: '参加するロールを選択',
            slots: party.usesSlots ? OW_ROLE_SLOTS : [],
            maxParticipants: 5
        };
    }

    if (party.game === 'ff14') {
        return {
            titlePrefix: 'FF14',
            titleEmojiEnv: 'FF14_EMOJI_APP',
            color: 0x5A7DAD,
            listFieldName: '参加者',
            joinPlaceholder: '参加するロールを選択',
            maxParticipants: getFf14PartyType(party.partyType).maxParticipants,
            ff14: true
        };
    }

    throw new Error(`Unsupported party game: ${party.game}`);
}

export function getFf14PartyType(partyType) {
    const partyTypeKey = normalizeFf14PartyTypeKey(partyType);

    return FF14_PARTY_TYPES[partyTypeKey] || FF14_PARTY_TYPES.LIGHT;
}

export function getFf14RoleSelection(value) {
    const normalizedValue = String(value || '')
        .trim()
        .toUpperCase();

    return normalizedValue === FF14_ROLE_SELECTION_OFF
        ? FF14_ROLE_SELECTION_OFF
        : FF14_ROLE_SELECTION_ON;
}

export function usesFf14RoleSlots(party) {
    return getFf14RoleSelection(party.ff14RoleSelection) === FF14_ROLE_SELECTION_ON;
}

function normalizeFf14PartyTypeKey(partyType) {
    const value = String(partyType || '')
        .trim()
        .toUpperCase()
        .replace(/[\s_-]+/g, '');

    if (value === 'LIGHTPARTY' || value === 'LIGHT') {
        return 'LIGHT';
    }

    if (value === 'FULLPARTY' || value === 'FULL') {
        return 'FULL';
    }

    return value;
}

export function getFf14Role(roleKey) {
    return FF14_ROLE_OPTIONS.find(function(role) {
        return role.key === roleKey;
    }) || null;
}

export function getFf14JobsByRole(roleKey) {
    return FF14_JOBS.filter(function(job) {
        return job.role === roleKey;
    });
}

export function getFf14Job(jobKey) {
    return FF14_JOBS.find(function(job) {
        return job.key === jobKey;
    }) || getFf14AnyJob(jobKey);
}

export function getFf14AnyJob(jobKey) {
    const roleKey = parseFf14AnyJobKey(jobKey);
    const role = getFf14Role(roleKey);

    if (!role) {
        return null;
    }

    return {
        key: jobKey,
        role: role.key,
        label: role.key === FF14_ALL_ROLE_KEY ? role.label : 'ジョブ指定無し',
        emojiEnv: role.emojiEnv,
        sortOrder: 999,
        roleAny: true
    };
}

export function buildFf14AnyJobKey(roleKey) {
    return `${roleKey}_${FF14_ANY_JOB_SUFFIX}`;
}

export function parseFf14AnyJobKey(jobKey) {
    const suffix = `_${FF14_ANY_JOB_SUFFIX}`;

    if (!String(jobKey || '').endsWith(suffix)) {
        return '';
    }

    return String(jobKey).slice(0, -suffix.length);
}

export function getMultipleSlotParticipants(party, slotKey) {
    if (party.multiParticipants?.[slotKey]) {
        return party.multiParticipants[slotKey];
    }

    if (slotKey === LOL_ANY_SLOT_KEY) {
        return party.anyParticipants || [];
    }

    return [];
}

export function usesLolLaneSlots(mode) {
    const normalizedMode = normalizeMode(mode);
    const noLaneModes = [
        'aram'
    ];

    return !noLaneModes.some(function(noLaneMode) {
        return normalizedMode === noLaneMode;
    });
}

function normalizeMode(mode) {
    return String(mode || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[・･_-]/g, '');
}
