import { AttachmentBuilder } from 'discord.js';
import { buildPoe2MarketImage } from '../../formatters/poe2-market-image.js';
import { getPoe2MarketConfig } from './poe2-market-config.js';
import { fetchPoe2MarketSnapshot } from './poe2-market-client.js';
import {
    getAllPoe2MarketSubscriptions,
    markPoe2MarketPosted
} from './poe2-market-store.js';

let monitorStarted = false;
let monitorRunning = false;

export function startPoe2MarketMonitor(client) {
    if (monitorStarted) {
        return;
    }

    monitorStarted = true;
    const config = getPoe2MarketConfig();

    setTimeout(function() {
        runPoe2MarketMonitorTick(client).catch(logMonitorError);
    }, 5000);

    setInterval(function() {
        runPoe2MarketMonitorTick(client).catch(logMonitorError);
    }, config.monitorIntervalMs);
}

export async function postCurrentPoe2MarketImage(client, channelId) {
    const config = getPoe2MarketConfig();
    const snapshot = await fetchPoe2MarketSnapshot();
    const image = await buildPoe2MarketImage(snapshot, {
        userAgent: config.userAgent
    });

    await sendSnapshotImage(client, channelId, image);

    return snapshot;
}

async function runPoe2MarketMonitorTick(client) {
    if (monitorRunning) {
        return;
    }

    monitorRunning = true;

    try {
        const subscriptions = await getAllPoe2MarketSubscriptions();

        if (subscriptions.length === 0) {
            return;
        }

        const snapshot = await fetchPoe2MarketSnapshot();
        const targets = subscriptions.filter(function(subscription) {
            return subscription.lastPostedChangeId !== snapshot.changeId;
        });

        if (targets.length === 0) {
            return;
        }

        const config = getPoe2MarketConfig();
        const image = await buildPoe2MarketImage(snapshot, {
            userAgent: config.userAgent
        });

        for (const subscription of targets) {
            try {
                await sendSnapshotImage(client, subscription.channelId, image);
                await markPoe2MarketPosted(subscription.channelId, snapshot.changeId);
            } catch (error) {
                console.error(`PoE2 market post failed for channel ${subscription.channelId}:`, error);
            }
        }
    } finally {
        monitorRunning = false;
    }
}

async function sendSnapshotImage(client, channelId, image) {
    const channel = await client.channels.fetch(channelId);

    if (!channel?.isTextBased?.()) {
        throw new Error('PoE2 market subscription channel is not a text channel.');
    }

    await channel.send({
        files: [
            new AttachmentBuilder(image, {
                name: 'poe2-market.png'
            })
        ]
    });
}

function logMonitorError(error) {
    console.error('PoE2 market monitor failed:', error);
}
