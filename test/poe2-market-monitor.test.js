import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let originalCwd;
let tempDir;
let store;
let monitor;

beforeEach(async function() {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'poe2-market-monitor-'));
    process.chdir(tempDir);
    vi.resetModules();
    store = await import('../src/services/poe2/poe2-market-store.js');
    monitor = await import('../src/services/poe2/poe2-market-monitor.js');
});

afterEach(async function() {
    process.chdir(originalCwd);
    await rm(tempDir, {
        recursive: true,
        force: true
    });
    vi.useRealTimers();
});

describe('PoE2 market monitor helpers', function() {
    it('同じギルド設定の購読をまとめ、投稿頻度と選択アイテムが違えば分ける', async function() {
        await store.savePoe2MarketSettings('guild-a', [
            {
                id: 'exalted',
                label: '高貴なオーブ'
            }
        ], 'user', {
            postIntervalHours: 2
        });
        await store.savePoe2MarketSettings('guild-b', [
            {
                id: 'divine',
                label: '神のオーブ'
            }
        ], 'user', {
            postIntervalHours: 1
        });

        const groups = await monitor.__testables.buildSubscriptionGroups([
            {
                channelId: 'channel-a1',
                guildId: 'guild-a'
            },
            {
                channelId: 'channel-a2',
                guildId: 'guild-a'
            },
            {
                channelId: 'channel-b1',
                guildId: 'guild-b'
            }
        ]);

        expect(groups.size).toBe(2);
        expect(Array.from(groups.values()).map(function(group) {
            return {
                interval: group.settings.postIntervalHours,
                channels: group.subscriptions.map(function(subscription) {
                    return subscription.channelId;
                })
            };
        })).toEqual([
            {
                interval: 2,
                channels: ['channel-a1', 'channel-a2']
            },
            {
                interval: 1,
                channels: ['channel-b1']
            }
        ]);
    });

    it('投稿頻度に応じて投稿要否を判定する', function() {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-09T12:00:00.000Z'));

        expect(monitor.__testables.isPostDue({
            lastPostedAt: '2026-07-09T10:30:00.000Z'
        }, 2)).toBe(false);
        expect(monitor.__testables.isPostDue({
            lastPostedAt: '2026-07-09T09:59:59.000Z'
        }, 2)).toBe(true);
        expect(monitor.__testables.isPostDue({
            enabledAt: ''
        }, 1)).toBe(true);
    });
});
