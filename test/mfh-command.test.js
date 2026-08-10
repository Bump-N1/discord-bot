import { describe, expect, it } from 'vitest';
import { mfhItemCommand, mfhSearchCommand } from '../src/commands/mfh.js';

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
