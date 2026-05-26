export function padText(text, length) {
    const value = String(text || '');

    if (value.length >= length) {
        return value;
    }

    return value.padEnd(length, ' ');
}

export function createCodeBlock(text) {
    return `\`\`\`\n${text}\n\`\`\``;
}

export function normalizeSearchText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[・'’\-.]/g, '');
}

export function calculateKdaRatio(kills, deaths, assists) {
    const kdaValue = (kills + assists) / Math.max(deaths, 1);

    return kdaValue.toFixed(1);
}

export function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function sum(items, key) {
    return items.reduce(function(total, item) {
        return total + item[key];
    }, 0);
}
