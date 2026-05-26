export function getRiotIdFromOptions(options) {
    const riotId = options.getString('riot-id');

    if (!riotId) {
        throw new Error('Riot IDを指定してください。');
    }

    return parseRiotId(riotId);
}

export function parseRiotId(riotId) {
    const normalizedRiotId = String(riotId || '')
        .replace('＃', '#')
        .trim();

    const separatorIndex = normalizedRiotId.lastIndexOf('#');

    if (separatorIndex === -1) {
        throw new Error('Riot IDは `名前#タグ` の形式で指定してください。');
    }

    const gameName = normalizedRiotId.slice(0, separatorIndex).trim();
    const tagLine = normalizedRiotId.slice(separatorIndex + 1).trim();

    if (!gameName || !tagLine) {
        throw new Error('Riot IDは `名前#タグ` の形式で指定してください。');
    }

    return {
        gameName: gameName,
        tagLine: tagLine
    };
}
