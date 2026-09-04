import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getArkConfig } from './ark-config.js';
import { getArkAvailability } from './ark-service.js';
import { writeJsonFileAtomic } from '../../utils/json-file.js';

const MONITOR_STATE_PATH = path.resolve(process.cwd(), 'data', 'ark-monitor.json');
const MONITOR_MODE = 'rcon-status-transition';
const STATE_CONFIRMATIONS_REQUIRED = 2;

let monitorStarted = false;
let monitorRunning = false;

export function startArkStatusMonitor(client) {
    if (monitorStarted) {
        return;
    }

    const config = getArkConfig();

    if (!canMonitorArkStatus(config)) {
        console.log('ARK status monitor skipped: notification channel or Nitrado credentials are not set.');
        return;
    }

    monitorStarted = true;
    runMonitorTick(client).catch(logMonitorError);
    setInterval(function() {
        runMonitorTick(client).catch(logMonitorError);
    }, config.statusPollMs);
}

async function runMonitorTick(client) {
    if (monitorRunning) {
        return;
    }

    monitorRunning = true;

    try {
        await runMonitorTickInternal(client);
    } finally {
        monitorRunning = false;
    }
}

async function runMonitorTickInternal(client) {
    const config = getArkConfig();

    if (!canMonitorArkStatus(config)) {
        return;
    }

    const state = await readMonitorState();
    const currentState = getNotifiableState(await getArkAvailability());

    if (!currentState) {
        return;
    }

    if (state.monitorMode !== MONITOR_MODE) {
        state.monitorMode = MONITOR_MODE;
        state.lastServerState = currentState;
        delete state.candidateState;
        delete state.candidateCount;
        state.updatedAt = new Date().toISOString();
        await writeMonitorState(state);
        return;
    }

    if (state.lastServerState === currentState) {
        delete state.candidateState;
        delete state.candidateCount;
        state.updatedAt = new Date().toISOString();
        await writeMonitorState(state);
        return;
    }

    if (state.candidateState !== currentState) {
        state.candidateState = currentState;
        state.candidateCount = 1;
        state.updatedAt = new Date().toISOString();
        await writeMonitorState(state);
        return;
    }

    state.candidateCount += 1;

    if (state.candidateCount < STATE_CONFIRMATIONS_REQUIRED) {
        state.updatedAt = new Date().toISOString();
        await writeMonitorState(state);
        return;
    }

    await sendStateChangeNotification(client, config.notifyChannelId, currentState);
    state.lastServerState = currentState;
    delete state.candidateState;
    delete state.candidateCount;
    state.updatedAt = new Date().toISOString();
    await writeMonitorState(state);
}

function canMonitorArkStatus(config) {
    return Boolean(config.notifyChannelId && config.nitradoToken && config.nitradoServiceId);
}

function getNotifiableState(state) {
    return state === 'online' || state === 'offline' ? state : '';
}

async function sendStateChangeNotification(client, channelId, state) {
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
        throw new Error('ARK_NOTIFY_CHANNEL_ID is not a text channel.');
    }

    const content = state === 'online'
        ? '🟢 サーバーがオンラインになりました。'
        : '🔴 サーバーがオフラインになりました。';

    await channel.send({
        content: content
    });
}

async function readMonitorState() {
    try {
        return JSON.parse(await readFile(MONITOR_STATE_PATH, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }

        throw error;
    }
}

async function writeMonitorState(state) {
    await writeJsonFileAtomic(MONITOR_STATE_PATH, state);
}

function logMonitorError(error) {
    console.error('ARK status monitor failed:', error);
}

export const __testables = {
    getNotifiableState
};
