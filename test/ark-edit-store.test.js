import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let originalCwd;
let tempDir;
let store;

beforeEach(async function() {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'ark-edit-store-'));
    process.chdir(tempDir);
    vi.resetModules();
    store = await import('../src/services/ark/ark-edit-store.js');
});

afterEach(async function() {
    process.chdir(originalCwd);
    await rm(tempDir, {
        recursive: true,
        force: true
    });
});

describe('ARK edit history store', function() {
    it('履歴を新しい順に保存し、20件に制限する', async function() {
        for (let index = 0; index < 22; index += 1) {
            await store.addArkEditHistory({
                actorName: `User ${index}`,
                before: {
                    mapLabel: 'The Island'
                },
                after: {
                    mapLabel: `Map ${index}`
                },
                diff: {
                    mapChanged: true,
                    addedMods: [],
                    removedMods: []
                }
            });
        }

        const history = await store.getArkEditHistory();

        expect(history).toHaveLength(20);
        expect(history[0]).toMatchObject({
            actorName: 'User 21',
            after: {
                mapLabel: 'Map 21'
            }
        });
        expect(history.at(-1)).toMatchObject({
            actorName: 'User 2'
        });
        expect(history[0].id).toBeTruthy();
        expect(history[0].createdAt).toBeTruthy();
    });
});
