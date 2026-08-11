import {
    applyMfhLocalEntry,
    getMfhCategoryLabel,
    localizeMfhFieldLabel,
    localizeMfhTags,
    localizeMfhValue,
    normalizeMfhLookupText
} from './mfh-localization.js';

const MFH_ROOT = 'https://mistfallhunter.gamedb.wiki';
const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;
const SEARCH_LIMIT = 10;
const AUTOCOMPLETE_LIMIT = 25;

export const MFH_SOURCES = [
    {
        key: 'weapons',
        label: getMfhCategoryLabel('weapons'),
        path: '/weapons/'
    },
    {
        key: 'armor',
        label: getMfhCategoryLabel('armor'),
        path: '/armor/'
    },
    {
        key: 'skills',
        label: getMfhCategoryLabel('skills'),
        path: '/skills/'
    },
    {
        key: 'talents',
        label: getMfhCategoryLabel('talents'),
        path: '/talents/'
    },
    {
        key: 'items',
        label: getMfhCategoryLabel('items'),
        path: '/items/'
    },
    {
        key: 'gems',
        label: getMfhCategoryLabel('gems'),
        path: '/gems/'
    }
];

let cachedIndex = null;

export async function searchMfhEntries(keyword, options = {}) {
    const query = String(keyword || '').trim();

    if (!query) {
        return [];
    }

    const index = await getMfhIndex();
    const category = String(options.category || '').trim();
    const scoredEntries = index.entries
        .filter(function(entry) {
            return !category || entry.category === category;
        })
        .map(function(entry) {
            return {
                entry: entry,
                score: getMfhSearchScore(entry, query)
            };
        })
        .filter(function(item) {
            return item.score !== null;
        })
        .sort(compareScoredEntries);

    return scoredEntries.slice(0, SEARCH_LIMIT).map(function(item) {
        return item.entry;
    });
}

export async function getMfhEntryDetail(name) {
    const query = String(name || '').trim();

    if (!query) {
        throw new Error('MFH entry name is empty.');
    }

    const index = await getMfhIndex();
    const entry = findBestMfhEntry(index.entries, query);

    if (!entry) {
        throw new Error('MFH entry was not found.');
    }

    try {
        const html = await fetchMfhText(entry.url);
        const detail = parseMfhDetailPage(html);

        return mergeMfhEntryDetail(entry, detail);
    } catch (error) {
        console.warn(`MFH detail page could not be loaded: ${entry.url}`, error.message);

        return entry;
    }
}

export async function autocompleteMfhEntries(query) {
    const keyword = String(query || '').trim();
    const index = await getMfhIndex();
    const scoredEntries = index.entries
        .map(function(entry) {
            return {
                entry: entry,
                score: keyword ? getMfhSearchScore(entry, keyword) : 20
            };
        })
        .filter(function(item) {
            return item.score !== null;
        })
        .sort(compareScoredEntries);

    return scoredEntries.slice(0, AUTOCOMPLETE_LIMIT).map(function(item) {
        const entry = item.entry;
        const displayName = getMfhDisplayName(entry);
        const name = displayName === entry.name
            ? `${displayName} (${getMfhCategoryLabel(entry.category)})`
            : `${displayName} / ${entry.name} (${getMfhCategoryLabel(entry.category)})`;

        return {
            name: truncateChoiceLabel(name),
            value: truncateChoiceValue(entry.name)
        };
    });
}

export async function getMfhIndex(options = {}) {
    if (!options.force
        && cachedIndex
        && cachedIndex.expiresAt > Date.now()) {
        return cachedIndex;
    }

    const results = await Promise.allSettled(MFH_SOURCES.map(fetchMfhSourceEntries));
    const entries = results
        .flatMap(function(result) {
            return result.status === 'fulfilled' ? result.value : [];
        })
        .sort(compareEntries);

    if (entries.length === 0) {
        const failures = results
            .filter(function(result) {
                return result.status === 'rejected';
            })
            .map(function(result) {
                return result.reason?.message || String(result.reason);
            });

        throw new Error(`MFH data could not be loaded. ${failures.join(' / ')}`);
    }

    cachedIndex = {
        entries: entries,
        fetchedAt: new Date().toISOString(),
        expiresAt: Date.now() + CACHE_TTL_MS
    };

    return cachedIndex;
}

async function fetchMfhSourceEntries(source) {
    const url = new URL(source.path, MFH_ROOT).toString();
    const html = await fetchMfhText(url);

    return parseMfhCatalogueEntries(html, source);
}

async function fetchMfhText(url) {
    const controller = new AbortController();
    const timeout = setTimeout(function() {
        controller.abort();
    }, FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'discord-bot MFH lookup',
                Accept: 'text/html,application/xhtml+xml'
            }
        });

        if (!response.ok) {
            throw new Error(`MFH request failed (${response.status})`);
        }

        return await response.text();
    } finally {
        clearTimeout(timeout);
    }
}

export function parseMfhCatalogueEntries(html, source) {
    const entries = [];
    const rowPattern = /<tr\b([^>]*)\bdata-gamedb-catalogue-item\b([^>]*)>([\s\S]*?)<\/tr>/giu;

    for (const match of String(html || '').matchAll(rowPattern)) {
        const attributes = `${match[1]} ${match[2]}`;
        const body = match[3] || '';
        const id = decodeHtmlEntities(extractAttribute(attributes, 'data-id'));
        const name = decodeHtmlEntities(extractAttribute(attributes, 'data-name'));
        const sortValues = parseJsonAttribute(extractAttribute(attributes, 'data-mf-sort-values'));
        const tags = decodeHtmlEntities(extractAttribute(attributes, 'data-tags'))
            .split('|')
            .map(function(tag) {
                return tag.trim();
            })
            .filter(Boolean);
        const cells = extractMfhCells(body);
        const href = decodeHtmlEntities(extractFirstMatch(body, /<a\b[^>]*href=["']([^"']+)["']/iu));
        const iconPath = decodeHtmlEntities(extractFirstMatch(body, /<img\b[^>]*src=["']([^"']+)["']/iu));
        const searchText = decodeHtmlEntities(extractAttribute(attributes, 'data-search'));
        const description = extractEntryDescription(name, searchText);

        if (!id || !name || !href) {
            continue;
        }

        const entry = {
            id: id,
            name: name,
            category: source.key,
            categoryLabel: source.label || getMfhCategoryLabel(source.key),
            url: new URL(href, MFH_ROOT).toString(),
            iconUrl: iconPath ? new URL(iconPath, MFH_ROOT).toString() : '',
            tags: tags,
            localizedTags: localizeMfhTags(tags),
            cells: cells,
            sortValues: sortValues,
            description: description,
            searchText: buildEntrySearchText({
                name: name,
                category: source.key,
                categoryLabel: source.label,
                tags: tags,
                cells: cells,
                searchText: searchText
            })
        };

        entries.push(applyMfhLocalEntry(entry));
    }

    return entries;
}

function extractMfhCells(rowHtml) {
    const cells = {};
    const cellPattern = /<(?:td|th)\b([^>]*)>([\s\S]*?)<\/(?:td|th)>/giu;

    for (const match of String(rowHtml || '').matchAll(cellPattern)) {
        const label = decodeHtmlEntities(extractAttribute(match[1], 'data-label'));

        if (!label) {
            continue;
        }

        const value = htmlToText(match[2]);

        if (value) {
            cells[label] = value;
        }
    }

    return cells;
}

export function parseMfhDetailPage(html) {
    const content = String(html || '');
    const title = htmlToText(extractFirstMatch(content, /<h1\b[^>]*id=["']entity-title["'][^>]*>([\s\S]*?)<\/h1>/iu));
    const description = htmlToText(extractFirstMatch(content, /<h1\b[^>]*id=["']entity-title["'][^>]*>[\s\S]*?<\/h1>\s*<p>([\s\S]*?)<\/p>/iu));
    const iconPath = decodeHtmlEntities(extractFirstMatch(content, /gdb-entity-hero__media[\s\S]*?<img\b[^>]*src=["']([^"']+)["']/iu));
    const tagsHtml = extractFirstMatch(content, /<ul\b[^>]*class=["'][^"']*gdb-tag-list[^"']*["'][^>]*>([\s\S]*?)<\/ul>/iu);
    const tags = Array.from(String(tagsHtml || '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/giu))
        .map(function(match) {
            return htmlToText(match[1]);
        })
        .filter(Boolean);

    return {
        title: title,
        description: description,
        iconUrl: iconPath ? new URL(iconPath, MFH_ROOT).toString() : '',
        tags: tags,
        localizedTags: localizeMfhTags(tags),
        stats: extractDefinitionList(content)
    };
}

function extractDefinitionList(html) {
    const stats = {};
    const definitionPattern = /<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/giu;

    for (const match of String(html || '').matchAll(definitionPattern)) {
        const key = htmlToText(match[1]);
        const value = htmlToText(match[2]);

        if (key && value && !stats[key]) {
            stats[key] = value;
        }
    }

    return stats;
}

function mergeMfhEntryDetail(entry, detail) {
    const merged = {
        ...entry,
        name: detail.title || entry.name,
        iconUrl: detail.iconUrl || entry.iconUrl,
        tags: detail.tags.length > 0 ? detail.tags : entry.tags,
        localizedTags: detail.localizedTags.length > 0 ? detail.localizedTags : entry.localizedTags,
        description: detail.description || entry.description,
        stats: {
            ...entry.cells,
            ...detail.stats
        }
    };

    return applyMfhLocalEntry(merged);
}

function findBestMfhEntry(entries, query) {
    const normalizedQuery = normalizeMfhText(query);
    const exact = entries.find(function(entry) {
        return getEntryLookupValues(entry).some(function(value) {
            return normalizeMfhText(value) === normalizedQuery;
        });
    });

    if (exact) {
        return exact;
    }

    return searchSort(entries, query)[0] || null;
}

function searchSort(entries, query) {
    return entries
        .map(function(entry) {
            return {
                entry: entry,
                score: getMfhSearchScore(entry, query)
            };
        })
        .filter(function(item) {
            return item.score !== null;
        })
        .sort(compareScoredEntries)
        .map(function(item) {
            return item.entry;
        });
}

function getMfhSearchScore(entry, keyword) {
    const query = normalizeMfhText(keyword);

    if (!query) {
        return null;
    }

    const name = normalizeMfhText(entry.name);
    const displayName = normalizeMfhText(entry.displayName);
    const aliases = normalizeMfhText((entry.aliases || []).join(' '));
    const tags = normalizeMfhText(entry.localizedTags.join(' ') || entry.tags.join(' '));
    const searchText = normalizeMfhText(entry.searchText);

    if (name === query || displayName === query || getEntryLookupValues(entry).some(function(value) {
        return normalizeMfhText(value) === query;
    })) {
        return 0;
    }

    if (name.startsWith(query) || displayName.startsWith(query)) {
        return 1;
    }

    if (name.includes(query) || displayName.includes(query) || aliases.includes(query)) {
        return 2;
    }

    if (tags.includes(query)) {
        return 3;
    }

    if (searchText.includes(query)) {
        return 4;
    }

    return null;
}

function compareScoredEntries(left, right) {
    if (left.score !== right.score) {
        return left.score - right.score;
    }

    return compareEntries(left.entry, right.entry);
}

function compareEntries(left, right) {
    const leftCategory = MFH_SOURCES.findIndex(function(source) {
        return source.key === left.category;
    });
    const rightCategory = MFH_SOURCES.findIndex(function(source) {
        return source.key === right.category;
    });

    if (leftCategory !== rightCategory) {
        return leftCategory - rightCategory;
    }

    return getMfhDisplayName(left).localeCompare(getMfhDisplayName(right), 'ja-JP');
}

function buildEntrySearchText(entry) {
    const cellText = Object.entries(entry.cells || {})
        .flatMap(function(pair) {
            return [localizeMfhFieldLabel(pair[0]), localizeMfhValue(pair[1]), pair[1]];
        })
        .join(' ');

    return [
        entry.name,
        entry.displayName,
        entry.localizedName,
        entry.category,
        entry.categoryLabel,
        getMfhCategoryLabel(entry.category),
        ...entry.tags,
        ...(entry.aliases || []),
        ...localizeMfhTags(entry.tags),
        cellText,
        entry.searchText
    ].filter(Boolean).join(' ');
}

function extractEntryDescription(name, searchText) {
    const text = String(searchText || '').trim();

    if (!text || !name || !text.startsWith(name)) {
        return '';
    }

    const rest = text.slice(name.length).trim();

    if (!rest || rest.startsWith(name)) {
        return '';
    }

    const repeatedNameIndex = rest.indexOf(` ${name} `);

    if (repeatedNameIndex <= 0) {
        return '';
    }

    return rest.slice(0, repeatedNameIndex).trim();
}

function normalizeMfhText(value) {
    return normalizeMfhLookupText(value);
}

function getMfhDisplayName(entry) {
    return entry.displayName || entry.localizedName || entry.name;
}

function getEntryLookupValues(entry) {
    return [
        entry.id,
        entry.name,
        entry.displayName,
        entry.localizedName,
        ...(entry.aliases || [])
    ].filter(Boolean);
}

export function formatMfhStats(entry, limit = 8) {
    const stats = entry.stats || entry.cells || {};

    return Object.entries(stats)
        .filter(function(pair) {
            return pair[0] && pair[1] && pair[0] !== 'Weapon' && pair[0] !== 'Armor' && pair[0] !== 'Skill' && pair[0] !== 'Talent' && pair[0] !== 'Item' && pair[0] !== 'Gem';
        })
        .slice(0, limit)
        .map(function(pair) {
            return {
                name: localizeMfhFieldLabel(pair[0]),
                value: localizeMfhValue(pair[1])
            };
        });
}

function parseJsonAttribute(value) {
    const decoded = decodeHtmlEntities(value);

    if (!decoded) {
        return {};
    }

    try {
        return JSON.parse(decoded);
    } catch (error) {
        return {};
    }
}

function extractAttribute(text, name) {
    const pattern = new RegExp(`${escapeRegex(name)}=(["'])([\\s\\S]*?)\\1`, 'iu');
    const match = String(text || '').match(pattern);

    return match && match[2] ? match[2] : '';
}

function extractFirstMatch(text, pattern) {
    const match = String(text || '').match(pattern);

    return match && match[1] ? match[1] : '';
}

function htmlToText(html) {
    return decodeHtmlEntities(String(html || '')
        .replace(/<script[\s\S]*?<\/script>/giu, ' ')
        .replace(/<style[\s\S]*?<\/style>/giu, ' ')
        .replace(/<br\s*\/?>/giu, ' ')
        .replace(/<\/(?:p|div|li|tr|td|th|span|dd|dt|h\d)>/giu, ' ')
        .replace(/<[^>]+>/gu, ' '))
        .replace(/\s+/gu, ' ')
        .trim();
}

function decodeHtmlEntities(text) {
    return String(text || '')
        .replace(/&quot;/gu, '"')
        .replace(/&#39;/gu, "'")
        .replace(/&apos;/gu, "'")
        .replace(/&amp;/gu, '&')
        .replace(/&lt;/gu, '<')
        .replace(/&gt;/gu, '>')
        .replace(/&nbsp;/gu, ' ')
        .replace(/&#x([0-9a-f]+);/giu, function(match, hex) {
            return String.fromCharCode(parseInt(hex, 16));
        })
        .replace(/&#(\d+);/gu, function(match, number) {
            return String.fromCharCode(parseInt(number, 10));
        });
}

function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function truncateChoiceLabel(value) {
    const text = String(value || '');

    return text.length > 100 ? `${text.slice(0, 97)}...` : text;
}

function truncateChoiceValue(value) {
    const text = String(value || '');

    return text.length > 100 ? text.slice(0, 100) : text;
}

export const __testables = {
    extractEntryDescription,
    formatMfhStats,
    getMfhSearchScore,
    normalizeMfhText,
    parseMfhCatalogueEntries,
    parseMfhDetailPage,
    getMfhDisplayName
};
