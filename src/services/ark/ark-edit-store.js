import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'ark-edit-history.json');
const HISTORY_LIMIT = 20;
let storeQueue = Promise.resolve();

export async function getArkEditHistory() {
    const state = await readState();

    return state.history;
}

export async function addArkEditHistory(entry) {
    return await withStoreLock(async function() {
        const state = await readState();
        const historyEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            createdAt: new Date().toISOString(),
            ...entry
        };

        state.history = [historyEntry, ...state.history].slice(0, HISTORY_LIMIT);
        await writeState(state);

        return historyEntry;
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
            history: Array.isArray(state.history) ? state.history : []
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                history: []
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
