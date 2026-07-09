import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_ARK_CONFIG, getArkConfig } from '../src/services/ark/ark-config.js';

const ENV_KEYS = [
    'ARK_STATUS_POLL_MS',
    'ARK_CONFIG_HISTORY_POLL_MS',
    'ARK_BACKUP_POLL_MS',
    'ARK_BACKUP_INTERVAL_HOURS',
    'ARK_BACKUP_RETENTION_COUNT',
    'ARK_BACKUP_DIR',
    'ARK_NOTIFY_CHANNEL_ID',
    'NITRADO_TOKEN',
    'NITRADO_SERVICE_ID',
    'CURSEFORGE_API_KEY',
    'ARK_SERVER_NAME',
    'ARK_MAP_OPTIONS'
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

describe('ARK config', function() {
    it('環境変数がない場合は安全な既定値を返す', function() {
        for (const key of ENV_KEYS) {
            delete process.env[key];
        }

        const config = getArkConfig();

        expect(config.statusPollMs).toBe(DEFAULT_ARK_CONFIG.statusPollMs);
        expect(config.configHistoryPollMs).toBe(DEFAULT_ARK_CONFIG.configHistoryPollMs);
        expect(config.backupPollMs).toBe(DEFAULT_ARK_CONFIG.backupPollMs);
        expect(config.backupIntervalHours).toBe(DEFAULT_ARK_CONFIG.backupIntervalHours);
        expect(config.backupRetentionCount).toBe(DEFAULT_ARK_CONFIG.backupRetentionCount);
        expect(config.backupDirectory).toBe('data/ark-backups');
        expect(config.notifyChannelId).toBe('');
        expect(config.serverName).toBe('');
        expect(config.mapOptions.map(function(option) {
            return option.label;
        })).toEqual([
            'The Island',
            'Scorched Earth',
            'The Center',
            'Aberration',
            'Extinction',
            'Ragnarok',
            'Astraeos',
            'Valguero',
            'Lost Colony',
            'Genesis 1'
        ]);
    });

    it('MAP候補を環境変数から読み込む', function() {
        process.env.ARK_MAP_OPTIONS = 'TheIsland:The Island,Genesis:Genesis 1,CustomOnly';

        expect(getArkConfig().mapOptions).toEqual([
            { value: 'TheIsland', label: 'The Island' },
            { value: 'Genesis', label: 'Genesis 1' },
            { value: 'CustomOnly', label: 'CustomOnly' }
        ]);
    });

    it('数値環境変数は正の数だけ採用する', function() {
        process.env.ARK_STATUS_POLL_MS = '30000';
        process.env.ARK_BACKUP_INTERVAL_HOURS = '-1';

        const config = getArkConfig();

        expect(config.statusPollMs).toBe(30000);
        expect(config.backupIntervalHours).toBe(DEFAULT_ARK_CONFIG.backupIntervalHours);
    });
});
