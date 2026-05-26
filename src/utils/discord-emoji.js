const CUSTOM_EMOJI_PATTERN = /^<a?:[a-zA-Z0-9_]+:\d+>$/;
const guildEmojiCache = new Map();

export async function resolveEmojiText(guild, envName, fallbackText) {
    const value = String(process.env[envName] || '').trim();

    if (!value) {
        return fallbackText;
    }

    if (CUSTOM_EMOJI_PATTERN.test(value)) {
        return value;
    }

    const emoji = await findGuildEmojiByName(guild, value);

    return emoji ? emoji.toString() : fallbackText;
}

export async function resolveEmojiComponent(guild, envName) {
    const value = String(process.env[envName] || '').trim();

    if (!value) {
        return null;
    }

    const customEmoji = parseCustomEmoji(value);

    if (customEmoji) {
        return customEmoji;
    }

    const emoji = await findGuildEmojiByName(guild, value);

    if (!emoji) {
        return null;
    }

    return {
        id: emoji.id,
        name: emoji.name,
        animated: emoji.animated
    };
}

function parseCustomEmoji(value) {
    const match = value.match(/^<(a?):([a-zA-Z0-9_]+):(\d+)>$/);

    if (!match) {
        return null;
    }

    return {
        id: match[3],
        name: match[2],
        animated: match[1] === 'a'
    };
}

async function findGuildEmojiByName(guild, emojiName) {
    if (!guild || !emojiName) {
        return null;
    }

    const cachedEmoji = guild.emojis.cache.find(function(emoji) {
        return emoji.name === emojiName;
    });

    if (cachedEmoji) {
        return cachedEmoji;
    }

    try {
        const emojis = await fetchGuildEmojis(guild);

        return emojis.find(function(emoji) {
            return emoji.name === emojiName;
        }) || null;
    } catch (error) {
        return null;
    }
}

async function fetchGuildEmojis(guild) {
    if (guildEmojiCache.has(guild.id)) {
        return guildEmojiCache.get(guild.id);
    }

    const emojis = await guild.emojis.fetch();
    guildEmojiCache.set(guild.id, emojis);

    return emojis;
}
