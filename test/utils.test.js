import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    calculateKdaRatio,
    createCodeBlock,
    formatDuration,
    normalizeSearchText,
    padText,
    sum
} from '../src/utils/format.js';
import { parseRiotId } from '../src/utils/riot-id.js';
import {
    resolveEmojiComponent,
    resolveEmojiText
} from '../src/utils/discord-emoji.js';

const ENV_KEYS = ['TEST_EMOJI'];
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

describe('format utils', function() {
    it('表示整形の基本動作を固定する', function() {
        expect(padText('TOP', 5)).toBe('TOP  ');
        expect(createCodeBlock('hello')).toBe('```\nhello\n```');
        expect(normalizeSearchText("Kai'Sa・Test-Name")).toBe('kaisatestname');
        expect(calculateKdaRatio(10, 0, 5)).toBe('15.0');
        expect(formatDuration(125)).toBe('2:05');
        expect(sum([
            {
                value: 1
            },
            {
                value: 2
            }
        ], 'value')).toBe(3);
    });
});

describe('riot id utils', function() {
    it('半角/全角シャープを受け付け、末尾の#で分割する', function() {
        expect(parseRiotId(' Bump ＃ JP1 ')).toEqual({
            gameName: 'Bump',
            tagLine: 'JP1'
        });
        expect(parseRiotId('Name#With#Tag')).toEqual({
            gameName: 'Name#With',
            tagLine: 'Tag'
        });
        expect(function() {
            parseRiotId('Bump');
        }).toThrow('Riot IDは `名前#タグ` の形式で指定してください。');
        expect(function() {
            parseRiotId('#JP1');
        }).toThrow('Riot IDは `名前#タグ` の形式で指定してください。');
    });
});

describe('discord emoji utils', function() {
    it('カスタム絵文字文字列をそのまま表示・コンポーネント化する', async function() {
        process.env.TEST_EMOJI = '<a:test_emoji:12345>';

        await expect(resolveEmojiText(null, 'TEST_EMOJI', 'fallback')).resolves.toBe('<a:test_emoji:12345>');
        await expect(resolveEmojiComponent(null, 'TEST_EMOJI')).resolves.toEqual({
            id: '12345',
            name: 'test_emoji',
            animated: true
        });
    });

    it('サーバー絵文字を名前から解決し、見つからない場合はフォールバックする', async function() {
        const emoji = {
            id: '111',
            name: 'lol_top',
            animated: false,
            toString() {
                return '<:lol_top:111>';
            }
        };
        const guild = {
            id: 'guild',
            emojis: {
                cache: {
                    find(predicate) {
                        return predicate(emoji) ? emoji : null;
                    }
                },
                fetch: vi.fn()
            }
        };

        process.env.TEST_EMOJI = 'lol_top';

        await expect(resolveEmojiText(guild, 'TEST_EMOJI', 'TOP')).resolves.toBe('<:lol_top:111>');
        await expect(resolveEmojiComponent(guild, 'TEST_EMOJI')).resolves.toEqual({
            id: '111',
            name: 'lol_top',
            animated: false
        });
        expect(guild.emojis.fetch).not.toHaveBeenCalled();

        process.env.TEST_EMOJI = 'missing';
        await expect(resolveEmojiText(guild, 'TEST_EMOJI', 'TOP')).resolves.toBe('TOP');
    });
});
