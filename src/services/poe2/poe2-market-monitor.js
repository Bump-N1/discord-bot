import { AttachmentBuilder } from 'discord.js';
import { buildPoe2MarketImage } from '../../formatters/poe2-market-image.js';
import { getPoe2MarketConfig } from './poe2-market-config.js';
import { fetchPoe2MarketSnapshot } from './poe2-market-client.js';
import {
    getAllPoe2MarketSubscriptions,
    getPoe2MarketSettings,
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

export async function postCurrentPoe2MarketImage(client, channelId, guildId) {
    const config = getPoe2MarketConfig();
    const settings = await getPoe2MarketSettings(guildId);

    if (settings.selectedProducts.length === 0) {
        throw new Error('PoE2 market products are not configured.');
    }

    const snapshot = await fetchPoe2MarketSnapshot(settings.selectedProducts);
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

        const config = getPoe2MarketConfig();
        const groups = await buildSubscriptionGroups(subscriptions);

        for (const group of groups.values()) {
            if (group.settings.selectedProducts.length === 0) {
                continue;
            }

            const dueSubscriptions = group.subscriptions.filter(function(subscription) {
                return isPostDue(subscription, group.settings.postIntervalHours);
            });

            if (dueSubscriptions.length === 0) {
                continue;
            }

            const snapshot = await fetchPoe2MarketSnapshot(group.settings.selectedProducts);
            const targets = dueSubscriptions.filter(function(subscription) {
                return subscription.lastPostedChangeId !== snapshot.changeId;
            });

            if (targets.length === 0) {
                continue;
            }

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
        }
    } finally {
        monitorRunning = false;
    }
}

async function buildSubscriptionGroups(subscriptions) {
    const groups = new Map();
    const settingsByGuild = new Map();

    for (const subscription of subscriptions) {
        const guildId = subscription.guildId || '';

        if (!settingsByGuild.has(guildId)) {
            settingsByGuild.set(guildId, await getPoe2MarketSettings(guildId));
        }

        const settings = settingsByGuild.get(guildId);
        const settingsKey = `${settings.postIntervalHours}:` + settings.selectedProducts.map(function(product) {
            return product.id;
        }).join('|');
        const group = groups.get(settingsKey) || {
            settings: settings,
            subscriptions: []
        };

        group.subscriptions.push(subscription);
        groups.set(settingsKey, group);
    }

    return groups;
}

function isPostDue(subscription, postIntervalHours) {
    const lastPostedAt = Date.parse(subscription.lastPostedAt || subscription.enabledAt || subscription.updatedAt || '');

    if (!Number.isFinite(lastPostedAt)) {
        return true;
    }

    return Date.now() - lastPostedAt >= postIntervalHours * 60 * 60 * 1000;
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
