import { randomUUID } from 'node:crypto';
import {
    CLOSED_ACT_REOPEN_VISIBLE_MS,
    FF14_ALL_ROLE_KEY,
    LOL_LANE_SLOTS,
    OW_ROLE_SLOTS,
    ACT_STATUS_CLOSED,
    ACT_STATUS_OPEN,
    getFf14Job,
    getFf14PartyType,
    getFf14RoleSelection,
    getFf14Role,
    getMultipleSlotParticipants,
    getActDefinition,
    usesFf14RoleSlots,
    usesLolLaneSlots
} from './act-definitions.js';
import { parseActDateTimeOrThrow } from './act-datetime.js';
import { getAct, saveAct, updateAct } from './act-store.js';
import {
    ACT_ASSIGNMENT_PREFERENCE,
    applyPreferenceComposition,
    normalizePreferenceInput,
    usesPreferenceComposition
} from './act-composition.js';

export async function createLolAct(options) {
    const usesSlots = usesLolLaneSlots(options.mode);
    const slotDefinitions = usesSlots ? LOL_LANE_SLOTS : [];

    return await createParty({
        ...options,
        game: 'lol',
        usesSlots: usesSlots,
        slotDefinitions: slotDefinitions,
        maxParticipants: 5
    });
}

export async function createOwAct(options) {
    return await createParty({
        ...options,
        game: 'ow',
        usesSlots: true,
        slotDefinitions: OW_ROLE_SLOTS,
        maxParticipants: 5
    });
}

export async function createFf14Act(options) {
    const partyType = getFf14PartyType(options.partyType);
    const ff14RoleSelection = getFf14RoleSelection(options.ff14RoleSelection);

    return await createParty({
        ...options,
        game: 'ff14',
        mode: options.contentName,
        ff14RoleSelection: ff14RoleSelection,
        usesSlots: true,
        slotDefinitions: [],
        maxParticipants: partyType.maxParticipants
    });
}

async function createParty(options) {
    const now = new Date().toISOString();
    const parsedDateTime = parseActDateTimeOrThrow(options.datetime);
    const party = {
        id: randomUUID(),
        game: options.game,
        mode: options.mode,
        partyType: options.partyType,
        contentName: options.contentName,
        datetime: parsedDateTime.displayText,
        datetimeInput: parsedDateTime.inputText,
        scheduledAt: parsedDateTime.scheduledAt,
        reminderSentAt: '',
        autoClosedAt: '',
        details: options.details,
        creatorId: options.creatorId,
        guildId: options.guildId,
        channelId: options.channelId,
        messageId: '',
        status: ACT_STATUS_OPEN,
        closedAt: '',
        usesSlots: options.usesSlots,
        slots: options.usesSlots ? buildEmptySlots(options.slotDefinitions) : {},
        anyParticipants: options.game === 'lol' ? [] : undefined,
        multiParticipants: buildEmptyMultiParticipants(options.slotDefinitions),
        pendingSlots: {},
        ff14RoleSelection: options.game === 'ff14' ? options.ff14RoleSelection : undefined,
        pendingFf14Selections: options.game === 'ff14' ? {} : undefined,
        ff14Participants: options.game === 'ff14' ? [] : undefined,
        participants: [],
        participantNames: {},
        webManaged: Boolean(options.webManaged),
        assignmentMode: options.assignmentMode || '',
        preferenceParticipants: options.assignmentMode === ACT_ASSIGNMENT_PREFERENCE ? [] : undefined,
        maxParticipants: options.maxParticipants,
        createdAt: now,
        updatedAt: now
    };

    await saveAct(party);

    return party;
}

export async function getActById(partyId) {
    return await getAct(partyId);
}

export async function setActMessageId(partyId, messageId) {
    const result = await updateExistingParty(partyId, function(party) {
        party.messageId = messageId;
        party.updatedAt = new Date().toISOString();

        return {
            party: party
        };
    });

    return result.party;
}

export async function selectActSlot(partyId, slotKey, userId) {
    return await updateExistingParty(partyId, function(party) {
        if (party.status !== ACT_STATUS_OPEN) {
            return buildFailure('この募集は締め切られています。', party);
        }

        if (!party.usesSlots || !isValidPartySlot(party, slotKey)) {
            return buildFailure('参加枠が見つかりません。', party);
        }

        if (getPartyParticipantCount(party) >= party.maxParticipants && !isUserInParty(party, userId)) {
            return buildFailure('募集人数が埋まっています。', party);
        }

        if (isGroupedPartySlotSelection(party, slotKey)) {
            const availableSlot = getAvailableGroupedSlot(party, slotKey, userId);

            if (!availableSlot) {
                return buildFailure(`${getGroupedSlotDisplayLabel(party, slotKey)}枠が埋まっています。`, party);
            }

            party.pendingSlots = party.pendingSlots || {};
            party.pendingSlots[userId] = slotKey;
            party.updatedAt = new Date().toISOString();

            return buildDeferredSuccess(party, 'ロールを選択しました。参加ボタンで確定してください。');
        }

        const currentUserId = isMultiplePartySlot(party, slotKey) ? null : party.slots[slotKey];

        if (currentUserId && currentUserId !== userId) {
            return buildFailure('その枠はすでに埋まっています。', party);
        }

        party.pendingSlots = party.pendingSlots || {};
        party.pendingSlots[userId] = slotKey;
        party.updatedAt = new Date().toISOString();

        return buildDeferredSuccess(party, 'レーンを選択しました。参加ボタンで確定してください。');
    });
}

export async function selectFf14Role(partyId, roleKey, userId) {
    return await updateExistingParty(partyId, function(party) {
        if (party.status !== ACT_STATUS_OPEN) {
            return buildFailure('この募集は締め切られています。', party);
        }

        if (party.game !== 'ff14') {
            return buildFailure('FF14募集ではありません。', party);
        }

        const role = getFf14Role(roleKey);

        if (!role) {
            return buildFailure('参加ロールが見つかりません。', party);
        }

        const capacityFailure = validateFf14Capacity(party, role.key, userId);

        if (capacityFailure) {
            return buildFailure(capacityFailure, party);
        }

        party.pendingFf14Selections = party.pendingFf14Selections || {};
        party.pendingFf14Selections[userId] = {
            role: role.key,
            jobKey: role.key === FF14_ALL_ROLE_KEY ? role.anyJobKey : ''
        };
        party.updatedAt = new Date().toISOString();

        return buildDeferredSuccess(party);
    });
}

export async function selectFf14Job(partyId, jobKey, userId) {
    return await updateExistingParty(partyId, function(party) {
        if (party.status !== ACT_STATUS_OPEN) {
            return buildFailure('この募集は締め切られています。', party);
        }

        if (party.game !== 'ff14') {
            return buildFailure('FF14募集ではありません。', party);
        }

        const job = getFf14Job(jobKey);

        if (!job) {
            return buildFailure('ジョブが見つかりません。', party);
        }

        const capacityFailure = validateFf14Capacity(party, job.role, userId);

        if (capacityFailure) {
            return buildFailure(capacityFailure, party);
        }

        party.pendingFf14Selections = party.pendingFf14Selections || {};
        party.pendingFf14Selections[userId] = {
            role: job.role,
            jobKey: job.key
        };
        party.updatedAt = new Date().toISOString();

        return buildDeferredSuccess(party);
    });
}

export async function confirmActSlot(partyId, userId) {
    return await updateExistingParty(partyId, function(party) {
        if (party.status !== ACT_STATUS_OPEN) {
            return buildFailure('この募集は締め切られています。', party);
        }

        if (!party.usesSlots) {
            return buildFailure('参加枠を選択できない募集です。', party);
        }

        if (party.game === 'ff14') {
            return confirmFf14Selection(party, userId);
        }

        party.pendingSlots = party.pendingSlots || {};
        const slotKey = party.pendingSlots[userId];

        if (!slotKey || !isValidPartySlot(party, slotKey)) {
            return buildFailure('先にレーンを選択してください。', party);
        }

        if (isMultiplePartySlot(party, slotKey)) {
            return confirmMultipleSlot(party, slotKey, userId);
        }

        if (isGroupedPartySlotSelection(party, slotKey)) {
            return confirmGroupedSlot(party, slotKey, userId);
        }

        const currentUserId = party.slots[slotKey];

        if (currentUserId && currentUserId !== userId) {
            delete party.pendingSlots[userId];
            return buildFailure('その枠はすでに埋まっています。', party);
        }

        if (getPartyParticipantCount(party) >= party.maxParticipants && !isUserInParty(party, userId)) {
            delete party.pendingSlots[userId];
            return buildFailure('募集人数が埋まっています。', party);
        }

        removeUserFromSlots(party, userId);
        removeUserFromMultipleParticipants(party, userId);
        compactAllGroupedSlots(party);
        party.slots[slotKey] = userId;
        delete party.pendingSlots[userId];
        party.updatedAt = new Date().toISOString();

        return buildSuccess(party);
    });
}

export async function joinActList(partyId, userId, displayName = '') {
    return await updateExistingParty(partyId, function(party) {
        if (party.status !== ACT_STATUS_OPEN) {
            return buildFailure('この募集は締め切られています。', party);
        }

        if (party.usesSlots) {
            return buildFailure('参加枠を選択してください。', party);
        }

        if (party.participants.includes(userId)) {
            party.participantNames = party.participantNames || {};
            party.participantNames[userId] = String(displayName || party.participantNames[userId] || '');
            return buildSuccess(party);
        }

        if (party.participants.length >= party.maxParticipants) {
            return buildFailure('募集人数が埋まっています。', party);
        }

        party.participants.push(userId);
        party.participantNames = party.participantNames || {};
        party.participantNames[userId] = String(displayName || '');
        party.updatedAt = new Date().toISOString();

        return buildSuccess(party);
    });
}

export async function setActPreference(partyId, userId, displayName, input) {
    return await updateExistingParty(partyId, function(party) {
        if (party.status !== ACT_STATUS_OPEN) {
            return buildFailure('この募集は締め切られています。', party);
        }

        if (!usesPreferenceComposition(party)) {
            return buildFailure('希望を登録できない募集です。', party);
        }

        const normalized = normalizePreferenceInput(party, input);

        if (!normalized.ok) {
            return buildFailure(normalized.message, party);
        }

        const existingParticipants = party.preferenceParticipants || [];
        const currentParticipant = existingParticipants.find(function(participant) {
            return participant.userId === userId;
        });

        if (!currentParticipant && existingParticipants.length >= party.maxParticipants) {
            return buildFailure('募集人数が埋まっています。', party);
        }

        const participant = {
            userId: userId,
            displayName: String(displayName || ''),
            ...normalized.preference,
            joinedAt: currentParticipant?.joinedAt || new Date().toISOString()
        };
        const nextParticipants = existingParticipants
            .filter(function(existingParticipant) {
                return existingParticipant.userId !== userId;
            })
            .concat(participant);
        const compositionResult = applyPreferenceComposition(party, nextParticipants);

        if (!compositionResult.ok) {
            return buildFailure(compositionResult.message, party);
        }

        party.updatedAt = new Date().toISOString();

        return buildSuccess(party);
    });
}

export async function leaveAct(partyId, userId) {
    return await updateExistingParty(partyId, function(party) {
        let removed = false;

        if (usesPreferenceComposition(party)) {
            const beforeCount = (party.preferenceParticipants || []).length;
            const remainingParticipants = (party.preferenceParticipants || []).filter(function(participant) {
                return participant.userId !== userId;
            });

            removed = beforeCount !== remainingParticipants.length;

            if (removed) {
                applyPreferenceComposition(party, remainingParticipants);
            }
        } else if (party.game === 'ff14') {
            removed = removeFf14Participant(party, userId);
            delete party.pendingFf14Selections?.[userId];
        } else if (party.usesSlots) {
            removed = removeUserFromSlots(party, userId);
            removed = removeUserFromMultipleParticipants(party, userId) || removed;
            compactAllGroupedSlots(party);
        } else {
            const beforeCount = party.participants.length;
            party.participants = party.participants.filter(function(participantId) {
                return participantId !== userId;
            });
            delete party.participantNames?.[userId];
            removed = beforeCount !== party.participants.length;
        }

        if (!removed) {
            return buildFailure('この募集には参加していません。', party);
        }

        party.updatedAt = new Date().toISOString();

        return buildSuccess(party);
    });
}

export async function closeAct(partyId, userId) {
    return await updateExistingParty(partyId, function(party) {
        if (party.creatorId !== userId) {
            return buildFailure('募集を締め切れるのは作成者だけです。', party);
        }

        party.status = ACT_STATUS_CLOSED;
        party.closedAt = new Date().toISOString();
        party.updatedAt = new Date().toISOString();

        return buildSuccess(party);
    });
}

export async function reopenAct(partyId, userId) {
    return await updateExistingParty(partyId, function(party) {
        if (party.creatorId !== userId) {
            return buildFailure('募集を再開できるのは作成者だけです。', party);
        }

        if (!canReopenParty(party)) {
            return buildFailure('締め切り解除できる時間を過ぎています。', party);
        }

        party.status = ACT_STATUS_OPEN;
        party.closedAt = '';
        party.updatedAt = new Date().toISOString();

        return buildSuccess(party);
    });
}

export async function updateActEditableFields(partyId, userId, fields) {
    return await updateExistingParty(partyId, function(party) {
        if (party.creatorId !== userId) {
            return buildFailure('募集を編集できるのは作成者だけです。', party);
        }

        const datetime = normalizeRequiredText(fields.datetime);
        const details = normalizeRequiredText(fields.details);

        if (!datetime) {
            return buildFailure('日時を入力してください。', party);
        }

        if (!details) {
            return buildFailure('募集内容を入力してください。', party);
        }

        let parsedDateTime;

        try {
            parsedDateTime = parseActDateTimeOrThrow(datetime);
        } catch (error) {
            return buildFailure(error.message, party);
        }

        party.datetime = parsedDateTime.displayText;
        party.datetimeInput = parsedDateTime.inputText;
        party.scheduledAt = parsedDateTime.scheduledAt;
        party.reminderSentAt = '';
        party.autoClosedAt = '';
        party.details = details;

        if (party.game === 'ff14') {
            const contentName = normalizeRequiredText(fields.contentName);

            if (!contentName) {
                return buildFailure('コンテンツ名を入力してください。', party);
            }

            party.contentName = contentName;
            party.mode = contentName;
        }

        party.updatedAt = new Date().toISOString();

        return buildSuccess(party);
    });
}

async function updateExistingParty(partyId, updater) {
    return await updateAct(partyId, function(party) {
        if (!party) {
            throw new Error('募集が見つかりません。');
        }

        return updater(party);
    });
}

function normalizeRequiredText(value) {
    return String(value || '').trim();
}

function canReopenParty(party) {
    if (party.autoClosedAt) {
        return false;
    }

    const closedAt = Date.parse(party.closedAt || party.updatedAt || party.createdAt || '');

    if (Number.isNaN(closedAt)) {
        return true;
    }

    return Date.now() - closedAt < CLOSED_ACT_REOPEN_VISIBLE_MS;
}

function buildEmptySlots(slotDefinitions) {
    return slotDefinitions.reduce(function(slots, slot) {
        if (!slot.multiple) {
            slots[slot.key] = null;
        }

        return slots;
    }, {});
}

function buildEmptyMultiParticipants(slotDefinitions) {
    return slotDefinitions.reduce(function(participants, slot) {
        if (slot.multiple) {
            participants[slot.key] = [];
        }

        return participants;
    }, {});
}

function removeUserFromSlots(party, userId) {
    let removed = false;

    for (const slotKey of Object.keys(party.slots)) {
        if (party.slots[slotKey] === userId) {
            party.slots[slotKey] = null;
            removed = true;
        }
    }

    return removed;
}

function confirmMultipleSlot(party, slotKey, userId) {
    party.multiParticipants = party.multiParticipants || {};
    party.multiParticipants[slotKey] = getMultipleSlotParticipants(party, slotKey);

    if (getPartyParticipantCount(party) >= party.maxParticipants && !isUserInParty(party, userId)) {
        delete party.pendingSlots[userId];
        return buildFailure('募集人数が埋まっています。', party);
    }

    removeUserFromSlots(party, userId);
    removeUserFromMultipleParticipants(party, userId);
    compactAllGroupedSlots(party);

    if (!party.multiParticipants[slotKey].includes(userId)) {
        party.multiParticipants[slotKey].push(userId);
    }

    delete party.pendingSlots[userId];
    party.updatedAt = new Date().toISOString();

    return buildSuccess(party);
}

function removeUserFromMultipleParticipants(party, userId) {
    let removed = false;

    for (const slot of getMultipleSlots(party)) {
        const participants = getMultipleSlotParticipants(party, slot.key);
        const nextParticipants = participants.filter(function(participantId) {
            return participantId !== userId;
        });

        if (nextParticipants.length !== participants.length) {
            party.multiParticipants = party.multiParticipants || {};
            party.multiParticipants[slot.key] = nextParticipants;
            removed = true;
        }
    }

    return removed;
}

function confirmFf14Selection(party, userId) {
    party.pendingFf14Selections = party.pendingFf14Selections || {};
    party.ff14Participants = party.ff14Participants || [];

    const pendingSelection = party.pendingFf14Selections[userId];

    if (!pendingSelection?.role) {
        return buildFailure('先にロールを選択してください。', party);
    }

    const role = getFf14Role(pendingSelection.role);

    if (!role) {
        delete party.pendingFf14Selections[userId];
        return buildFailure('参加ロールが見つかりません。', party);
    }

    if (!pendingSelection.jobKey) {
        return buildFailure('先にジョブを選択してください。', party);
    }

    const job = getFf14Job(pendingSelection.jobKey);

    if (!job || job.role !== role.key) {
        delete party.pendingFf14Selections[userId];
        return buildFailure('選択したロールに対応するジョブが見つかりません。', party);
    }

    const capacityFailure = validateFf14Capacity(party, role.key, userId);

    if (capacityFailure) {
        delete party.pendingFf14Selections[userId];
        return buildFailure(capacityFailure, party);
    }

    removeFf14Participant(party, userId);
    party.ff14Participants.push({
        userId: userId,
        role: role.key,
        jobKey: job.key
    });
    delete party.pendingFf14Selections[userId];
    party.updatedAt = new Date().toISOString();

    return buildSuccess(party);
}

function confirmGroupedSlot(party, groupKey, userId) {
    const availableSlot = getAvailableGroupedSlot(party, groupKey, userId);

    if (!availableSlot) {
        delete party.pendingSlots[userId];
        return buildFailure(`${getGroupedSlotDisplayLabel(party, groupKey)}枠が埋まっています。`, party);
    }

    if (getPartyParticipantCount(party) >= party.maxParticipants && !isUserInParty(party, userId)) {
        delete party.pendingSlots[userId];
        return buildFailure('募集人数が埋まっています。', party);
    }

    removeUserFromSlots(party, userId);
    removeUserFromMultipleParticipants(party, userId);
    compactAllGroupedSlots(party);

    const targetSlot = getAvailableGroupedSlot(party, groupKey, userId);

    if (!targetSlot) {
        delete party.pendingSlots[userId];
        return buildFailure(`${getGroupedSlotDisplayLabel(party, groupKey)}枠が埋まっています。`, party);
    }

    party.slots[targetSlot.key] = userId;
    delete party.pendingSlots[userId];
    party.updatedAt = new Date().toISOString();

    return buildSuccess(party);
}

function validateFf14Capacity(party, roleKey, userId) {
    const participants = getFf14ParticipantsWithoutUser(party, userId);
    const partyType = getFf14PartyType(party.partyType);

    if (participants.length >= partyType.maxParticipants) {
        return '募集人数が埋まっています。';
    }

    if (!usesFf14RoleSlots(party) || roleKey === FF14_ALL_ROLE_KEY) {
        return '';
    }

    const role = getFf14Role(roleKey);
    const roleCapacity = partyType.capacities[roleKey] || 0;
    const roleParticipants = participants.filter(function(participant) {
        return participant.role === roleKey;
    });

    if (roleParticipants.length >= roleCapacity) {
        return `${role.label}枠が埋まっています。`;
    }

    return '';
}

function getFf14ParticipantsWithoutUser(party, userId) {
    return (party.ff14Participants || []).filter(function(participant) {
        return participant.userId !== userId;
    });
}

function removeFf14Participant(party, userId) {
    const beforeCount = (party.ff14Participants || []).length;
    party.ff14Participants = getFf14ParticipantsWithoutUser(party, userId);

    return beforeCount !== party.ff14Participants.length;
}

function getPartyParticipantCount(party) {
    if (party.game === 'ff14') {
        return (party.ff14Participants || []).length;
    }

    if (!party.usesSlots) {
        return party.participants.length;
    }

    const slotParticipantCount = Object.values(party.slots).filter(Boolean).length;
    const multipleParticipantCount = getMultipleSlots(party).reduce(function(total, slot) {
        return total + getMultipleSlotParticipants(party, slot.key).length;
    }, 0);

    return slotParticipantCount + multipleParticipantCount;
}

function isUserInParty(party, userId) {
    if (party.game === 'ff14') {
        return (party.ff14Participants || []).some(function(participant) {
            return participant.userId === userId;
        });
    }

    if (!party.usesSlots) {
        return party.participants.includes(userId);
    }

    return Object.values(party.slots).includes(userId) || getMultipleSlots(party).some(function(slot) {
        return getMultipleSlotParticipants(party, slot.key).includes(userId);
    });
}

function isValidPartySlot(party, slotKey) {
    return Object.prototype.hasOwnProperty.call(party.slots, slotKey)
        || isMultiplePartySlot(party, slotKey)
        || isGroupedPartySlotSelection(party, slotKey);
}

function isMultiplePartySlot(party, slotKey) {
    return getMultipleSlots(party).some(function(slot) {
        return slot.key === slotKey;
    });
}

function isGroupedPartySlotSelection(party, groupKey) {
    return getGroupedSlots(party, groupKey).length > 0;
}

function getGroupedSlots(party, groupKey) {
    return getActDefinition(party).slots.filter(function(slot) {
        return slot.selectKey === groupKey && !slot.multiple;
    });
}

function getAvailableGroupedSlot(party, groupKey, userId) {
    return getGroupedSlots(party, groupKey).find(function(slot) {
        const participantId = party.slots[slot.key];

        return !participantId || participantId === userId;
    }) || null;
}

function getGroupedSlotDisplayLabel(party, groupKey) {
    const groupedSlot = getGroupedSlots(party, groupKey)[0];

    return groupedSlot?.displayLabel || groupedSlot?.label || '参加';
}

function compactAllGroupedSlots(party) {
    const groupKeys = new Set(getActDefinition(party).slots
        .filter(function(slot) {
            return Boolean(slot.selectKey) && !slot.multiple;
        })
        .map(function(slot) {
            return slot.selectKey;
        }));

    for (const groupKey of groupKeys) {
        compactGroupedSlots(party, groupKey);
    }
}

function compactGroupedSlots(party, groupKey) {
    const groupedSlots = getGroupedSlots(party, groupKey);
    const participants = groupedSlots
        .map(function(slot) {
            return party.slots[slot.key];
        })
        .filter(Boolean);

    groupedSlots.forEach(function(slot, index) {
        party.slots[slot.key] = participants[index] || null;
    });
}

function getMultipleSlots(party) {
    return getActDefinition(party).slots.filter(function(slot) {
        return slot.multiple;
    });
}

function buildSuccess(party) {
    return {
        ok: true,
        party: party,
        message: '',
        deferred: false
    };
}

function buildDeferredSuccess(party, message) {
    return {
        ok: true,
        party: party,
        message: message,
        deferred: true
    };
}

function buildFailure(message, party) {
    return {
        ok: false,
        party: party,
        message: message,
        deferred: false
    };
}
