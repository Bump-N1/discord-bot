import { afterEach, describe, expect, it } from 'vitest';
import {
    getPoe2MarketConfig,
    validatePoe2MarketConfig
} from '../src/services/poe2/poe2-market-config.js';

const ENV_KEYS = [
    'POE2_LEAGUE',
    'POE2_REALM',
    'POE2_USER_AGENT',
    'POE2_MARKET_MONITOR_INTERVAL_MS',
    'POE2_MARKET_LOOKBACK_HOURS'
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

describe('PoE2 market config', function() {
    it('未設定時は公開CDNのPC realm / auto leagueを使う', function() {
        for (const key of ENV_KEYS) {
            delete process.env[key];
        }

        const config = getPoe2MarketConfig();

        expect(config).toMatchObject({
            league: 'auto',
            realm: 'poe2',
            userAgent: '',
            monitorIntervalMs: 300000,
            lookbackHours: 24
        });
    });

    it('正の数値だけ環境変数から採用する', function() {
        process.env.POE2_MARKET_MONITOR_INTERVAL_MS = '600000';
        process.env.POE2_MARKET_LOOKBACK_HOURS = '-1';

        const config = getPoe2MarketConfig();

        expect(config.monitorIntervalMs).toBe(600000);
        expect(config.lookbackHours).toBe(24);
    });

    it('realmと必須値を検証する', function() {
        expect(function() {
            validatePoe2MarketConfig({
                realm: 'bad',
                league: 'auto',
                userAgent: 'discord-bot'
            });
        }).toThrow('POE2_REALM must be poe2, xbox or sony.');

        expect(function() {
            validatePoe2MarketConfig({
                realm: 'poe2',
                league: 'auto',
                userAgent: ''
            });
        }).toThrow('POE2_USER_AGENT is not set.');
    });

    it('公開CDNはOAuth認証情報なしで利用できる', function() {
        expect(function() {
            validatePoe2MarketConfig({
                realm: 'sony',
                league: 'auto',
                userAgent: 'discord-bot'
            });
        }).not.toThrow();
    });
});
