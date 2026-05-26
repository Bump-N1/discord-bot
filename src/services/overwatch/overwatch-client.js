const OVERFAST_BASE_URL = 'https://overfast-api.tekrop.fr';

export async function overfastFetch(path) {
    const url = `${OVERFAST_BASE_URL}${path}`;
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json'
        }
    });

    if (response.status === 404) {
        throw new Error(`OverFast API 404: player not found or profile is private.\n${url}`);
    }

    if (response.status === 429) {
        throw new Error(`OverFast API 429: rate limit exceeded.\n${url}`);
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OverFast API error ${response.status}: ${text}\n${url}`);
    }

    return await response.json();
}

export function buildOverfastPlayerId(battleTag) {
    const value = String(battleTag || '').trim();

    if (!value.includes('#')) {
        throw new Error('BattleTagは `名前#タグ` の形式で指定してください。');
    }

    return value.replace('#', '-');
}
