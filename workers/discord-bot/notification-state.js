export const SOURCE_STATE_SCHEMA_VERSION = 1;
export const SOURCE_STATE_HISTORY_LIMIT = 100;

export function getSourceStateKey(source) {
    return `source-state:${source.game}`;
}

export async function loadSourceNotificationState(kv, source) {
    const storedState = await readJsonValue(kv, getSourceStateKey(source));

    if (storedState && storedState.schemaVersion === SOURCE_STATE_SCHEMA_VERSION) {
        return {
            state: normalizeSourceState(storedState),
            isCurrentSchema: true,
            needsPersistence: false
        };
    }

    if (storedState && Number(storedState.schemaVersion) > SOURCE_STATE_SCHEMA_VERSION) {
        throw new Error(`unsupported source state schema: ${storedState.schemaVersion}`);
    }

    const observedIds = await readStringList(kv, `posted:${source.game}`);
    const deliveredIds = source.retryUnconfirmedLatest === true
        ? await readStringList(kv, `delivered:${source.game}`)
        : observedIds;
    const latestId = String(await kv.get(`latest:${source.game}`) || '');

    return {
        state: normalizeSourceState({
            schemaVersion: SOURCE_STATE_SCHEMA_VERSION,
            initialized: observedIds.length > 0,
            observedIds: observedIds,
            deliveredIds: deliveredIds,
            pendingIds: [],
            latestId: latestId,
            initializedAt: '',
            updatedAt: ''
        }),
        isCurrentSchema: false,
        needsPersistence: true
    };
}

export function planSourceNotifications(source, currentState, patchNotes, options = {}) {
    const state = normalizeSourceState(currentState);
    const before = getComparableStateValue(state);
    const now = options.now || new Date().toISOString();
    const wasInitialized = state.initialized;
    const observedIdSet = new Set(state.observedIds);
    const deliveredIdSet = new Set(state.deliveredIds);
    const latestPatchNote = patchNotes[0];
    let initialRun = false;
    let rebaselined = false;
    let newPatchNotes = [];

    if (!wasInitialized) {
        initialRun = true;
        state.initialized = true;
        state.initializedAt = now;

        if ((options.postOnFirstRun === true || source.postLatestOnFirstRun === true) && latestPatchNote) {
            newPatchNotes = [latestPatchNote];
        }
    } else {
        const boundaryIndex = patchNotes.findIndex(function(patchNote) {
            return isPostedPatchNote(observedIdSet, patchNote);
        });

        if (boundaryIndex > 0) {
            newPatchNotes = patchNotes.slice(0, boundaryIndex);
        } else if (boundaryIndex < 0 && state.observedIds.length > 0) {
            rebaselined = true;

            if (options.allowLatestOnDiscontinuity === true && latestPatchNote) {
                newPatchNotes = [latestPatchNote];
            }
        }
    }

    if (source.checkMultiple !== true) {
        newPatchNotes = newPatchNotes.slice(0, 1);
    }

    for (const patchNote of newPatchNotes) {
        state.pendingIds = mergeRecentIds(getStoredPatchNoteIds(patchNote), state.pendingIds);
    }

    if (wasInitialized
        && source.retryUnconfirmedLatest === true
        && latestPatchNote
        && isPostedPatchNote(observedIdSet, latestPatchNote)
        && !isPostedPatchNote(deliveredIdSet, latestPatchNote)) {
        state.pendingIds = mergeRecentIds(getStoredPatchNoteIds(latestPatchNote), state.pendingIds);
    }

    state.observedIds = mergeRecentIds(collectStoredIds(patchNotes), state.observedIds);
    state.latestId = latestPatchNote ? getStoredPatchNoteId(latestPatchNote) : state.latestId;
    state.pendingIds = state.pendingIds.filter(function(id) {
        return !state.deliveredIds.includes(id);
    });

    const stateChanged = before !== getComparableStateValue(state);

    if (stateChanged) {
        state.updatedAt = now;
    }

    return {
        state: state,
        stateChanged: stateChanged,
        initialRun: initialRun,
        rebaselined: rebaselined
    };
}

export function getPendingPatchNotes(state, patchNotes) {
    const pendingIdSet = new Set(state.pendingIds);
    const deliveredIdSet = new Set(state.deliveredIds);

    return patchNotes.filter(function(patchNote) {
        return isPostedPatchNote(pendingIdSet, patchNote)
            && !isPostedPatchNote(deliveredIdSet, patchNote);
    }).reverse();
}

export function markPatchNoteDelivered(currentState, patchNote, now = new Date().toISOString()) {
    const state = normalizeSourceState(currentState);
    const patchNoteIds = new Set(getStoredPatchNoteIds(patchNote));

    state.pendingIds = state.pendingIds.filter(function(id) {
        return !patchNoteIds.has(id);
    });
    state.deliveredIds = mergeRecentIds(Array.from(patchNoteIds), state.deliveredIds);
    state.updatedAt = now;
    return state;
}

export async function saveSourceNotificationState(kv, source, currentState, options = {}) {
    const state = normalizeSourceState(currentState);

    await kv.put(getSourceStateKey(source), JSON.stringify(state));

    if (options.syncLegacy === true) {
        await syncLegacySourceNotificationState(kv, source, state);
    }
}

export async function syncLegacySourceNotificationState(kv, source, currentState) {
    const state = normalizeSourceState(currentState);
    const pendingIdSet = new Set(state.pendingIds);
    const rollbackSafeObservedIds = state.observedIds.filter(function(id) {
        return !pendingIdSet.has(id);
    });

    await kv.put(`posted:${source.game}`, JSON.stringify(rollbackSafeObservedIds));
    await kv.put(`latest:${source.game}`, state.latestId || '');

    if (source.retryUnconfirmedLatest === true) {
        await kv.put(`delivered:${source.game}`, JSON.stringify(state.deliveredIds));
    }
}

export function applySourceDedupeOptions(source, patchNote) {
    if (source.dedupeByUrl !== false) {
        return patchNote;
    }

    return {
        ...patchNote,
        dedupeByUrl: false
    };
}

export function isPostedPatchNote(postedIdSet, patchNote) {
    return getStoredPatchNoteIds(patchNote).some(function(id) {
        return postedIdSet.has(id);
    });
}

export function getStoredPatchNoteId(patchNote) {
    return getStoredPatchNoteIds(patchNote)[0] || '';
}

export function getStoredPatchNoteIds(patchNote) {
    const ids = [];

    if (patchNote.id) {
        ids.push(`id:${String(patchNote.id)}`);
    }

    if (patchNote.url && patchNote.dedupeByUrl !== false) {
        ids.push(`url:${normalizeComparableUrl(patchNote.url)}`);
    }

    return ids.filter(Boolean);
}

export function uniquePatchNotes(patchNotes) {
    const seen = new Set();
    const unique = [];

    for (const patchNote of patchNotes) {
        if (!patchNote) {
            continue;
        }

        const keys = getPatchNoteKeys(patchNote);

        if (keys.length === 0 || keys.some(function(key) {
            return seen.has(key);
        })) {
            continue;
        }

        for (const key of keys) {
            seen.add(key);
        }

        unique.push(patchNote);
    }

    return unique;
}

export function getPatchNoteKeys(patchNote) {
    const keys = [];

    if (patchNote.id) {
        keys.push(`id:${String(patchNote.id)}`);
    }

    if (patchNote.url && patchNote.dedupeByUrl !== false) {
        keys.push(`url:${normalizeComparableUrl(patchNote.url)}`);
    }

    return keys.filter(Boolean);
}

export function normalizeComparableUrl(url) {
    return String(url || '')
        .split('#')[0]
        .replace(/[?&]utm_[^&]+/g, '')
        .replace(/[?&]utm[^&]+/g, '')
        .replace(/[?&]$/, '')
        .trim();
}

function normalizeSourceState(state) {
    const normalized = state && typeof state === 'object' ? state : {};

    return {
        schemaVersion: SOURCE_STATE_SCHEMA_VERSION,
        initialized: normalized.initialized === true,
        observedIds: normalizeStringList(normalized.observedIds),
        deliveredIds: normalizeStringList(normalized.deliveredIds),
        pendingIds: normalizeStringList(normalized.pendingIds),
        latestId: typeof normalized.latestId === 'string' ? normalized.latestId : '',
        initializedAt: typeof normalized.initializedAt === 'string' ? normalized.initializedAt : '',
        updatedAt: typeof normalized.updatedAt === 'string' ? normalized.updatedAt : ''
    };
}

function normalizeStringList(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(new Set(value.filter(function(item) {
        return typeof item === 'string' && item;
    }))).slice(0, SOURCE_STATE_HISTORY_LIMIT);
}

function collectStoredIds(patchNotes) {
    let storedIds = [];

    for (const patchNote of patchNotes) {
        storedIds = storedIds.concat(getStoredPatchNoteIds(patchNote));
    }

    return mergeRecentIds(storedIds, []);
}

function mergeRecentIds(primaryIds, secondaryIds) {
    return Array.from(new Set([].concat(primaryIds, secondaryIds)))
        .slice(0, SOURCE_STATE_HISTORY_LIMIT);
}

function getComparableStateValue(state) {
    return JSON.stringify({
        initialized: state.initialized,
        observedIds: state.observedIds,
        deliveredIds: state.deliveredIds,
        pendingIds: state.pendingIds,
        latestId: state.latestId,
        initializedAt: state.initializedAt
    });
}

async function readJsonValue(kv, key) {
    const value = await kv.get(key);

    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return null;
    }
}

async function readStringList(kv, key) {
    const value = await kv.get(key);

    if (!value) {
        return [];
    }

    try {
        const parsedValue = JSON.parse(value);

        if (Array.isArray(parsedValue)) {
            return normalizeStringList(parsedValue);
        }

        if (typeof parsedValue === 'string' && parsedValue) {
            return [parsedValue];
        }
    } catch (error) {
        return [String(value)];
    }

    return [];
}
