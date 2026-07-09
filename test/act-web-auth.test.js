import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildActCreateUrl,
    buildActManageUrl,
    buildArkBackupUrl,
    buildArkEditUrl,
    buildPoe2EditUrl,
    getActWebHost,
    getActWebPort,
    isActWebConfigured,
    LEGACY_POE2_EDIT_SCOPE,
    POE2_EDIT_SCOPE,
    verifyActWebToken
} from '../src/services/act/act-web-auth.js';
import {
    dismissEphemeralWebReply,
    registerEphemeralWebReply
} from '../src/services/act/ephemeral-web-link.js';

const ENV_KEYS = [
    'ACT_WEB_BASE_URL',
    'ACT_WEB_SIGNING_SECRET',
    'ACT_WEB_PORT',
    'ACT_WEB_HOST'
];

const originalEnv = Object.fromEntries(ENV_KEYS.map(function(key) {
    return [key, process.env[key]];
}));

afterEach(function() {
    vi.useRealTimers();

    for (const key of ENV_KEYS) {
        if (originalEnv[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = originalEnv[key];
        }
    }
});

function configureWeb() {
    process.env.ACT_WEB_BASE_URL = 'https://act.example.test/base/';
    process.env.ACT_WEB_SIGNING_SECRET = 'test-secret';
}

function getToken(url) {
    return new URL(url).searchParams.get('token') || '';
}

describe('act web auth', function() {
    it('Web設定の有無とホスト/ポートを判定する', function() {
        delete process.env.ACT_WEB_BASE_URL;
        delete process.env.ACT_WEB_SIGNING_SECRET;
        process.env.ACT_WEB_PORT = '-1';
        delete process.env.ACT_WEB_HOST;

        expect(isActWebConfigured()).toBe(false);
        expect(getActWebPort()).toBe(3100);
        expect(getActWebHost()).toBe('0.0.0.0');

        process.env.ACT_WEB_BASE_URL = 'https://act.example.test/';
        process.env.ACT_WEB_SIGNING_SECRET = 'secret';
        process.env.ACT_WEB_PORT = '3200';
        process.env.ACT_WEB_HOST = '127.0.0.1';

        expect(isActWebConfigured()).toBe(true);
        expect(getActWebPort()).toBe(3200);
        expect(getActWebHost()).toBe('127.0.0.1');
    });

    it('募集作成/管理リンクに正しいscopeを入れて署名する', function() {
        configureWeb();

        const createUrl = buildActCreateUrl({
            game: 'ff14',
            guildId: 'guild'
        });
        const manageUrl = buildActManageUrl({
            partyId: 'party',
            userId: 'user'
        });

        expect(new URL(createUrl).pathname).toBe('/act/');
        expect(verifyActWebToken(getToken(createUrl), 'create')).toMatchObject({
            scope: 'create',
            game: 'ff14',
            guildId: 'guild'
        });
        expect(verifyActWebToken(getToken(manageUrl), 'manage')).toMatchObject({
            scope: 'manage',
            partyId: 'party',
            userId: 'user'
        });
    });

    it('PoE2/ARKリンクに用途別scopeを入れる', function() {
        configureWeb();

        expect(verifyActWebToken(getToken(buildPoe2EditUrl({
            guildId: 'guild'
        })), [POE2_EDIT_SCOPE, LEGACY_POE2_EDIT_SCOPE])).toMatchObject({
            scope: POE2_EDIT_SCOPE,
            guildId: 'guild'
        });
        expect(verifyActWebToken(getToken(buildArkEditUrl({
            channelId: 'channel'
        })), 'ark-edit')).toMatchObject({
            scope: 'ark-edit',
            channelId: 'channel'
        });
        expect(verifyActWebToken(getToken(buildArkBackupUrl({
            channelId: 'channel'
        })), 'ark-backup')).toMatchObject({
            scope: 'ark-backup',
            channelId: 'channel'
        });
    });

    it('署名改ざん、scope違い、期限切れを拒否する', function() {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-09T00:00:00.000Z'));
        configureWeb();

        const token = getToken(buildActCreateUrl({
            guildId: 'guild'
        }));

        expect(function() {
            verifyActWebToken(`${token.slice(0, -1)}x`, 'create');
        }).toThrow('リンクが正しくありません。');
        expect(function() {
            verifyActWebToken(token, 'manage');
        }).toThrow('この操作には使用できないリンクです。');

        vi.setSystemTime(new Date('2026-07-09T00:31:00.000Z'));

        expect(function() {
            verifyActWebToken(token, 'create');
        }).toThrow('リンクの有効期限が切れました。Discordからもう一度開いてください。');
    });

    it('Web未設定時はURL生成と検証を拒否する', function() {
        delete process.env.ACT_WEB_BASE_URL;
        delete process.env.ACT_WEB_SIGNING_SECRET;

        expect(function() {
            buildActCreateUrl({});
        }).toThrow('Web画面が設定されていません。');
        expect(function() {
            verifyActWebToken('invalid');
        }).toThrow('Web画面が設定されていません。');
    });
});

describe('ephemeral web reply dismissal', function() {
    it('登録したリンクのtokenで返信を削除する', async function() {
        configureWeb();
        const deleteReply = vi.fn().mockResolvedValue(undefined);
        const url = buildPoe2EditUrl({
            guildId: 'guild'
        });
        const token = getToken(url);

        registerEphemeralWebReply(url, {
            deleteReply: deleteReply
        });

        await expect(dismissEphemeralWebReply(token)).resolves.toBe(true);
        expect(deleteReply).toHaveBeenCalledTimes(1);
        await expect(dismissEphemeralWebReply(token)).resolves.toBe(false);
    });

    it('期限切れや削除失敗時はfalseを返す', async function() {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-09T00:00:00.000Z'));
        configureWeb();
        const url = buildPoe2EditUrl({
            guildId: 'guild'
        });
        const token = getToken(url);

        registerEphemeralWebReply(url, {
            deleteReply: vi.fn().mockResolvedValue(undefined)
        });

        vi.setSystemTime(new Date('2026-07-09T00:16:00.000Z'));
        await expect(dismissEphemeralWebReply(token)).resolves.toBe(false);

        const failingUrl = buildPoe2EditUrl({
            guildId: 'guild'
        });
        const failingToken = getToken(failingUrl);
        registerEphemeralWebReply(failingUrl, {
            deleteReply: vi.fn().mockRejectedValue(new Error('delete failed'))
        });

        await expect(dismissEphemeralWebReply(failingToken)).resolves.toBe(false);
    });
});
