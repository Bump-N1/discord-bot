import { describe, expect, it } from 'vitest';
import {
    __testables,
    mfhItemCommand,
    mfhSearchCommand
} from '../src/commands/mfh.js';

function commandJson(command) {
    return command.toJSON();
}

function option(command, name) {
    return commandJson(command).options.find(function(item) {
        return item.name === name;
    });
}

describe('MFH command definitions', function() {
    it('日本語の説明文と入力項目を定義する', function() {
        expect(commandJson(mfhSearchCommand)).toMatchObject({
            name: 'mfh-search',
            description: 'MFHの装備・スキル・アイテムなどを検索します'
        });
        expect(commandJson(mfhItemCommand)).toMatchObject({
            name: 'mfh-item',
            description: 'MFHの指定データを詳しく表示します'
        });
        expect(option(mfhSearchCommand, 'keyword')).toMatchObject({
            description: '検索したい名前やキーワードを入力',
            required: true
        });
        expect(option(mfhSearchCommand, 'category').choices.map(function(choice) {
            return choice.name;
        })).toEqual(['武器', '防具', 'スキル', 'タレント', 'アイテム', 'ジェム']);
        expect(option(mfhItemCommand, 'name')).toMatchObject({
            description: '表示したいデータ名を入力',
            required: true,
            autocomplete: true
        });
    });
});

describe('MFH command messages', function() {
    it('詳細表示で重複タグを除き日本語の項目を表示する', function() {
        const embed = __testables.buildMfhDetailEmbed({
            name: 'Celestigold',
            displayName: '天金鉱',
            localizedName: '天金鉱',
            categoryLabel: 'アイテム',
            description: '神の血が鉱脈へ染み込んで固まったもの。',
            url: 'https://mistfallhunter.gamedb.wiki/items/celestigold/',
            localizedTags: ['素材', 'レジェンダリー'],
            subName: '建設素材',
            usage: '装備鍛造に用いる。',
            stats: {
                Category: 'Material',
                Rarity: 'Legendary',
                Use: 'English usage text',
                Tradable: 'No'
            }
        }).toJSON();
        const fields = embed.fields || [];

        expect(fields.map(function(field) {
            return field.name;
        })).toEqual(['カテゴリ', '種類', 'レアリティ', '用途', '取引', 'データ元']);
        expect(fields.find(function(field) {
            return field.name === '用途';
        })).toMatchObject({
            value: '装備鍛造に用いる。',
            inline: false
        });
    });

    it('日本語辞書がない状態の日本語検索では未生成であることを案内する', function() {
        const message = __testables.buildMfhNoResultMessage('天金鉱', 'search', false);

        expect(message).toContain('日本語名検索用のローカル辞書が未生成');
        expect(message).toContain('英語名またはGameDB上の表記');
    });

    it('日本語辞書がある状態では通常の未ヒット案内を返す', function() {
        const message = __testables.buildMfhNoResultMessage('天金鉱', 'search', true);

        expect(message).toBe('「天金鉱」に一致するMFHデータは見つかりませんでした。英語名、GameDB上の表記、短い単語で試してみてください。');
    });

    it('詳細表示の未ヒット時は検索コマンドを案内する', function() {
        const message = __testables.buildMfhNoResultMessage('Celestigold', 'item', true);

        expect(message).toBe('「Celestigold」に一致するMFHデータは見つかりませんでした。まず `/mfh-search` で候補を確認してください。');
    });
});
