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
const SERVICE_STATUS_CHECK_REASON = 'サービス状態の確認';
const SCHEDULED_BACKUP_REASON = '定期バックアップ';

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
        await notifyFailureIfNeeded(client, state, SERVICE_STATUS_CHECK_REASON, error);
        await writeMonitorState(state);
        return;
    }

    clearFailureState(state, SERVICE_STATUS_CHECK_REASON);

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
            reason: SCHEDULED_BACKUP_REASON
        });

        state.lastBackupAt = result.createdAt;
        state.lastBackupId = result.id;
        clearFailureState(state, SCHEDULED_BACKUP_REASON);
        await notifyArkChannel(client, buildArkBackupNotificationMessage(result));
    } catch (error) {
        if (isArkBackupAlreadyRunningError(error)) {
            await writeMonitorState(state);
            return;
        }

        await notifyFailureIfNeeded(client, state, SCHEDULED_BACKUP_REASON, error);
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

async function notifyFailureIfNeeded(client, state, reason, error, dependencies = {}) {
    const errorSignature = buildFailureSignature(reason, error);
    const failureSignatures = state.backupErrorSignatures
        && typeof state.backupErrorSignatures === 'object'
        && !Array.isArray(state.backupErrorSignatures)
        ? state.backupErrorSignatures
        : {};

    if (failureSignatures[reason] === errorSignature) {
        return false;
    }

    const notify = dependencies.notify || notifyArkChannel;
    await notify(client, buildArkBackupFailureNotificationMessage(reason, error));
    state.backupErrorSignatures = {
        ...failureSignatures,
        [reason]: errorSignature
    };
    delete state.lastBackupErrorSignature;
    state.lastBackupErrorAt = new Date().toISOString();
    return true;
}

function buildFailureSignature(reason, error) {
    const status = error && error.status !== undefined ? String(error.status) : '';
    const message = error && error.message ? String(error.message) : String(error || 'unknown error');

    return [reason, status, message].join('|');
}

function clearFailureState(state, reason) {
    const failureSignatures = state.backupErrorSignatures;

    if (!reason || !failureSignatures || typeof failureSignatures !== 'object' || Array.isArray(failureSignatures)) {
        delete state.backupErrorSignatures;
    } else {
        delete failureSignatures[reason];

        if (Object.keys(failureSignatures).length === 0) {
            delete state.backupErrorSignatures;
        }
    }

    delete state.lastBackupErrorSignature;

    if (!state.backupErrorSignatures) {
        state.lastBackupErrorAt = '';
    }
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
    buildFailureSignature,
    canRunArkBackupMonitor,
    clearFailureState,
    isBackupDue,
    handleTerminalServiceState,
    notifyFailureIfNeeded
};
