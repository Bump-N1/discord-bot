import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let originalCwd;
let tempDir;
let store;

beforeEach(async function() {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'poe2-market-store-'));
    process.chdir(tempDir);
    vi.resetModules();
    store = await import('../src/services/poe2/poe2-market-store.js');
});

afterEach(async function() {
    process.chdir(originalCwd);
    await rm(tempDir, {
        recursive: true,
        force: true
    });
});

describe('PoE2 market store', function() {
    it('未設定時は空の設定を返す', async function() {
        await expect(store.getPoe2MarketSettings('guild')).resolves.toMatchObject({
            guildId: 'guild',
            selectedProducts: [],
            postIntervalHours: 1,
            history: [],
            configured: false
        });
    });

    it('表示アイテムと投稿頻度を保存し、履歴を10件に制限する', async function() {
        for (let index = 0; index < 12; index += 1) {
            await store.savePoe2MarketSettings(
                'guild',
                [
                    {
                        id: `item-${index}`,
                        label: `Item ${index}`
                    }
                ],
                `user-${index}`,
                {
                    updatedByName: `User ${index}`,
                    postIntervalHours: index + 1
                }
            );
        }

        const settings = await store.getPoe2MarketSettings('guild');

        expect(settings).toMatchObject({
            guildId: 'guild',
            selectedProducts: [
                {
                    id: 'item-11',
                    label: 'Item 11'
                }
            ],
            postIntervalHours: 12,
            configured: true
        });
        expect(settings.history).toHaveLength(10);
        expect(settings.history[0]).toMatchObject({
            updatedBy: 'user-11',
            updatedByName: 'User 11',
            selectedCount: 1,
            selectedLabels: ['Item 11'],
            postIntervalHours: 12
        });
        expect(settings.history.at(-1)).toMatchObject({
            updatedBy: 'user-2'
        });
    });

    it('投稿頻度が範囲外なら既定値へ戻す', async function() {
        await store.savePoe2MarketSettings('guild', [], 'user', {
            postIntervalHours: 999
        });

        await expect(store.getPoe2MarketSettings('guild')).resolves.toMatchObject({
            postIntervalHours: 1
        });
    });

    it('定期投稿の購読状態を保存・更新・削除する', async function() {
        await store.savePoe2MarketSubscription({
            channelId: 'channel',
            guildId: 'guild',
            enabledAt: '2026-07-09T00:00:00.000Z',
            updatedAt: '2026-07-09T00:00:00.000Z'
        });

        await expect(store.getPoe2MarketSubscription('channel')).resolves.toMatchObject({
            channelId: 'channel',
            guildId: 'guild'
        });
        await expect(store.getAllPoe2MarketSubscriptions()).resolves.toHaveLength(1);
        await expect(store.markPoe2MarketPosted('missing', 'change')).resolves.toBeNull();

        const updated = await store.markPoe2MarketPosted('channel', 'change-1');

        expect(updated).toMatchObject({
            channelId: 'channel',
            lastPostedChangeId: 'change-1'
        });
        expect(updated.lastPostedAt).toBeTruthy();

        await expect(store.removePoe2MarketSubscription('channel')).resolves.toBe(true);
        await expect(store.removePoe2MarketSubscription('channel')).resolves.toBe(false);
        await expect(store.getAllPoe2MarketSubscriptions()).resolves.toEqual([]);
    });
});
