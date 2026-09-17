import { describe, expect, it } from 'vitest';
import {
    SOURCE_STATE_HISTORY_LIMIT,
    SOURCE_STATE_SCHEMA_VERSION,
    getPendingPatchNotes,
    getSourceStateKey,
    getStoredPatchNoteIds,
    loadSourceNotificationState,
    markPatchNoteDelivered,
    planSourceNotifications,
    saveSourceNotificationState
} from '../workers/discord-bot/notification-state.js';

let fixtureSequence = 0;
let patchNoteSequence = 0;

function createFixtureSource(overrides = {}) {
    fixtureSequence += 1;

    return {
        game: `fixture-game-${Date.now()}-${fixtureSequence}`,
        checkMultiple: true,
        ...overrides
    };
}

function createFixturePatchNotes(source, labels) {
    patchNoteSequence += 1;
    return labels.map(function(label, index) {
        const revision = `${Date.now()}-${fixtureSequence}-${patchNoteSequence}-${index}`;

        return {
            id: `${source.game}-${revision}`,
            title: `fixture-title-${label}-${revision}`,
            description: '',
            date: '',
            url: `https://example.test/${source.game}/${revision}`,
            imageUrl: ''
        };
    });
}

function createKvStore(entries = []) {
    const values = new Map(entries);

    return {
        values: values,
        kv: {
            get: async function(key) {
                return values.get(key) || null;
            },
            put: async function(key, value) {
                values.set(key, value);
            },
            delete: async function(key) {
                values.delete(key);
            }
        }
    };
}

describe('notification source state', function() {
    it('KVが空の通常通知は現行一覧を基準点として保存し、過去分を通知しない', async function() {
        const source = createFixtureSource();
        const patchNotes = createFixturePatchNotes(source, ['latest', 'older', 'oldest']);
        const store = createKvStore();
        const loaded = await loadSourceNotificationState(store.kv, source);
        const plan = planSourceNotifications(source, loaded.state, patchNotes);

        expect(plan.initialRun).toBe(true);
        expect(getPendingPatchNotes(plan.state, patchNotes)).toEqual([]);
        expect(plan.state.observedIds).toEqual(
            patchNotes.flatMap(getStoredPatchNoteIds)
        );

        await saveSourceNotificationState(store.kv, source, plan.state, {
            syncLegacy: true
        });

        expect(JSON.parse(store.values.get(getSourceStateKey(source)))).toMatchObject({
            initialized: true,
            pendingIds: []
        });
        expect(JSON.parse(store.values.get(`posted:${source.game}`))).toEqual(
            plan.state.observedIds
        );
    });

    it('初回投稿を有効にしても最新1件だけを通知対象にする', async function() {
        const source = createFixtureSource();
        const patchNotes = createFixturePatchNotes(source, ['latest', 'older', 'oldest']);
        const store = createKvStore();
        const loaded = await loadSourceNotificationState(store.kv, source);
        const plan = planSourceNotifications(source, loaded.state, patchNotes, {
            postOnFirstRun: true
        });

        expect(getPendingPatchNotes(plan.state, patchNotes)).toEqual([patchNotes[0]]);
    });

    it('旧KVに最新1件だけ存在する場合は不足している過去記事を一括通知せず基準点へ取り込む', async function() {
        const source = createFixtureSource();
        const patchNotes = createFixturePatchNotes(source, ['latest', 'older', 'oldest']);
        const store = createKvStore([
            [
                `posted:${source.game}`,
                JSON.stringify(getStoredPatchNoteIds(patchNotes[0]))
            ]
        ]);
        const loaded = await loadSourceNotificationState(store.kv, source);
        const plan = planSourceNotifications(source, loaded.state, patchNotes, {
            allowLatestOnDiscontinuity: loaded.isCurrentSchema
        });

        expect(loaded.isCurrentSchema).toBe(false);
        expect(getPendingPatchNotes(plan.state, patchNotes)).toEqual([]);
        expect(plan.state.observedIds).toEqual(
            patchNotes.flatMap(getStoredPatchNoteIds)
        );
    });

    it('旧KVと現行一覧に共通IDがない場合は無通知で基準点を再構築する', async function() {
        const source = createFixtureSource();
        const previousPatchNotes = createFixturePatchNotes(source, ['previous']);
        const currentPatchNotes = createFixturePatchNotes(source, ['current', 'older']);
        const store = createKvStore([
            [
                `posted:${source.game}`,
                JSON.stringify(getStoredPatchNoteIds(previousPatchNotes[0]))
            ]
        ]);
        const loaded = await loadSourceNotificationState(store.kv, source);
        const plan = planSourceNotifications(source, loaded.state, currentPatchNotes, {
            allowLatestOnDiscontinuity: loaded.isCurrentSchema
        });

        expect(plan.rebaselined).toBe(true);
        expect(getPendingPatchNotes(plan.state, currentPatchNotes)).toEqual([]);
    });

    it('現行スキーマで一覧の連続性が切れた場合も最新1件だけを通知する', async function() {
        const source = createFixtureSource();
        const previousPatchNotes = createFixturePatchNotes(source, ['previous']);
        const currentPatchNotes = createFixturePatchNotes(source, ['current', 'older']);
        const store = createKvStore();
        const initialLoaded = await loadSourceNotificationState(store.kv, source);
        const initialPlan = planSourceNotifications(source, initialLoaded.state, previousPatchNotes);

        await saveSourceNotificationState(store.kv, source, initialPlan.state);

        const loaded = await loadSourceNotificationState(store.kv, source);
        const plan = planSourceNotifications(source, loaded.state, currentPatchNotes, {
            allowLatestOnDiscontinuity: loaded.isCurrentSchema
        });

        expect(plan.rebaselined).toBe(true);
        expect(getPendingPatchNotes(plan.state, currentPatchNotes)).toEqual([currentPatchNotes[0]]);
    });

    it('前回の基準点より新しい複数記事だけを古い順に通知する', async function() {
        const source = createFixtureSource();
        const baselinePatchNotes = createFixturePatchNotes(source, ['baseline', 'older']);
        const newPatchNotes = createFixturePatchNotes(source, ['newest', 'newer']);
        const currentPatchNotes = newPatchNotes.concat(baselinePatchNotes);
        const store = createKvStore();
        const initialLoaded = await loadSourceNotificationState(store.kv, source);
        const initialPlan = planSourceNotifications(source, initialLoaded.state, baselinePatchNotes);

        await saveSourceNotificationState(store.kv, source, initialPlan.state);

        const loaded = await loadSourceNotificationState(store.kv, source);
        const plan = planSourceNotifications(source, loaded.state, currentPatchNotes, {
            allowLatestOnDiscontinuity: loaded.isCurrentSchema
        });

        expect(getPendingPatchNotes(plan.state, currentPatchNotes)).toEqual([
            newPatchNotes[1],
            newPatchNotes[0]
        ]);
    });

    it('送信待ち状態を永続化し、成功するまで再送対象として保持する', async function() {
        const source = createFixtureSource({
            postLatestOnFirstRun: true
        });
        const patchNotes = createFixturePatchNotes(source, ['latest', 'older']);
        const store = createKvStore();
        const loaded = await loadSourceNotificationState(store.kv, source);
        const plan = planSourceNotifications(source, loaded.state, patchNotes);

        await saveSourceNotificationState(store.kv, source, plan.state, {
            syncLegacy: true
        });

        expect(JSON.parse(store.values.get(`posted:${source.game}`))).toEqual(
            getStoredPatchNoteIds(patchNotes[1])
        );

        const reloaded = await loadSourceNotificationState(store.kv, source);
        expect(getPendingPatchNotes(reloaded.state, patchNotes)).toEqual([patchNotes[0]]);

        const deliveredState = markPatchNoteDelivered(reloaded.state, patchNotes[0]);
        await saveSourceNotificationState(store.kv, source, deliveredState);

        const completed = await loadSourceNotificationState(store.kv, source);
        expect(getPendingPatchNotes(completed.state, patchNotes)).toEqual([]);
        expect(completed.state.deliveredIds).toEqual(
            getStoredPatchNoteIds(patchNotes[0])
        );
    });

    it('FF14未送信判定用の旧KVは最新1件だけを保留状態へ移行する', async function() {
        const source = createFixtureSource({
            retryUnconfirmedLatest: true
        });
        const patchNotes = createFixturePatchNotes(source, ['latest', 'older']);
        const store = createKvStore([
            [
                `posted:${source.game}`,
                JSON.stringify(patchNotes.flatMap(getStoredPatchNoteIds))
            ]
        ]);
        const loaded = await loadSourceNotificationState(store.kv, source);
        const plan = planSourceNotifications(source, loaded.state, patchNotes);

        expect(getPendingPatchNotes(plan.state, patchNotes)).toEqual([patchNotes[0]]);
    });

    it('将来版の状態スキーマは旧形式で上書きせず処理を停止する', async function() {
        const source = createFixtureSource();
        const store = createKvStore([
            [
                getSourceStateKey(source),
                JSON.stringify({
                    schemaVersion: SOURCE_STATE_SCHEMA_VERSION + 1
                })
            ]
        ]);

        await expect(loadSourceNotificationState(store.kv, source)).rejects.toThrow(
            'unsupported source state schema'
        );
    });

    it('履歴配列は上限を超えて肥大化しない', function() {
        const source = createFixtureSource();
        const patchNotes = createFixturePatchNotes(
            source,
            Array.from({ length: SOURCE_STATE_HISTORY_LIMIT }, function(_value, index) {
                return String(index);
            })
        );
        const plan = planSourceNotifications(source, {
            initialized: false
        }, patchNotes);

        expect(plan.state.observedIds).toHaveLength(SOURCE_STATE_HISTORY_LIMIT);
    });
});
