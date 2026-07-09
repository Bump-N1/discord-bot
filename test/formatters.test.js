import { afterEach, describe, expect, it } from 'vitest';
import { buildActMessage, buildFf14SelectionPrompt } from '../src/formatters/act-message.js';
import { buildLolEmbed } from '../src/formatters/lol-embed.js';
import { buildOwEmbed } from '../src/formatters/ow-embed.js';
import { __testables as poe2ImageTestables } from '../src/formatters/poe2-market-image.js';

const ENV_KEYS = [
    'LOL_EMOJI_APP',
    'LOL_EMOJI_TOP',
    'LOL_EMOJI_JG',
    'LOL_EMOJI_MID',
    'LOL_EMOJI_ADC',
    'LOL_EMOJI_SUP',
    'LOL_EMOJI_ANY',
    'OW_EMOJI_APP',
    'OW_EMOJI_DAMAGE',
    'FF14_EMOJI_APP',
    'FF14_EMOJI_TANK',
    'FF14_EMOJI_DPS'
];
const originalEnv = Object.fromEntries(ENV_KEYS.map(function(key) {
    return [key, process.env[key]];
}));

afterEach(function() {
    for (const key of ENV_KEYS) {
        if (originalEnv[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = originalEnv[key];
        }
    }
});

function toJsonComponents(components) {
    return components.map(function(component) {
        return component.toJSON();
    });
}

describe('act message formatter', function() {
    it('LoL募集は日本語モード名、詳細、どこでも枠、操作ボタンを表示する', async function() {
        process.env.LOL_EMOJI_APP = '<:lol:100>';
        process.env.LOL_EMOJI_TOP = '<:top:101>';
        process.env.LOL_EMOJI_JG = '<:jg:102>';
        process.env.LOL_EMOJI_MID = '<:mid:103>';
        process.env.LOL_EMOJI_ADC = '<:adc:104>';
        process.env.LOL_EMOJI_SUP = '<:sup:105>';
        process.env.LOL_EMOJI_ANY = '<:any:106>';

        const message = await buildActMessage({
            id: 'party',
            game: 'lol',
            mode: 'Normal',
            datetime: '7月10日 20時',
            details: '誰でも',
            status: 'open',
            usesSlots: true,
            slots: {
                top: 'u1',
                jungle: null,
                middle: null,
                bottom: null,
                utility: null
            },
            multiParticipants: {
                any: ['u2']
            },
            participants: []
        }, null);
        const embed = message.embeds[0].toJSON();
        const components = toJsonComponents(message.components);

        expect(embed.title).toBe('<:lol:100>  ノーマル（ドラフト）');
        expect(embed.description).toContain('日時: 7月10日 20時');
        expect(embed.description).toContain('詳細: 誰でも');
        expect(embed.description).toContain('<:top:101> <@u1>');
        expect(embed.description).toContain('<:any:106> <@u2>');
        expect(components[0].components[0].options.map(function(option) {
            return option.label;
        })).toEqual(['トップ', 'ジャングル', 'ミッド', 'ボット', 'サポート', 'どこでも']);
        expect(components[1].components.map(function(component) {
            return component.label;
        })).toEqual(['参加', '編集', '抜ける', '締め切る']);
    });

    it('Web管理募集は通常操作ボタンを出さず参加・編集リンクだけ表示する', async function() {
        const message = await buildActMessage({
            id: 'party',
            game: 'ow',
            mode: 'Quick',
            datetime: '7月10日 20時',
            details: '誰でも',
            status: 'open',
            usesSlots: true,
            webManaged: true,
            slots: {
                tank: null,
                damage1: null,
                damage2: null,
                support1: null,
                support2: null
            },
            multiParticipants: {
                flex: []
            },
            participants: []
        }, null);
        const components = toJsonComponents(message.components);

        expect(components).toHaveLength(1);
        expect(components[0].components[0]).toMatchObject({
            label: '参加・編集',
            custom_id: 'act:open-web:party'
        });
    });

    it('FF14参加フォームは選択状態に応じてジョブ行と参加ボタンを制御する', async function() {
        const prompt = await buildFf14SelectionPrompt({
            id: 'party',
            game: 'ff14',
            partyType: 'LIGHT PARTY',
            ff14RoleSelection: 'ON'
        }, null, {
            roleKey: 'tank',
            jobKey: 'warrior'
        });
        const components = toJsonComponents(prompt.components);

        expect(prompt.content).toBe('タンクを選択中');
        expect(components).toHaveLength(3);
        expect(components[1].components[0].placeholder).toBe('タンクのジョブを選択');
        expect(components[1].components[0].options.at(-1)).toMatchObject({
            label: 'ジョブ指定無し',
            value: 'tank_any'
        });
        expect(components[2].components[0].disabled).toBe(false);
    });

    it('締め切り中は解除ボタンだけを表示する', async function() {
        const message = await buildActMessage({
            id: 'party',
            game: 'lol',
            mode: 'ARAM',
            datetime: '7月10日 20時',
            details: '誰でも',
            status: 'closed',
            closedAt: new Date().toISOString(),
            usesSlots: false,
            participants: []
        }, null);
        const components = toJsonComponents(message.components);

        expect(message.embeds[0].toJSON().title).toContain('（締切）');
        expect(components[0].components[0]).toMatchObject({
            label: '締め切り解除',
            custom_id: 'act:reopen:party'
        });
    });
});

describe('stats embed formatters', function() {
    it('LoL戦績Embedは通常/チャンピオン指定でタイトルと色を切り替える', function() {
        const summary = {
            riotId: 'Bump#000',
            championFilter: 'Akali',
            wins: 6,
            losses: 4,
            winRate: 60,
            averageKills: 5,
            averageDeaths: 3,
            averageAssists: 8,
            averageKdaRatio: '4.33',
            soloRank: 'Gold I',
            flexRank: 'Silver II',
            queueStats: [
                {
                    queueName: 'Ranked',
                    wins: 6,
                    losses: 4,
                    winRate: 60
                }
            ],
            championStats: [
                {
                    championName: 'Akali',
                    wins: 3,
                    losses: 1,
                    winRate: 75
                }
            ],
            matches: [
                {
                    win: true,
                    championName: 'Akali',
                    kills: 10,
                    deaths: 2,
                    assists: 4,
                    kdaRatio: '7.00',
                    queueName: 'Ranked',
                    gameDurationText: '25:00'
                }
            ]
        };

        expect(buildLolEmbed(summary, false).toJSON()).toMatchObject({
            title: 'Bump#000',
            color: 0x5865F2
        });
        expect(buildLolEmbed(summary, true).toJSON()).toMatchObject({
            title: 'Bump#000 / Akali',
            color: 0xC0392B
        });
    });

    it('OWヒーロー指定Embedはヒーロー別戦績なしと画像を表示する', function() {
        const embed = buildOwEmbed({
            selectedHero: 'Kiriko',
            selectedRole: '',
            hasSelectedHeroStats: false,
            hasSelectedRoleStats: true,
            player: {
                name: 'Player',
                title: 'Nomad',
                avatar: 'https://example.com/avatar.png',
                namecard: 'https://example.com/card.png'
            },
            hero: {
                role: 'support',
                portrait: 'https://example.com/kiriko.png'
            },
            ranks: [],
            stats: {
                mode: 'Quick',
                games: '10',
                wins: '5',
                losses: '5',
                winRate: '50%',
                kda: '3.00',
                avgDamage: '-',
                avgHealing: '6000'
            },
            roleStats: []
        }).toJSON();

        expect(embed.title).toBe('Player / Kiriko');
        expect(embed.description).toContain('SUPPORT');
        expect(embed.fields[1].value).toContain('ヒーロー別戦績なし');
        expect(embed.thumbnail.url).toBe('https://example.com/kiriko.png');
        expect(embed.image.url).toBe('https://example.com/card.png');
    });
});

describe('PoE2 market image text helpers', function() {
    it('相場表示と取得元表記を整形する', function() {
        expect(poe2ImageTestables.formatPrice({
            lowestPrice: 1,
            highestPrice: 1
        })).toBe('1.0');
        expect(poe2ImageTestables.formatPrice({
            lowestPrice: 0.125,
            highestPrice: 0.25
        })).toBe('0.125 - 0.25');
        expect(poe2ImageTestables.formatPrice(null)).toBe('取引なし');
        expect(poe2ImageTestables.buildFooterText({
            source: 'poe-ninja'
        })).toBe('取得元: poe.ninja');
    });
});
