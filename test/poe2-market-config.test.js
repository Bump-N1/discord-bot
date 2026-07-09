import { afterEach, describe, expect, it } from 'vitest';
import {
    getPoe2MarketConfig,
    shouldUseOfficialMarketApi,
    validatePoe2MarketConfig
} from '../src/services/poe2/poe2-market-config.js';

const ENV_KEYS = [
    'POE2_MARKET_PROVIDER',
    'POE2_ACCESS_TOKEN',
    'POE2_CLIENT_ID',
    'POE2_CLIENT_SECRET',
    'POE2_LEAGUE',
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
    it('未設定時はauto provider / auto leagueを使う', function() {
        for (const key of ENV_KEYS) {
            delete process.env[key];
        }

        const config = getPoe2MarketConfig();

        expect(config).toMatchObject({
            provider: 'auto',
            league: 'auto',
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

    it('providerと必須値を検証する', function() {
        expect(function() {
            validatePoe2MarketConfig({
                provider: 'bad',
                league: 'auto',
                userAgent: 'discord-bot'
            });
        }).toThrow('POE2_MARKET_PROVIDER must be poe-ninja, official or auto.');

        expect(function() {
            validatePoe2MarketConfig({
                provider: 'poe-ninja',
                league: 'auto',
                userAgent: ''
            });
        }).toThrow('POE2_USER_AGENT is not set.');
    });

    it('official providerは認証情報を必須にする', function() {
        expect(function() {
            validatePoe2MarketConfig({
                provider: 'official',
                league: 'auto',
                userAgent: 'discord-bot',
                accessToken: '',
                clientId: '',
                clientSecret: ''
            });
        }).toThrow('POE2_ACCESS_TOKEN or POE2_CLIENT_ID/POE2_CLIENT_SECRET is not set.');

        expect(function() {
            validatePoe2MarketConfig({
                provider: 'official',
                league: 'auto',
                userAgent: 'discord-bot',
                accessToken: 'token'
            });
        }).not.toThrow();
    });

    it('auto providerは認証情報がある時だけ公式APIを使う', function() {
        expect(shouldUseOfficialMarketApi({
            provider: 'auto',
            accessToken: ''
        })).toBe(false);
        expect(shouldUseOfficialMarketApi({
            provider: 'auto',
            accessToken: 'token'
        })).toBe(true);
        expect(shouldUseOfficialMarketApi({
            provider: 'poe-ninja',
            accessToken: 'token'
        })).toBe(false);
        expect(shouldUseOfficialMarketApi({
            provider: 'official',
            accessToken: ''
        })).toBe(true);
    });
});
