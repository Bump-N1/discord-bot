const RIOT_API_KEY = process.env.RIOT_API_KEY;

export const RIOT_PLATFORM = 'jp1';
export const RIOT_REGION = 'asia';

export async function riotFetch(url) {
    const response = await fetch(url, {
        headers: {
            'X-Riot-Token': RIOT_API_KEY
        }
    });

    if (response.status === 404) {
        throw new Error(`Riot API 404: Data not found.\n${url}`);
    }

    if (response.status === 401) {
        throw new Error(`Riot API 401: API key is not authorized.\n${url}`);
    }

    if (response.status === 403) {
        throw new Error(`Riot API 403: API access denied or API key is invalid.\n${url}`);
    }

    if (response.status === 429) {
        throw new Error(`Riot API 429: Rate limit exceeded.\n${url}`);
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Riot API error ${response.status}: ${text}\n${url}`);
    }

    return await response.json();
}
