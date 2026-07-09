import { buildOverfastPlayerId, overfastFetch } from './overwatch-client.js';

const MODE_LABEL = 'Rival';
const ROLE_DEFINITIONS = [
    {
        key: 'tank',
        label: 'Tank'
    },
    {
        key: 'damage',
        label: 'Damage'
    },
    {
        key: 'support',
        label: 'Support'
    }
];

export async function getOwSummary(battleTag, roleFilter) {
    const normalizedRoleFilter = normalizeRoleKey(roleFilter);
    const playerId = buildOverfastPlayerId(battleTag);
    const summaryData = await overfastFetch(`/players/${encodeURIComponent(playerId)}/summary`);
    const statsData = await fetchStatsSummary(playerId);

    return buildSummary(summaryData, statsData, battleTag, playerId, normalizedRoleFilter);
}

export async function getOwHeroSummary(battleTag, heroName) {
    const playerId = buildOverfastPlayerId(battleTag);
    const hero = await findHero(heroName);
    const summaryData = await overfastFetch(`/players/${encodeURIComponent(playerId)}/summary`);
    const statsData = await fetchStatsSummary(playerId);

    return buildHeroSummary(summaryData, statsData, battleTag, playerId, hero);
}

export async function searchOwHeroes(query, limit) {
    const heroes = await fetchHeroes();
    const normalizedQuery = normalizeHeroSearchText(query);
    const maxResults = limit || 25;

    return heroes
        .filter(function(hero) {
            if (!normalizedQuery) {
                return true;
            }

            return normalizeHeroSearchText(hero.name).includes(normalizedQuery)
                || normalizeHeroSearchText(hero.key).includes(normalizedQuery);
        })
        .slice(0, maxResults)
        .map(function(hero) {
            return {
                name: hero.name,
                value: hero.key
            };
        });
}

async function fetchStatsSummary(playerId) {
    try {
        return await overfastFetch(`/players/${encodeURIComponent(playerId)}/stats/summary?gamemode=competitive`);
    } catch (error) {
        return null;
    }
}

function buildSummary(summaryData, statsData, battleTag, playerId, roleFilter) {
    const player = buildPlayer(summaryData, battleTag, playerId);
    const ranks = extractRanks(summaryData, roleFilter);
    const roleStats = extractRoleStats(statsData);
    const selectedRoleStats = roleFilter
        ? roleStats.find(function(roleStat) {
            return roleStat.roleKey === roleFilter;
        })
        : null;
    const stats = roleFilter
        ? selectedRoleStats || buildEmptyStats(MODE_LABEL, getRoleLabel(roleFilter))
        : extractStats(statsData, MODE_LABEL);

    return {
        player: player,
        ranks: ranks,
        stats: stats,
        roleStats: roleFilter ? [] : roleStats,
        selectedRole: roleFilter ? getRoleLabel(roleFilter) : '',
        hasSelectedRoleStats: roleFilter ? !!selectedRoleStats : true,
        raw: {
            summary: summaryData,
            stats: statsData
        }
    };
}

function buildHeroSummary(summaryData, statsData, battleTag, playerId, hero) {
    const player = buildPlayer(summaryData, battleTag, playerId);
    const ranks = extractRanks(summaryData, normalizeRoleKey(hero.role));
    const heroStats = extractHeroStats(statsData, hero);
    const stats = heroStats || buildEmptyStats(MODE_LABEL, getRoleLabel(hero.role));

    return {
        player: player,
        hero: hero,
        ranks: ranks,
        stats: stats,
        roleStats: [],
        selectedRole: '',
        selectedHero: hero.name,
        hasSelectedHeroStats: !!heroStats,
        raw: {
            summary: summaryData,
            stats: statsData
        }
    };
}

function buildPlayer(data, battleTag, playerId) {
    return {
        name: data.name || data.username || data.display_name || battleTag,
        playerId: data.player_id || playerId,
        title: data.title || '',
        avatar: data.avatar || data.icon || data.portrait || '',
        namecard: data.namecard || data.name_card || ''
    };
}

function extractRanks(data, roleFilter) {
    const rankSource = data.competitive || data.ranks || data.rank || data.summary?.competitive || {};
    const platformSource = rankSource.pc || rankSource.PC || rankSource.console || rankSource;
    const targetRoles = roleFilter
        ? ROLE_DEFINITIONS.filter(function(role) {
            return role.key === roleFilter;
        })
        : ROLE_DEFINITIONS;

    return targetRoles.map(function(role) {
        const value = findRoleValue(platformSource, role.key);

        return {
            roleKey: role.key,
            role: role.label,
            rank: formatRank(value)
        };
    }).filter(function(rankRow) {
        return rankRow.rank !== '-';
    });
}

function findRoleValue(source, roleKey) {
    if (!source || typeof source !== 'object') {
        return null;
    }

    const possibleKeys = buildRoleKeyCandidates(roleKey);

    for (const key of possibleKeys) {
        if (source[key]) {
            return source[key];
        }
    }

    for (const key of Object.keys(source)) {
        const value = source[key];

        if (!value || typeof value !== 'object') {
            continue;
        }

        if (possibleKeys.includes(String(key).toLowerCase())) {
            return value;
        }

        const nestedValue = findRoleValue(value, roleKey);

        if (nestedValue) {
            return nestedValue;
        }
    }

    return null;
}

function buildRoleKeyCandidates(roleKey) {
    if (roleKey === 'damage') {
        return ['damage', 'offense'];
    }

    return [roleKey];
}

function formatRank(value) {
    if (!value) {
        return '-';
    }

    if (typeof value === 'string') {
        return normalizeRankText(value);
    }

    const division = value.division || value.rank || value.tier_name || value.tier || value.name || '';
    const tier = value.tier && value.division ? value.tier : value.level || value.rank_division || value.division_level || '';
    const skillRating = value.skill_rating || value.skillRating || value.rating || value.sr || '';

    if (division && tier) {
        return `${normalizeRankText(division)} ${convertDivision(tier)}`;
    }

    if (division) {
        return normalizeRankText(division);
    }

    if (skillRating) {
        return `${skillRating} SR`;
    }

    return '-';
}

function extractStats(statsData, modeLabel) {
    const general = statsData?.general || statsData?.stats?.general || statsData?.summary?.general || null;
    const candidates = [
        general,
        statsData,
        statsData?.all,
        statsData?.['all-heroes'],
        statsData?.all_heroes
    ].filter(Boolean);

    return buildStatsFromCandidates(candidates, modeLabel, '');
}

function extractRoleStats(statsData) {
    const rolesSource = statsData?.roles || statsData?.stats?.roles || statsData?.summary?.roles || null;

    if (!rolesSource || typeof rolesSource !== 'object') {
        return [];
    }

    return ROLE_DEFINITIONS.map(function(role) {
        const source = findRoleStatsSource(rolesSource, role.key);

        if (!source) {
            return null;
        }

        const roleStats = buildStatsFromCandidates([source], MODE_LABEL, role.label);
        roleStats.roleKey = role.key;
        roleStats.role = role.label;

        return roleStats;
    }).filter(function(roleStat) {
        return roleStat && hasAnyStats(roleStat);
    });
}

function findRoleStatsSource(source, roleKey) {
    return findRoleStatsSourceRecursive(source, roleKey, 0);
}

function findRoleStatsSourceRecursive(source, roleKey, depth) {
    if (!source || typeof source !== 'object' || depth > 4) {
        return null;
    }

    const possibleKeys = buildRoleKeyCandidates(roleKey);

    for (const key of possibleKeys) {
        if (source[key] && typeof source[key] === 'object') {
            return source[key];
        }
    }

    const preferredContainerKeys = [
        'roles',
        'stats',
        'summary',
        'competitive',
        'quickplay',
        'pc',
        'console',
        'data'
    ];

    for (const key of preferredContainerKeys) {
        if (!source[key] || typeof source[key] !== 'object') {
            continue;
        }

        const found = findRoleStatsSourceRecursive(source[key], roleKey, depth + 1);

        if (found) {
            return found;
        }
    }

    for (const key of Object.keys(source)) {
        if (preferredContainerKeys.includes(key)) {
            continue;
        }

        const value = source[key];

        if (!value || typeof value !== 'object') {
            continue;
        }

        const found = findRoleStatsSourceRecursive(value, roleKey, depth + 1);

        if (found) {
            return found;
        }
    }

    return null;
}

function extractHeroStats(statsData, hero) {
    const heroesSource = statsData?.heroes || statsData?.stats?.heroes || statsData?.summary?.heroes || null;
    const source = findHeroStatsSource(heroesSource, hero);

    if (!source) {
        return null;
    }

    const stats = buildStatsFromCandidates([source], MODE_LABEL, getRoleLabel(hero.role));
    stats.heroKey = hero.key;
    stats.hero = hero.name;

    return hasAnyStats(stats) ? stats : null;
}

function findHeroStatsSource(source, hero) {
    if (!source || typeof source !== 'object') {
        return null;
    }

    const candidates = [
        hero.key,
        hero.name,
        normalizeHeroKey(hero.name)
    ];

    for (const key of candidates) {
        if (source[key] && typeof source[key] === 'object') {
            return source[key];
        }
    }

    const normalizedHeroKey = normalizeHeroSearchText(hero.key);
    const normalizedHeroName = normalizeHeroSearchText(hero.name);

    for (const key of Object.keys(source)) {
        const normalizedKey = normalizeHeroSearchText(key);

        if ((normalizedKey === normalizedHeroKey || normalizedKey === normalizedHeroName)
            && source[key]
            && typeof source[key] === 'object') {
            return source[key];
        }
    }

    return null;
}


function buildStatsFromCandidates(candidates, modeLabel, roleLabel) {
    const games = firstNumber(candidates, [
        'games_played',
        'gamesPlayed',
        'games',
        'played'
    ]);
    const wins = firstNumber(candidates, [
        'games_won',
        'gamesWon',
        'wins',
        'won'
    ]);
    const losses = firstNumber(candidates, [
        'games_lost',
        'gamesLost',
        'losses',
        'lost'
    ]);
    const winRate = firstNumber(candidates, [
        'winrate',
        'win_rate',
        'winRate'
    ]);
    const kda = firstNumber(candidates, [
        'kda',
        'kda_ratio',
        'kdaRatio'
    ]);
    const damage = firstNumber(candidates, [
        'hero_damage_done',
        'damage_done',
        'all_damage_done',
        'damage'
    ]);
    const healing = firstNumber(candidates, [
        'healing_done',
        'healing',
        'healing_done_total'
    ]);
    const eliminations = firstNumber(candidates, [
        'eliminations',
        'elims'
    ]);
    const assists = firstNumber(candidates, [
        'assists'
    ]);
    const deaths = firstNumber(candidates, [
        'deaths'
    ]);
    const calculatedLosses = losses ?? calculateLosses(games, wins);

    return {
        mode: modeLabel,
        role: roleLabel,
        gamesRaw: games,
        winsRaw: wins,
        lossesRaw: calculatedLosses,
        damageRaw: damage,
        healingRaw: healing,
        games: formatCount(games),
        wins: formatCount(wins),
        losses: formatCount(calculatedLosses),
        winRate: formatPercent(winRate || calculateWinRate(wins, games)),
        kda: formatDecimal(kda || calculateRatio((eliminations || 0) + (assists || 0), deaths)),
        avgDamage: formatCount(calculateAverage(damage, games)),
        avgHealing: formatCount(calculateAverage(healing, games))
    };
}

function buildEmptyStats(modeLabel, roleLabel) {
    return {
        mode: modeLabel,
        role: roleLabel,
        gamesRaw: null,
        winsRaw: null,
        lossesRaw: null,
        damageRaw: null,
        healingRaw: null,
        games: '-',
        wins: '-',
        losses: '-',
        winRate: '-',
        kda: '-',
        avgDamage: '-',
        avgHealing: '-'
    };
}

function hasAnyStats(stats) {
    return stats.games !== '-' || stats.wins !== '-' || stats.winRate !== '-' || stats.kda !== '-';
}

function firstNumber(candidates, keys) {
    for (const candidate of candidates) {
        const value = findNumberByKeys(candidate, keys);

        if (value !== undefined && value !== null && !Number.isNaN(value)) {
            return value;
        }
    }

    return null;
}

function findNumberByKeys(source, keys) {
    if (!source || typeof source !== 'object') {
        return undefined;
    }

    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) {
            continue;
        }

        const numericValue = toNumber(source[key]);

        if (numericValue !== null) {
            return numericValue;
        }
    }

    for (const value of Object.values(source)) {
        if (!value || typeof value !== 'object') {
            continue;
        }

        const found = findNumberByKeys(value, keys);

        if (found !== undefined && found !== null) {
            return found;
        }
    }

    return undefined;
}

function toNumber(value) {
    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string') {
        const normalizedValue = value.replace(/,/g, '').replace('%', '').trim();
        const parsedValue = Number(normalizedValue);

        return Number.isNaN(parsedValue) ? null : parsedValue;
    }

    if (value && typeof value === 'object') {
        const possibleKeys = [
            'value',
            'amount',
            'total',
            'sum'
        ];

        for (const key of possibleKeys) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) {
                continue;
            }

            const numericValue = toNumber(value[key]);

            if (numericValue !== null) {
                return numericValue;
            }
        }
    }

    return null;
}

function calculateLosses(games, wins) {
    if (games === null || games === undefined || wins === null || wins === undefined) {
        return null;
    }

    return Math.max(games - wins, 0);
}

function calculateWinRate(wins, games) {
    if (!wins || !games) {
        return null;
    }

    return (wins / games) * 100;
}

function calculateRatio(numerator, denominator) {
    if (!numerator || !denominator) {
        return null;
    }

    return numerator / Math.max(denominator, 1);
}

function calculateAverage(total, games) {
    if (!total || !games) {
        return null;
    }

    return total / games;
}

function formatCount(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '-';
    }

    return Math.round(value).toLocaleString('en-US');
}

function formatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '-';
    }

    return `${Math.round(value)}%`;
}

function formatDecimal(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '-';
    }

    return Number(value).toFixed(1);
}

function normalizeRankText(value) {
    const text = String(value || '').trim();
    const lower = text.toLowerCase();
    const rankNames = {
        bronze: 'Bronze',
        silver: 'Silver',
        gold: 'Gold',
        platinum: 'Platinum',
        diamond: 'Diamond',
        master: 'Master',
        grandmaster: 'Grandmaster',
        champion: 'Champion',
        top500: 'Top 500',
        'top 500': 'Top 500'
    };

    return rankNames[lower] || text;
}

function convertDivision(value) {
    const divisions = {
        1: 'Ⅰ',
        2: 'Ⅱ',
        3: 'Ⅲ',
        4: 'Ⅳ',
        5: 'Ⅴ',
        I: 'Ⅰ',
        II: 'Ⅱ',
        III: 'Ⅲ',
        IV: 'Ⅳ',
        V: 'Ⅴ'
    };

    return divisions[value] || value;
}

function normalizeRoleKey(role) {
    if (!role) {
        return '';
    }

    const normalizedRole = String(role).toLowerCase();

    return normalizedRole;
}

function getRoleLabel(roleKey) {
    const role = ROLE_DEFINITIONS.find(function(roleDefinition) {
        return roleDefinition.key === roleKey;
    });

    return role ? role.label : '';
}

let heroesCache = null;

async function fetchHeroes() {
    if (!heroesCache) {
        heroesCache = await overfastFetch('/heroes?locale=en-us');
    }

    return heroesCache;
}

async function findHero(heroName) {
    const heroes = await fetchHeroes();
    const normalizedHeroName = normalizeHeroSearchText(heroName);
    const hero = heroes.find(function(heroItem) {
        return normalizeHeroSearchText(heroItem.key) === normalizedHeroName
            || normalizeHeroSearchText(heroItem.name) === normalizedHeroName;
    });

    if (!hero) {
        throw new Error(`ヒーローが見つかりません: ${heroName}`);
    }

    return {
        key: hero.key,
        name: hero.name,
        portrait: hero.portrait || '',
        role: normalizeRoleKey(hero.role),
        subrole: hero.subrole || ''
    };
}

function normalizeHeroKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeHeroSearchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

export const __testables = {
    buildHeroSummary,
    buildSummary,
    extractRanks,
    extractRoleStats,
    formatRank,
    normalizeHeroSearchText
};
