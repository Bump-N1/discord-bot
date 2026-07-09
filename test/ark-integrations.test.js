import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    fetchNitradoServerConfig,
    fetchNitradoSettings,
    updateNitradoServerConfig
} from '../src/services/ark/nitrado-client.js';
import {
    fetchCurseForgeModDetails,
    validateCurseForgeModDetails
} from '../src/services/ark/curseforge-client.js';
import { __testables as arkMonitorTestables } from '../src/services/ark/ark-monitor.js';
import { __testables as arkBackupMonitorTestables } from '../src/services/ark/ark-backup-monitor.js';

const originalFetch = global.fetch;
let originalCwd;
let tempDir;

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

function textResponse(text, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status: status,
        text: async function() {
            return text;
        },
        json: async function() {
            return JSON.parse(text);
        },
        arrayBuffer: async function() {
            const buffer = Buffer.from(text, 'utf8');

            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        }
    };
}

function nitradoConfig(fields = {}) {
    return {
        nitradoToken: 'token',
        nitradoServiceId: 'service',
        serverName: 'Bump_ARK',
        ...fields
    };
}

beforeEach(async function() {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'ark-integrations-'));
    process.chdir(tempDir);
    vi.resetModules();
});

afterEach(async function() {
    global.fetch = originalFetch;
    process.chdir(originalCwd);
    await rm(tempDir, {
        recursive: true,
        force: true
    });
});

describe('Nitrado client integration helpers', function() {
    it('サーバー設定はNitradoのsettingsを優先して正規化する', async function() {
        global.fetch = vi.fn(async function(url) {
            const requestUrl = new URL(String(url));

            if (requestUrl.pathname.endsWith('/gameservers')) {
                return jsonResponse({
                    data: {
                        gameserver: {
                            status: 'started',
                            query: {
                                server_name: 'nitrado.net Gameserver',
                                player_current: 2,
                                player_max: 20
                            }
                        }
                    }
                });
            }

            if (requestUrl.pathname.endsWith('/gameservers/settings')) {
                return jsonResponse({
                    data: {
                        settings: {
                            config: {
                                map: 'GenesisDLC',
                                'active-mods': '111,abc,222',
                                'server-name': 'Bump_ARK'
                            }
                        }
                    }
                });
            }

            throw new Error(`unexpected fetch ${requestUrl.href}`);
        });

        await expect(fetchNitradoServerConfig(nitradoConfig())).resolves.toMatchObject({
            serverName: 'Bump_ARK',
            map: 'Genesis',
            mapLabel: 'Genesis 1',
            activeMods: ['111', '222'],
            playerCount: 2,
            maxPlayers: 20,
            status: 'started'
        });
    });

    it('MAPとMOD更新時はNitrado settingsへ必要な値だけPOSTする', async function() {
        const postedBodies = [];

        global.fetch = vi.fn(async function(url, options = {}) {
            const requestUrl = new URL(String(url));

            if (options.method === 'POST') {
                postedBodies.push(JSON.parse(options.body));
                return textResponse('');
            }

            if (requestUrl.pathname.endsWith('/gameservers/settings')) {
                return jsonResponse({
                    data: {
                        settings: {
                            config: {
                                'server-name': 'Bump_ARK'
                            }
                        }
                    }
                });
            }

            throw new Error(`unexpected fetch ${requestUrl.href}`);
        });

        await updateNitradoServerConfig(nitradoConfig(), {
            map: 'AstraeosDLC',
            activeMods: ['111', '222']
        });

        expect(postedBodies).toEqual([
            {
                category: 'config',
                key: 'map',
                value: 'AstraeosDLC'
            },
            {
                category: 'config',
                key: 'active-mods',
                value: '111,222'
            },
            {
                category: 'config',
                key: 'server-name',
                value: 'Bump_ARK'
            }
        ]);
    });

    it('INIファイルからARK設定値を読み取って表示値へ変換する', async function() {
        global.fetch = vi.fn(async function(url) {
            const requestUrl = new URL(String(url));

            if (requestUrl.pathname.endsWith('/gameservers/file_server/bookmarks')) {
                return jsonResponse({
                    data: {
                        bookmarks: [
                            '/games/ni/ftproot/arksa/ShooterGame/Saved/Config/WindowsServer/'
                        ]
                    }
                });
            }

            if (requestUrl.pathname.endsWith('/gameservers/file_server/download')) {
                const file = path.posix.basename(requestUrl.searchParams.get('file') || '');

                return jsonResponse({
                    data: {
                        token: {
                            url: `https://download.example/${file}`,
                            token: 'download-token'
                        }
                    }
                });
            }

            if (requestUrl.hostname === 'download.example' && requestUrl.pathname.endsWith('/GameUserSettings.ini')) {
                return textResponse([
                    '[ServerSettings]',
                    'XPMultiplier=5.0',
                    'TamingSpeedMultiplier=15',
                    'HarvestAmountMultiplier=3',
                    'AutoSavePeriodMinutes=30'
                ].join('\n'));
            }

            if (requestUrl.hostname === 'download.example' && requestUrl.pathname.endsWith('/Game.ini')) {
                return textResponse([
                    'EggHatchSpeedMultiplier=30',
                    'BabyMatureSpeedMultiplier=30',
                    'PerLevelStatsMultiplier_Player[7]=2.5'
                ].join('\n'));
            }

            throw new Error(`unexpected fetch ${requestUrl.href}`);
        });

        await expect(fetchNitradoSettings(nitradoConfig())).resolves.toMatchObject({
            source: 'nitrado-file',
            settings: {
                experience: '5倍',
                taming: '15倍',
                harvesting: '3倍',
                hatching: '30倍',
                maturation: '30倍',
                weight: '2.5倍',
                autosave: '30分'
            }
        });
    });
});

describe('CurseForge client integration helpers', function() {
    it('CurseForge APIでMOD名と詳細URLを解決し、入力順に戻す', async function() {
        global.fetch = vi.fn(async function(url, options = {}) {
            expect(String(url)).toBe('https://api.curseforge.com/v1/mods');
            expect(options.headers['x-api-key']).toBe('key');

            return textResponse(JSON.stringify({
                data: [
                    {
                        id: 222,
                        name: 'Second Mod',
                        slug: 'second-mod',
                        links: {}
                    },
                    {
                        id: 111,
                        name: 'First Mod',
                        slug: 'first-mod',
                        links: {
                            websiteUrl: 'https://www.curseforge.com/ark-survival-ascended/mods/first-mod'
                        }
                    }
                ]
            }));
        });

        await expect(fetchCurseForgeModDetails({
            curseForgeApiKey: 'key'
        }, ['111', '222'])).resolves.toEqual([
            expect.objectContaining({
                id: '111',
                name: 'First Mod',
                resolved: true,
                url: 'https://www.curseforge.com/ark-survival-ascended/mods/first-mod'
            }),
            expect.objectContaining({
                id: '222',
                name: 'Second Mod',
                resolved: true,
                url: 'https://www.curseforge.com/ark-survival-ascended/mods/second-mod'
            })
        ]);
    });

    it('未解決MOD IDを検証結果に含める', async function() {
        global.fetch = vi.fn(async function() {
            return textResponse(JSON.stringify({
                data: [
                    {
                        id: 111,
                        name: 'First Mod',
                        slug: 'first-mod',
                        links: {}
                    }
                ]
            }));
        });

        await expect(validateCurseForgeModDetails({
            curseForgeApiKey: 'key'
        }, ['111', '999'])).resolves.toMatchObject({
            unresolvedIds: ['999']
        });
    });
});

describe('ARK monitor helper decisions', function() {
    it('通知対象のオンライン/オフラインだけを返す', function() {
        expect(arkMonitorTestables.getNotifiableState('online')).toBe('online');
        expect(arkMonitorTestables.getNotifiableState('offline')).toBe('offline');
        expect(arkMonitorTestables.getNotifiableState('restarting')).toBe('');
    });

    it('バックアップ監視の実行条件と定期実行判定を固定する', function() {
        expect(arkBackupMonitorTestables.canRunArkBackupMonitor({
            notifyChannelId: 'channel',
            nitradoToken: 'token',
            nitradoServiceId: 'service'
        })).toBe(true);
        expect(arkBackupMonitorTestables.canRunArkBackupMonitor({
            notifyChannelId: '',
            nitradoToken: 'token',
            nitradoServiceId: 'service'
        })).toBe(false);

        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-09T12:00:00.000Z'));
        expect(arkBackupMonitorTestables.isBackupDue({
            lastBackupAt: '2026-07-09T00:00:00.000Z'
        }, {
            backupIntervalHours: 24
        })).toBe(false);
        expect(arkBackupMonitorTestables.isBackupDue({
            lastBackupAt: '2026-07-08T00:00:00.000Z'
        }, {
            backupIntervalHours: 24
        })).toBe(true);
        vi.useRealTimers();
    });
});
