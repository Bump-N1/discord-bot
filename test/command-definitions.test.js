import { describe, expect, it } from 'vitest';
import {
    ff14ActCommand,
    lolActCommand,
    owActCommand
} from '../src/commands/act.js';
import {
    arkBackupCommand,
    arkEditCommand,
    arkJoinCommand,
    arkRebootCommand,
    arkRestoreCommand,
    arkSettingsCommand,
    arkStatusCommand
} from '../src/commands/ark.js';
import { lolChampionCommand } from '../src/commands/lol-champion.js';
import { lolCommand } from '../src/commands/lol.js';
import { owHeroCommand } from '../src/commands/ow-hero.js';
import { owCommand } from '../src/commands/ow.js';
import { poe2EditCommand, poe2MarketCommand } from '../src/commands/poe2.js';

function commandJson(command) {
    return command.toJSON();
}

function option(command, name) {
    return commandJson(command).options.find(function(item) {
        return item.name === name;
    });
}

describe('slash command definitions', function() {
    it('募集コマンド名と説明文を固定する', function() {
        expect(commandJson(ff14ActCommand)).toMatchObject({
            name: 'act-ff14',
            description: 'FF14の募集を作成します'
        });
        expect(commandJson(lolActCommand)).toMatchObject({
            name: 'act-lol',
            description: 'LoLの募集を作成します'
        });
        expect(commandJson(owActCommand)).toMatchObject({
            name: 'act-ow',
            description: 'OWの募集を作成します'
        });
    });

    it('募集コマンドの選択肢を固定する', function() {
        expect(option(ff14ActCommand, 'mode')).toMatchObject({
            description: 'コンテンツ人数を選択（LIGHT PARTY / FULL PARTY）',
            choices: [
                {
                    name: 'LIGHT PARTY',
                    value: 'LIGHT PARTY'
                },
                {
                    name: 'FULL PARTY',
                    value: 'FULL PARTY'
                }
            ]
        });
        expect(option(lolActCommand, 'mode').choices.map(function(choice) {
            return choice.value;
        })).toEqual(['Normal', 'Flex', 'ARAM']);
        expect(option(owActCommand, 'mode').choices.map(function(choice) {
            return choice.value;
        })).toEqual(['Quick', 'Rival', 'Stadium']);
    });

    it('戦績コマンド名と説明文を固定する', function() {
        expect(commandJson(lolCommand)).toMatchObject({
            name: 'lol-stats',
            description: 'LoLの直近戦績を表示します'
        });
        expect(commandJson(lolChampionCommand)).toMatchObject({
            name: 'lol-stats-champion',
            description: '指定チャンピオンだけの直近戦績を表示します'
        });
        expect(commandJson(owCommand)).toMatchObject({
            name: 'ow-stats',
            description: 'OWの戦績を表示します'
        });
        expect(commandJson(owHeroCommand)).toMatchObject({
            name: 'ow-stats-hero',
            description: '指定ヒーローだけの戦績を表示します'
        });
    });

    it('OW戦績のロール表記はDamageを使う', function() {
        expect(option(owCommand, 'role').choices).toEqual([
            {
                name: 'Tank',
                value: 'tank'
            },
            {
                name: 'Damage',
                value: 'damage'
            },
            {
                name: 'Support',
                value: 'support'
            }
        ]);
    });

    it('ARKコマンド名と説明文を固定する', function() {
        expect([
            arkJoinCommand,
            arkStatusCommand,
            arkSettingsCommand,
            arkEditCommand,
            arkRebootCommand,
            arkBackupCommand,
            arkRestoreCommand
        ].map(function(command) {
            const json = commandJson(command);

            return {
                name: json.name,
                description: json.description,
                options: json.options
            };
        })).toEqual([
            {
                name: 'ark-join',
                description: 'ARKサーバーへの参加方法を表示します',
                options: []
            },
            {
                name: 'ark-status',
                description: 'ARKサーバーの状態を表示します',
                options: []
            },
            {
                name: 'ark-settings',
                description: 'ARKサーバー設定を表示します',
                options: []
            },
            {
                name: 'ark-edit',
                description: 'ARKサーバーのMAPとMODをWeb画面で編集します',
                options: []
            },
            {
                name: 'ark-reboot',
                description: 'ARKサーバーを再起動します',
                options: []
            },
            {
                name: 'ark-backup',
                description: 'ARKサーバーデータをバックアップします',
                options: []
            },
            {
                name: 'ark-restore',
                description: 'ARKバックアップの復元画面を開きます',
                options: []
            }
        ]);
    });

    it('PoE2コマンド名と説明文を固定する', function() {
        expect(commandJson(poe2MarketCommand)).toMatchObject({
            name: 'poe2-market',
            description: 'PoE2の相場画像の定期投稿を開始・停止します'
        });
        expect(commandJson(poe2EditCommand)).toMatchObject({
            name: 'poe2-edit',
            description: 'PoE2相場画像に表示するアイテムを設定します'
        });
    });
});
