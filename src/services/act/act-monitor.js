import { buildActMessage } from '../../formatters/act-message.js';
import {
    ACT_STATUS_CLOSED,
    ACT_STATUS_OPEN,
    getMultipleSlotParticipants,
    getActDefinition
} from './act-definitions.js';
import { getAllActs, updateAct } from './act-store.js';

const DEFAULT_REMINDER_MINUTES = 30;
const DEFAULT_AUTO_CLOSE_AFTER_MINUTES = 0;
const DEFAULT_MONITOR_INTERVAL_MS = 60 * 1000;

let monitorStarted = false;
let monitorRunning = false;

export function startActMonitor(client) {
    if (monitorStarted) {
        return;
    }

    monitorStarted = true;
    const config = getActMonitorConfig();

    setTimeout(function() {
        runActMonitorTick(client, config).catch(logActMonitorError);
    }, 5000);

    setInterval(function() {
        runActMonitorTick(client, config).catch(logActMonitorError);
    }, config.intervalMs);
}

async function runActMonitorTick(client, config) {
    if (monitorRunning) {
        return;
    }

    monitorRunning = true;

    try {
        const parties = await getAllActs();

        for (const party of parties) {
            await processAct(client, party, config);
        }
    } finally {
        monitorRunning = false;
    }
}

async function processAct(client, party, config) {
    if (!party || party.status !== ACT_STATUS_OPEN || !party.scheduledAt) {
        return;
    }

    const scheduledTime = Date.parse(party.scheduledAt);

    if (Number.isNaN(scheduledTime)) {
        return;
    }

    const now = Date.now();

    if (shouldSendReminder(party, scheduledTime, now, config)) {
        await sendActReminder(client, party, config);
    }

    if (shouldAutoClose(scheduledTime, now, config)) {
        await autoCloseAct(client, party.id);
    }
}

function shouldSendReminder(party, scheduledTime, now, config) {
    if (party.reminderSentAt || config.reminderMs <= 0) {
        return false;
    }

    return now >= scheduledTime - config.reminderMs && now < scheduledTime;
}

function shouldAutoClose(scheduledTime, now, config) {
    return now >= scheduledTime + config.autoCloseAfterMs;
}

async function sendActReminder(client, party, config) {
    const channel = await fetchTextChannel(client, party.channelId);

    if (!channel) {
        return;
    }

    const participantIds = getActMentionUserIds(party);
    await channel.send({
        content: buildReminderText(party, config, participantIds),
        allowedMentions: {
            users: participantIds
        }
    });

    const sentAt = new Date().toISOString();
    await updateAct(party.id, function(currentParty) {
        if (!currentParty || currentParty.status !== ACT_STATUS_OPEN || currentParty.reminderSentAt) {
            return {
                party: null
            };
        }

        currentParty.reminderSentAt = sentAt;
        currentParty.updatedAt = sentAt;

        return {
            party: currentParty
        };
    });
}

async function autoCloseAct(client, partyId) {
    const closedAt = new Date().toISOString();
    const result = await updateAct(partyId, function(party) {
        if (!party || party.status !== ACT_STATUS_OPEN) {
            return {
                party: null,
                autoClosed: false
            };
        }

        const scheduledTime = Date.parse(party.scheduledAt || '');

        if (Number.isNaN(scheduledTime) || Date.now() < scheduledTime) {
            return {
                party: null,
                autoClosed: false
            };
        }

        party.status = ACT_STATUS_CLOSED;
        party.closedAt = closedAt;
        party.autoClosedAt = closedAt;
        party.updatedAt = closedAt;

        return {
            party: party,
            autoClosed: true
        };
    });

    if (!result?.autoClosed || !result.party) {
        return;
    }

    await editActMessage(client, result.party);
    await sendActAutoCloseMessage(client, result.party);
}

async function editActMessage(client, party) {
    if (!party.channelId || !party.messageId) {
        return;
    }

    const channel = await fetchTextChannel(client, party.channelId);

    if (!channel?.messages?.fetch) {
        return;
    }

    const message = await channel.messages.fetch(party.messageId);
    await message.edit(await buildActMessage(party, message.guild));
}

async function sendActAutoCloseMessage(client, party) {
    const channel = await fetchTextChannel(client, party.channelId);

    if (!channel) {
        return;
    }

    await channel.send({
        content: [
            '【募集終了】',
            `${buildActTitleText(party)} は開始時刻を過ぎたため、自動で締め切りました。`,
            `日時: ${party.datetime}`
        ].join('\n'),
        allowedMentions: {
            parse: []
        }
    });
}

async function fetchTextChannel(client, channelId) {
    if (!channelId) {
        return null;
    }

    const channel = await client.channels.fetch(channelId);

    if (!channel?.isTextBased?.()) {
        return null;
    }

    return channel;
}

function buildReminderText(party, config, participantIds) {
    return [
        '【募集リマインド】',
        `${buildActTitleText(party)} はそろそろ開始予定です。`,
        `日時: ${party.datetime}`,
        `参加者: ${participantIds.length > 0 ? participantIds.map(function(userId) {
            return `<@${userId}>`;
        }).join(' ') : 'なし'}`,
        buildActMessageLink(party)
    ].filter(Boolean).join('\n');
}

function buildActTitleText(party) {
    try {
        const definition = getActDefinition(party);
        const modeLabel = definition.modeLabels?.[party.mode] || party.contentName || party.mode || '募集';

        return `${definition.titlePrefix} ${modeLabel}`;
    } catch (error) {
        return party.mode || '募集';
    }
}

function buildActMessageLink(party) {
    if (!party.guildId || !party.channelId || !party.messageId) {
        return '';
    }

    return `https://discord.com/channels/${party.guildId}/${party.channelId}/${party.messageId}`;
}

function getActMentionUserIds(party) {
    const userIds = new Set();

    for (const userId of getActParticipantIds(party)) {
        userIds.add(userId);
    }

    return Array.from(userIds).filter(Boolean);
}

function getActParticipantIds(party) {
    if (party.game === 'ff14') {
        return (party.ff14Participants || []).map(function(participant) {
            return participant.userId;
        });
    }

    if (!party.usesSlots) {
        return party.participants || [];
    }

    return [
        ...Object.values(party.slots || {}).filter(Boolean),
        ...getMultipleParticipants(party)
    ];
}

function getMultipleParticipants(party) {
    const definition = getActDefinition(party);

    return definition.slots
        .filter(function(slot) {
            return slot.multiple;
        })
        .flatMap(function(slot) {
            return getMultipleSlotParticipants(party, slot.key);
        });
}

function getActMonitorConfig() {
    const reminderMinutes = getEnvNumber('ACT_REMINDER_MINUTES', getEnvNumber('PARTY_REMINDER_MINUTES', DEFAULT_REMINDER_MINUTES));
    const autoCloseAfterMinutes = getEnvNumber('ACT_AUTO_CLOSE_AFTER_MINUTES', getEnvNumber('PARTY_AUTO_CLOSE_AFTER_MINUTES', DEFAULT_AUTO_CLOSE_AFTER_MINUTES));

    return {
        reminderMinutes: reminderMinutes,
        reminderMs: reminderMinutes * 60 * 1000,
        autoCloseAfterMs: autoCloseAfterMinutes * 60 * 1000,
        intervalMs: getEnvNumber('ACT_MONITOR_INTERVAL_MS', getEnvNumber('PARTY_MONITOR_INTERVAL_MS', DEFAULT_MONITOR_INTERVAL_MS))
    };
}

function getEnvNumber(name, fallback) {
    const value = Number(process.env[name]);

    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function logActMonitorError(error) {
    console.error('Act monitor failed:', error);
}
