const CURSEFORGE_API_BASE_URL = 'https://api.curseforge.com/v1';
const CURSEFORGE_ARK_SEARCH_URL = 'https://www.curseforge.com/ark-survival-ascended/search?class=mods';
const CURSEFORGE_ARK_MODS_ROOT_URL = 'https://www.curseforge.com/ark-survival-ascended/mods';
const CURSEFORGE_BATCH_SIZE = 50;

export function getCurseForgeArkModsUrl() {
    return CURSEFORGE_ARK_SEARCH_URL;
}

export function buildCurseForgeModFallbackUrl(modId) {
    return `${CURSEFORGE_ARK_SEARCH_URL}&search=${encodeURIComponent(String(modId || '').trim())}`;
}

export async function fetchCurseForgeModDetails(config, modIds) {
    const ids = normalizeModIds(modIds);
    const detailById = new Map(ids.map(function(modId) {
        return [modId, buildFallbackDetail(modId)];
    }));

    if (ids.length === 0) {
        return [];
    }

    if (!config.curseForgeApiKey) {
        return ids.map(function(modId) {
            return detailById.get(modId) || buildFallbackDetail(modId);
        });
    }

    try {
        const apiDetails = await fetchCurseForgeApiModDetails(config, ids);

        for (const detail of apiDetails) {
            detailById.set(detail.id, detail);
        }
    } catch (error) {
        console.error('CurseForge mod details fetch failed:', error);
    }

    return ids.map(function(modId) {
        return detailById.get(modId) || buildFallbackDetail(modId);
    });
}

export async function validateCurseForgeModDetails(config, modIds) {
    const details = await fetchCurseForgeModDetails(config, modIds);
    const unresolvedIds = details.filter(function(detail) {
        return !isResolvedCurseForgeModDetail(detail);
    }).map(function(detail) {
        return detail.id;
    });

    return {
        details: details,
        unresolvedIds: unresolvedIds
    };
}

export function isResolvedCurseForgeModDetail(detail) {
    return Boolean(detail?.id && detail.name && detail.url && detail.resolved);
}

async function fetchCurseForgeApiModDetails(config, ids) {
    const details = [];

    for (let index = 0; index < ids.length; index += CURSEFORGE_BATCH_SIZE) {
        const chunk = ids.slice(index, index + CURSEFORGE_BATCH_SIZE);
        const response = await fetch(`${CURSEFORGE_API_BASE_URL}/mods`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': config.curseForgeApiKey
            },
            body: JSON.stringify({
                modIds: chunk.map(Number)
            })
        });
        const text = await response.text();

        if (!response.ok) {
            throw new Error(`CurseForge API error: ${response.status} ${text}`);
        }

        const payload = JSON.parse(text);

        for (const mod of payload?.data || []) {
            details.push(buildApiDetail(mod));
        }
    }

    return details;
}

function buildApiDetail(mod) {
    const id = String(mod.id || '');
    const slug = mod.slug || '';
    const url = mod.links?.websiteUrl || (slug ? `${CURSEFORGE_ARK_MODS_ROOT_URL}/${encodeURIComponent(slug)}` : buildCurseForgeModFallbackUrl(id));

    return {
        id: id,
        name: mod.name || '',
        slug: slug,
        url: url,
        resolved: Boolean(id && mod.name && url),
        source: 'api'
    };
}

function buildFallbackDetail(modId) {
    return {
        id: String(modId),
        name: '',
        slug: '',
        url: buildCurseForgeModFallbackUrl(modId),
        resolved: false,
        source: 'fallback'
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
