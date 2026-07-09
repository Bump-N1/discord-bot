import { RIOT_PLATFORM, RIOT_REGION, riotFetch } from './riot-client.js';
import { calculateKdaRatio, formatDuration, normalizeSearchText, sum } from '../../utils/format.js';

export async function getLolSummary(gameName, tagLine, count, championFilter) {
    const safeCount = championFilter
        ? Math.min(Math.max(count || 10, 1), 10)
        : Math.min(Math.max(count || 10, 1), 20);

    const account = await riotFetch(
        `https://${RIOT_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );

    const rankedEntries = await riotFetch(
        `https://${RIOT_PLATFORM}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(account.puuid)}`
    );

    const matchSearchCount = championFilter ? 50 : safeCount;

    const matchIds = await riotFetch(
        `https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(account.puuid)}/ids?start=0&count=${matchSearchCount}`
    );

    const matches = [];

    for (const matchId of matchIds) {
        const match = await riotFetch(
            `https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`
        );

        const participant = match.info.participants.find(function(player) {
            return player.puuid === account.puuid;
        });

        if (!participant) {
            continue;
        }

        if (championFilter && !isChampionMatched(participant.championName, championFilter)) {
            continue;
        }

        matches.push({
            championName: participant.championName,
            win: participant.win,
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
            queueId: match.info.queueId,
            queueName: convertQueueName(match.info.queueId),
            gameCreation: match.info.gameCreation,
            gameDuration: match.info.gameDuration,
            gameDurationText: formatDuration(match.info.gameDuration),
            kdaRatio: calculateKdaRatio(participant.kills, participant.deaths, participant.assists)
        });

        if (championFilter && matches.length >= safeCount) {
            break;
        }
    }

    return buildSummary({
        gameName: account.gameName,
        tagLine: account.tagLine,
        rankedEntries: rankedEntries,
        matches: matches,
        championFilter: championFilter || ''
    });
}

function buildSummary(data) {
    const totalGames = data.matches.length;
    const wins = data.matches.filter(function(match) {
        return match.win;
    }).length;
    const losses = totalGames - wins;

    const totalKills = sum(data.matches, 'kills');
    const totalDeaths = sum(data.matches, 'deaths');
    const totalAssists = sum(data.matches, 'assists');

    return {
        riotId: `${data.gameName}#${data.tagLine}`,
        soloRank: formatRank(data.rankedEntries, 'RANKED_SOLO_5x5'),
        flexRank: formatRank(data.rankedEntries, 'RANKED_FLEX_SR'),
        totalGames: totalGames,
        wins: wins,
        losses: losses,
        winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
        averageKills: totalGames > 0 ? (totalKills / totalGames).toFixed(1) : '0.0',
        averageDeaths: totalGames > 0 ? (totalDeaths / totalGames).toFixed(1) : '0.0',
        averageAssists: totalGames > 0 ? (totalAssists / totalGames).toFixed(1) : '0.0',
        averageKdaRatio: totalGames > 0 ? calculateKdaRatio(totalKills, totalDeaths, totalAssists) : '0.0',
        championStats: buildChampionStats(data.matches),
        queueStats: buildQueueStats(data.matches),
        matches: data.matches,
        championFilter: data.championFilter
    };
}

function buildChampionStats(matches) {
    const stats = new Map();

    for (const match of matches) {
        if (!stats.has(match.championName)) {
            stats.set(match.championName, {
                championName: match.championName,
                games: 0,
                wins: 0
            });
        }

        const championStat = stats.get(match.championName);
        championStat.games += 1;

        if (match.win) {
            championStat.wins += 1;
        }
    }

    return Array.from(stats.values())
        .sort(function(a, b) {
            return b.games - a.games;
        })
        .slice(0, 5)
        .map(function(stat) {
            return {
                championName: stat.championName,
                games: stat.games,
                wins: stat.wins,
                losses: stat.games - stat.wins,
                winRate: Math.round((stat.wins / stat.games) * 100)
            };
        });
}

function buildQueueStats(matches) {
    const stats = new Map();

    for (const match of matches) {
        if (!stats.has(match.queueName)) {
            stats.set(match.queueName, {
                queueName: match.queueName,
                games: 0,
                wins: 0
            });
        }

        const queueStat = stats.get(match.queueName);
        queueStat.games += 1;

        if (match.win) {
            queueStat.wins += 1;
        }
    }

    return Array.from(stats.values())
        .sort(function(a, b) {
            return b.games - a.games;
        })
        .map(function(stat) {
            return {
                queueName: stat.queueName,
                games: stat.games,
                wins: stat.wins,
                losses: stat.games - stat.wins,
                winRate: Math.round((stat.wins / stat.games) * 100)
            };
        });
}

function formatRank(entries, queueType) {
    const entry = entries.find(function(rankedEntry) {
        return rankedEntry.queueType === queueType;
    });

    if (!entry) {
        return 'Unranked';
    }

    return `${convertTierName(entry.tier)} ${convertRankDivision(entry.rank)} ${entry.leaguePoints}LP  ·  ${entry.wins}W ${entry.losses}L`;
}

function convertTierName(tier) {
    const tierNames = {
        IRON: 'Iron',
        BRONZE: 'Bronze',
        SILVER: 'Silver',
        GOLD: 'Gold',
        PLATINUM: 'Platinum',
        EMERALD: 'Emerald',
        DIAMOND: 'Diamond',
        MASTER: 'Master',
        GRANDMASTER: 'Grandmaster',
        CHALLENGER: 'Challenger'
    };

    return tierNames[tier] || tier;
}

function convertRankDivision(rank) {
    const divisions = {
        I: 'Ⅰ',
        II: 'Ⅱ',
        III: 'Ⅲ',
        IV: 'Ⅳ'
    };

    return divisions[rank] || rank;
}

function convertQueueName(queueId) {
    const queueNames = {
        400: 'Normal',
        420: 'Solo',
        430: 'Normal',
        440: 'Flex',
        450: 'ARAM',
        480: 'Swift',
        490: 'Quick',
        700: 'Clash',
        720: 'ARAM Clash',
        830: 'AI',
        840: 'AI',
        850: 'AI',
        900: 'URF',
        920: 'Poro King',
        1020: 'One for All',
        1300: 'Nexus Blitz',
        1400: 'Spellbook',
        1700: 'Arena',
        1710: 'Arena',
        1810: 'Swarm',
        1820: 'Swarm',
        1830: 'Swarm',
        1840: 'Swarm',
        1900: 'URF',
        2000: 'Tutorial',
        2010: 'Tutorial',
        2020: 'Tutorial'
    };

    return queueNames[queueId] || `Q${queueId}`;
}

function isChampionMatched(championName, championFilter) {
    const normalizedFilter = normalizeSearchText(championFilter);

    return normalizeSearchText(championName).includes(normalizedFilter);
}

export const __testables = {
    buildSummary,
    convertQueueName,
    isChampionMatched
};
