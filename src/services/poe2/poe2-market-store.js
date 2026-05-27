import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
    POE2_MARKET_DEFAULT_POST_INTERVAL_HOURS,
    POE2_MARKET_MAX_POST_INTERVAL_HOURS,
    POE2_MARKET_MIN_POST_INTERVAL_HOURS
} from './poe2-market-definition.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'poe2-market.json');
const SETTINGS_HISTORY_LIMIT = 10;
let storeQueue = Promise.resolve();

export async function getPoe2MarketSubscription(channelId) {
    const state = await readState();

    return state.subscriptions[channelId] || null;
}

export async function getAllPoe2MarketSubscriptions() {
    const state = await readState();

    return Object.values(state.subscriptions);
}

export async function getPoe2MarketSettings(guildId) {
    const state = await readState();
    const settings = state.settings[guildId];

    if (settings && Array.isArray(settings.selectedProducts)) {
        return normalizeSettings(settings);
    }

    return {
        guildId: guildId,
        selectedProducts: [],
        postIntervalHours: POE2_MARKET_DEFAULT_POST_INTERVAL_HOURS,
        history: [],
        configured: false
    };
}

export async function savePoe2MarketSettings(guildId, selectedProducts, updatedBy, options = {}) {
    return await withStoreLock(async function() {
        const state = await readState();
        const currentSettings = normalizeSettings(state.settings[guildId] || {
            guildId: guildId,
            selectedProducts: [],
            history: []
        });
        const postIntervalHours = normalizePostIntervalHours(options.postIntervalHours);
        const updatedAt = new Date().toISOString();
        const historyEntry = {
            updatedBy: updatedBy,
            updatedByName: String(options.updatedByName || updatedBy || ''),
            updatedAt: updatedAt,
            selectedCount: selectedProducts.length,
            selectedLabels: selectedProducts.map(function(product) {
                return product.label;
            }),
            postIntervalHours: postIntervalHours
        };
        const settings = {
            guildId: guildId,
            selectedProducts: selectedProducts,
            updatedBy: updatedBy,
            updatedByName: historyEntry.updatedByName,
            updatedAt: updatedAt,
            postIntervalHours: postIntervalHours,
            history: [historyEntry, ...currentSettings.history].slice(0, SETTINGS_HISTORY_LIMIT),
            configured: true
        };

        state.settings[guildId] = settings;
        await writeState(state);

        return settings;
    });
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
        subscription.lastPostedAt = new Date().toISOString();
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
            subscriptions: state.subscriptions || {},
            settings: state.settings || {}
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                subscriptions: {},
                settings: {}
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

function normalizeSettings(settings) {
    return {
        ...settings,
        postIntervalHours: normalizePostIntervalHours(settings.postIntervalHours),
        history: Array.isArray(settings.history)
            ? settings.history.slice(0, SETTINGS_HISTORY_LIMIT)
            : []
    };
}

function normalizePostIntervalHours(value) {
    const hours = Number(value);

    if (Number.isInteger(hours)
        && hours >= POE2_MARKET_MIN_POST_INTERVAL_HOURS
        && hours <= POE2_MARKET_MAX_POST_INTERVAL_HOURS) {
        return hours;
    }

    return POE2_MARKET_DEFAULT_POST_INTERVAL_HOURS;
}

