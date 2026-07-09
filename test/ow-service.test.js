import { describe, expect, it } from 'vitest';
import { __testables } from '../src/services/overwatch/ow-service.js';

const {
    buildHeroSummary,
    buildSummary,
    extractRanks,
    extractRoleStats,
    formatRank,
    normalizeHeroSearchText
} = __testables;

describe('OW service summary helpers', function() {
    it('ランク表記を複数形式から整形する', function() {
        expect(formatRank('top 500')).toBe('Top 500');
        expect(formatRank({
            division: 'gold',
            tier: 3
        })).toBe('Gold Ⅲ');
        expect(formatRank({
            skill_rating: 2500
        })).toBe('2500 SR');
        expect(formatRank(null)).toBe('-');
    });

    it('DamageはOverFastのoffense表記からもランクを取得する', function() {
        expect(extractRanks({
            competitive: {
                pc: {
                    tank: {
                        division: 'silver',
                        tier: 2
                    },
                    offense: {
                        division: 'platinum',
                        tier: 1
                    },
                    support: 'diamond'
                }
            }
        }, '')).toEqual([
            {
                roleKey: 'tank',
                role: 'Tank',
                rank: 'Silver Ⅱ'
            },
            {
                roleKey: 'damage',
                role: 'Damage',
                rank: 'Platinum Ⅰ'
            },
            {
                roleKey: 'support',
                role: 'Support',
                rank: 'Diamond'
            }
        ]);
    });

    it('全体統計とロール統計を整形する', function() {
        const summary = buildSummary({
            name: 'Bump',
            player_id: 'Bump-1234',
            competitive: {
                pc: {
                    offense: {
                        division: 'gold',
                        tier: 1
                    }
                }
            }
        }, {
            general: {
                games_played: '10',
                games_won: '6',
                eliminations: 100,
                assists: 20,
                deaths: 10,
                damage_done: 50000,
                healing_done: 12000
            },
            roles: {
                pc: {
                    offense: {
                        games_played: 5,
                        games_won: 3,
                        eliminations: 80,
                        assists: 10,
                        deaths: 10,
                        damage_done: 30000
                    }
                }
            }
        }, 'Bump#1234', 'Bump-1234', '');

        expect(summary.player).toMatchObject({
            name: 'Bump',
            playerId: 'Bump-1234'
        });
        expect(summary.stats).toMatchObject({
            mode: 'Rival',
            games: '10',
            wins: '6',
            losses: '4',
            winRate: '60%',
            kda: '12.0',
            avgDamage: '5,000',
            avgHealing: '1,200'
        });
        expect(summary.roleStats).toHaveLength(1);
        expect(summary.roleStats[0]).toMatchObject({
            roleKey: 'damage',
            role: 'Damage',
            games: '5',
            wins: '3',
            winRate: '60%'
        });
    });

    it('指定ロール統計がない場合は空表示を返す', function() {
        const summary = buildSummary({}, null, 'Player#1234', 'Player-1234', 'support');

        expect(summary).toMatchObject({
            selectedRole: 'Support',
            hasSelectedRoleStats: false,
            stats: {
                mode: 'Rival',
                role: 'Support',
                games: '-',
                wins: '-',
                winRate: '-'
            }
        });
    });

    it('ヒーロー別統計と検索文字列を整形する', function() {
        const summary = buildHeroSummary({}, {
            heroes: {
                kiriko: {
                    gamesPlayed: 4,
                    gamesWon: 3,
                    deaths: 8,
                    eliminations: 40,
                    assists: 24,
                    healing: 20000
                }
            }
        }, 'Player#1234', 'Player-1234', {
            key: 'kiriko',
            name: 'Kiriko',
            role: 'support'
        });

        expect(summary).toMatchObject({
            selectedHero: 'Kiriko',
            hasSelectedHeroStats: true,
            stats: {
                heroKey: 'kiriko',
                hero: 'Kiriko',
                role: 'Support',
                games: '4',
                wins: '3',
                losses: '1',
                winRate: '75%',
                kda: '8.0',
                avgHealing: '5,000'
            }
        });
        expect(normalizeHeroSearchText('Lúcio')).toBe('lucio');
        expect(extractRoleStats(null)).toEqual([]);
    });
});
