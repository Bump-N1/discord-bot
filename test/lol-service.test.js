import { describe, expect, it } from 'vitest';
import { __testables } from '../src/services/riot/lol-service.js';

const {
    buildSummary,
    convertQueueName,
    isChampionMatched
} = __testables;

describe('LoL service summary helpers', function() {
    it('試合一覧から勝率、平均、チャンピオン別、キュー別集計を作る', function() {
        const summary = buildSummary({
            gameName: 'Bump',
            tagLine: 'JP1',
            championFilter: 'Ahri',
            rankedEntries: [
                {
                    queueType: 'RANKED_SOLO_5x5',
                    tier: 'GOLD',
                    rank: 'II',
                    leaguePoints: 55,
                    wins: 10,
                    losses: 5
                }
            ],
            matches: [
                {
                    championName: 'Ahri',
                    win: true,
                    kills: 10,
                    deaths: 0,
                    assists: 5,
                    queueName: 'Solo'
                },
                {
                    championName: 'Ahri',
                    win: false,
                    kills: 0,
                    deaths: 5,
                    assists: 1,
                    queueName: 'Flex'
                },
                {
                    championName: 'Akali',
                    win: true,
                    kills: 5,
                    deaths: 5,
                    assists: 10,
                    queueName: 'Q999'
                }
            ]
        });

        expect(summary).toMatchObject({
            riotId: 'Bump#JP1',
            soloRank: 'Gold Ⅱ 55LP  ·  10W 5L',
            flexRank: 'Unranked',
            totalGames: 3,
            wins: 2,
            losses: 1,
            winRate: 67,
            averageKills: '5.0',
            averageDeaths: '3.3',
            averageAssists: '5.3',
            averageKdaRatio: '3.1',
            championFilter: 'Ahri'
        });
        expect(summary.championStats[0]).toMatchObject({
            championName: 'Ahri',
            games: 2,
            wins: 1,
            losses: 1,
            winRate: 50
        });
        expect(summary.queueStats.map(function(queue) {
            return queue.queueName;
        })).toEqual(['Solo', 'Flex', 'Q999']);
    });

    it('キュー名とチャンピオン検索文字列を正規化する', function() {
        expect(convertQueueName(450)).toBe('ARAM');
        expect(convertQueueName(999)).toBe('Q999');
        expect(isChampionMatched("Kai'Sa", 'kaisa')).toBe(true);
        expect(isChampionMatched('Kha-Zix', 'khazix')).toBe(true);
        expect(isChampionMatched('Ahri', 'akali')).toBe(false);
    });
});
