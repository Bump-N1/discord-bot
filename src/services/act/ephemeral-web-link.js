const DISMISSAL_TTL_MS = 15 * 60 * 1000;
const pendingReplies = new Map();

export function registerEphemeralWebReply(url, interaction) {
    cleanupExpiredReplies();

    const token = getUrlToken(url);

    if (!token || !interaction?.deleteReply) {
        return;
    }

    pendingReplies.set(token, {
        interaction: interaction,
        expiresAt: Date.now() + DISMISSAL_TTL_MS
    });
}

export async function dismissEphemeralWebReply(token) {
    cleanupExpiredReplies();

    const pendingReply = pendingReplies.get(String(token || ''));

    if (!pendingReply) {
        return false;
    }

    pendingReplies.delete(String(token));

    try {
        await pendingReply.interaction.deleteReply();
        return true;
    } catch (error) {
        return false;
    }
}

function getUrlToken(url) {
    try {
        return new URL(url).searchParams.get('token') || '';
    } catch (error) {
        return '';
    }
}

function cleanupExpiredReplies() {
    const now = Date.now();

    for (const [token, pendingReply] of pendingReplies.entries()) {
        if (pendingReply.expiresAt <= now) {
            pendingReplies.delete(token);
        }
    }
}
