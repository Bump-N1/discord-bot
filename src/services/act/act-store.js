import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ACT_STORE_PATH = path.join(DATA_DIR, 'parties.json');
let actStoreQueue = Promise.resolve();

export async function getAct(actId) {
    const acts = await readActs();

    return acts[actId] || null;
}

export async function getAllActs() {
    const acts = await readActs();

    return Object.values(acts);
}

export async function saveAct(act) {
    return await withStoreLock(async function() {
        const acts = await readActs();
        acts[act.id] = act;

        await writeActs(acts);

        return act;
    });
}

export async function updateAct(actId, updater) {
    return await withStoreLock(async function() {
        const acts = await readActs();
        const act = acts[actId] || null;
        const result = await updater(act);

        if (result?.party) {
            acts[result.party.id] = result.party;
            await writeActs(acts);
        }

        return result;
    });
}

async function withStoreLock(operation) {
    const pendingOperation = actStoreQueue.then(operation);
    actStoreQueue = pendingOperation.catch(function() {
        return null;
    });

    return await pendingOperation;
}

async function readActs() {
    try {
        const text = await readFile(ACT_STORE_PATH, 'utf8');
        const data = JSON.parse(text);

        return data.parties || {};
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }

        throw error;
    }
}

async function writeActs(acts) {
    await mkdir(DATA_DIR, {
        recursive: true
    });
    await writeFile(ACT_STORE_PATH, `${JSON.stringify({ parties: acts }, null, 2)}\n`, 'utf8');
}
