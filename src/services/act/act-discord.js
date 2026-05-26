import { buildActMessage } from '../../formatters/act-message.js';
import { getActById, setActMessageId } from './act-service.js';

const messageUpdateQueues = new Map();

export async function postActDiscordMessage(client, party) {
    const channel = await client.channels.fetch(party.channelId);

    if (!channel?.isTextBased()) {
        throw new Error('募集を投稿するチャンネルが見つかりません。');
    }

    const message = await channel.send(await buildActMessage(party, channel.guild));

    return await setActMessageId(party.id, message.id);
}

export async function updateActDiscordMessage(client, partyId) {
    const previousUpdate = messageUpdateQueues.get(partyId) || Promise.resolve();
    const nextUpdate = previousUpdate.catch(function() {
        return null;
    }).then(async function() {
        const latestParty = await getActById(partyId);

        if (!latestParty?.channelId || !latestParty.messageId) {
            return latestParty;
        }

        const channel = await client.channels.fetch(latestParty.channelId);
        const message = await channel.messages.fetch(latestParty.messageId);

        await message.edit(await buildActMessage(latestParty, message.guild));

        return latestParty;
    });

    messageUpdateQueues.set(partyId, nextUpdate);
    nextUpdate.finally(function() {
        if (messageUpdateQueues.get(partyId) === nextUpdate) {
            messageUpdateQueues.delete(partyId);
        }
    }).catch(function() {
        return null;
    });

    return await nextUpdate;
}
