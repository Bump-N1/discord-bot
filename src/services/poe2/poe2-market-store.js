import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'poe2-market.json');
let storeQueue = Promise.resolve();

export async function getPoe2MarketSubscription(channelId) {
    const state = await readState();

    return state.subscriptions[channelId] || null;
}

export async function getAllPoe2MarketSubscriptions() {
    const state = await readState();

    return Object.values(state.subscriptions);
}

export async function savePoe2MarketSubscription(subscription) {
    return await withStoreLock(async function() {
        const state = await readState();
        state.subscriptions[subscription.channelId] = subscription;
        await writeState(state);

        return subscription;
    });
}

export async function removePoe2MarketSubscription(channelId) {
    return await withStoreLock(async function() {
        const state = await readState();
        const removed = Boolean(state.subscriptions[channelId]);
        delete state.subscriptions[channelId];
        await writeState(state);

        return removed;
    });
}

export async function markPoe2MarketPosted(channelId, changeId) {
    return await withStoreLock(async function() {
        const state = await readState();
        const subscription = state.subscriptions[channelId];

        if (!subscription) {
            return null;
        }

        subscription.lastPostedChangeId = String(changeId);
        subscription.updatedAt = new Date().toISOString();
        await writeState(state);

        return subscription;
    });
}

async function withStoreLock(operation) {
    const pendingOperation = storeQueue.then(operation);
    storeQueue = pendingOperation.catch(function() {
        return null;
    });

    return await pendingOperation;
}

async function readState() {
    try {
        const contents = await readFile(STORE_PATH, 'utf8');
        const state = JSON.parse(contents);

        return {
            subscriptions: state.subscriptions || {}
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                subscriptions: {}
            };
        }

        throw error;
    }
}

async function writeState(state) {
    await mkdir(DATA_DIR, {
        recursive: true
    });
    await writeFile(STORE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

