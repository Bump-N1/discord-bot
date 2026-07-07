const CURSEFORGE_API_BASE_URL = 'https://api.curseforge.com/v1';
const CURSEFORGE_ARK_SEARCH_URL = 'https://www.curseforge.com/ark-survival-ascended/search?class=mods';

export function getCurseForgeArkModsUrl() {
    return CURSEFORGE_ARK_SEARCH_URL;
}

export function buildCurseForgeModFallbackUrl(modId) {
    return `${CURSEFORGE_ARK_SEARCH_URL}&search=${encodeURIComponent(String(modId || '').trim())}`;
}

export async function fetchCurseForgeModDetails(config, modIds) {
    const ids = normalizeModIds(modIds);
    const fallbackDetails = ids.map(buildFallbackDetail);

    if (!config.curseForgeApiKey || ids.length === 0) {
        return fallbackDetails;
    }

    try {
        const response = await fetch(`${CURSEFORGE_API_BASE_URL}/mods`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': config.curseForgeApiKey
            },
            body: JSON.stringify({
                modIds: ids.map(Number)
            })
        });
        const text = await response.text();

        if (!response.ok) {
            throw new Error(`CurseForge API error: ${response.status} ${text}`);
        }

        const payload = JSON.parse(text);
        const detailById = new Map((payload?.data || []).map(function(mod) {
            return [String(mod.id), {
                id: String(mod.id),
                name: mod.name || '',
                slug: mod.slug || '',
                url: mod.links?.websiteUrl || buildCurseForgeModFallbackUrl(mod.id)
            }];
        }));

        return ids.map(function(modId) {
            return detailById.get(modId) || buildFallbackDetail(modId);
        });
    } catch (error) {
        console.error('CurseForge mod details fetch failed:', error);

        return fallbackDetails;
    }
}

function buildFallbackDetail(modId) {
    return {
        id: String(modId),
        name: '',
        slug: '',
        url: buildCurseForgeModFallbackUrl(modId)
    };
}

function normalizeModIds(modIds) {
    const values = Array.isArray(modIds)
        ? modIds
        : String(modIds || '').split(/[,\s]+/u);

    return Array.from(new Set(values.map(function(modId) {
        return String(modId || '').trim();
    }).filter(function(modId) {
        return /^\d+$/u.test(modId);
    })));
}
