import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getArkConfig } from './ark-config.js';
import {
    buildArkBackupFailureNotificationMessage,
    buildArkBackupNotificationMessage,
    createArkBackup,
    getArkServiceAvailability,
    isArkBackupAlreadyRunningError
} from './ark-backup-service.js';
import { writeJsonFileAtomic } from '../../utils/json-file.js';

const MONITOR_STATE_PATH = path.resolve(process.cwd(), 'data', 'ark-backup-monitor.json');
const ERROR_NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

let monitorStarted = false;
let monitorRunning = false;

export function startArkBackupMonitor(client) {
    if (monitorStarted) {
        return;
    }

    const config = getArkConfig();

    if (!canRunArkBackupMonitor(config)) {
        console.log('ARK backup monitor skipped: notification channel or Nitrado credentials are not set.');
        return;
    }

    monitorStarted = true;
    setTimeout(function() {
        runMonitorTick(client).catch(logMonitorError);
    }, 30 * 1000);
    setInterval(function() {
        runMonitorTick(client).catch(logMonitorError);
    }, config.backupPollMs);
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

    if (!canRunArkBackupMonitor(config)) {
        return;
    }

    const state = await readMonitorState();
    let availability;

    try {
        availability = await getArkServiceAvailability();
    } catch (error) {
        await notifyFailureIfNeeded(client, state, 'サービス状態の確認', error);
        await writeMonitorState(state);
        return;
    }

    if (!availability.available && availability.terminal) {
        await handleTerminalServiceState(client, state, availability);
        await writeMonitorState(state);
        return;
    }

    state.serviceUnavailable = false;
    state.finalBackupAttempted = false;
    state.lastServiceStatus = availability.status;

    if (!isBackupDue(state, config)) {
        await writeMonitorState(state);
        return;
    }

    try {
        const result = await createArkBackup({
            reason: '定期バックアップ'
        });

        state.lastBackupAt = result.createdAt;
        state.lastBackupId = result.id;
        state.lastBackupErrorAt = '';
        await notifyArkChannel(client, buildArkBackupNotificationMessage(result));
    } catch (error) {
        if (isArkBackupAlreadyRunningError(error)) {
            await writeMonitorState(state);
            return;
        }

        await notifyFailureIfNeeded(client, state, '定期バックアップ', error);
    }

    await writeMonitorState(state);
}

async function handleTerminalServiceState(client, state, availability, dependencies = {}) {
    state.serviceUnavailable = true;
    state.lastServiceStatus = availability.status;

    if (state.finalBackupAttempted) {
        return;
    }

    const createBackup = dependencies.createBackup || createArkBackup;

    try {
        const result = await createBackup({
            reason: 'サービス終了検知'
        });

        state.lastBackupAt = result.createdAt;
        state.lastBackupId = result.id;
        state.finalBackupAttempted = true;

        try {
            await notifyArkChannel(client, buildArkBackupNotificationMessage(result));
        } catch (notificationError) {
            console.error('ARK final backup notification failed:', notificationError);
        }
    } catch (error) {
        if (isArkBackupAlreadyRunningError(error)) {
            return;
        }

        state.finalBackupAttempted = true;

        try {
            await notifyArkChannel(client, buildArkBackupFailureNotificationMessage('サービス終了検知', error));
        } catch (notificationError) {
            console.error('ARK final backup failure notification failed:', notificationError);
        }
    }
}

function isBackupDue(state, config) {
    if (!state.lastBackupAt) {
        return true;
    }

    const lastBackupTime = Date.parse(state.lastBackupAt);

    if (Number.isNaN(lastBackupTime)) {
        return true;
    }

    return Date.now() - lastBackupTime >= config.backupIntervalHours * 60 * 60 * 1000;
}

async function notifyFailureIfNeeded(client, state, reason, error) {
    const lastErrorAt = Date.parse(state.lastBackupErrorAt || '');

    if (!Number.isNaN(lastErrorAt) && Date.now() - lastErrorAt < ERROR_NOTIFY_COOLDOWN_MS) {
        return;
    }

    state.lastBackupErrorAt = new Date().toISOString();
    await notifyArkChannel(client, buildArkBackupFailureNotificationMessage(reason, error));
}

async function notifyArkChannel(client, content) {
    const channelId = getArkConfig().notifyChannelId;
    const channel = await client.channels.fetch(channelId);

    if (!channel?.isTextBased()) {
        throw new Error('ARK_NOTIFY_CHANNEL_ID is not a text channel.');
    }

    await channel.send({
        content: content
    });
}

function canRunArkBackupMonitor(config) {
    return Boolean(config.notifyChannelId && config.nitradoToken && config.nitradoServiceId);
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
    console.error('ARK backup monitor failed:', error);
}

export const __testables = {
    canRunArkBackupMonitor,
    isBackupDue,
    handleTerminalServiceState
};
