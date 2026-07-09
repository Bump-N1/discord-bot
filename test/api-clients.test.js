import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOverfastPlayerId, overfastFetch } from '../src/services/overwatch/overwatch-client.js';

const originalFetch = global.fetch;
const originalRiotApiKey = process.env.RIOT_API_KEY;

function jsonResponse(payload, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status: status,
        json: async function() {
            return payload;
        },
        text: async function() {
            return JSON.stringify(payload);
        }
    };
}

beforeEach(function() {
    vi.resetModules();
});

afterEach(function() {
    global.fetch = originalFetch;

    if (originalRiotApiKey === undefined) {
        delete process.env.RIOT_API_KEY;
    } else {
        process.env.RIOT_API_KEY = originalRiotApiKey;
    }
});

describe('OverFast client', function() {
    it('BattleTagをOverFast用IDへ変換する', function() {
        expect(buildOverfastPlayerId('Player#1234')).toBe('Player-1234');
        expect(function() {
            buildOverfastPlayerId('Player');
        }).toThrow('BattleTagは `名前#タグ` の形式で指定してください。');
    });

    it('OverFastの404/429を分かるメッセージに変換する', async function() {
        global.fetch = vi.fn(async function() {
            return jsonResponse({}, 404);
        });

        await expect(overfastFetch('/players/private')).rejects.toThrow('player not found or profile is private');

        global.fetch = vi.fn(async function() {
            return jsonResponse({}, 429);
        });

        await expect(overfastFetch('/players/limited')).rejects.toThrow('rate limit exceeded');
    });
});

describe('Riot client', function() {
    it('Riot APIキーをヘッダーに付与してJSONを返す', async function() {
        process.env.RIOT_API_KEY = 'riot-key';
        global.fetch = vi.fn(async function() {
            return jsonResponse({
                ok: true
            });
        });

        const { riotFetch } = await import('../src/services/riot/riot-client.js');

        await expect(riotFetch('https://asia.api.riotgames.com/test')).resolves.toEqual({
            ok: true
        });
        expect(global.fetch).toHaveBeenCalledWith('https://asia.api.riotgames.com/test', {
            headers: {
                'X-Riot-Token': 'riot-key'
            }
        });
    });

    it('Riot APIの代表的なエラーを用途別メッセージに変換する', async function() {
        process.env.RIOT_API_KEY = 'riot-key';
        global.fetch = vi.fn(async function() {
            return jsonResponse({}, 403);
        });

        const { riotFetch } = await import('../src/services/riot/riot-client.js');

        await expect(riotFetch('https://jp1.api.riotgames.com/test')).rejects.toThrow('API access denied');
    });
});
