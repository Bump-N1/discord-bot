import {
    FF14_ALL_ROLE_KEY,
    LOL_ANY_SLOT_KEY,
    OW_FLEX_SLOT_KEY,
    buildFf14AnyJobKey,
    getFf14Job,
    getFf14PartyType,
    getFf14Role
} from './act-definitions.js';

export const ACT_ASSIGNMENT_PREFERENCE = 'preference';

export function usesPreferenceComposition(party) {
    return party.assignmentMode === ACT_ASSIGNMENT_PREFERENCE && party.usesSlots;
}

export function getPreferenceDefinition(party) {
    if (party.game === 'lol') {
        return {
            flexibleKey: LOL_ANY_SLOT_KEY,
            choices: [
                buildChoice('top', 'トップ', '/assets/lol/lol_01_top.png', 'LOL_EMOJI_TOP'),
                buildChoice('jungle', 'ジャングル', '/assets/lol/lol_02_jg.png', 'LOL_EMOJI_JG'),
                buildChoice('middle', 'ミッド', '/assets/lol/lol_03_mid.png', 'LOL_EMOJI_MID'),
                buildChoice('bottom', 'ボット', '/assets/lol/lol_04_bot.png', 'LOL_EMOJI_ADC'),
                buildChoice('utility', 'サポート', '/assets/lol/lol_05_sup.png', 'LOL_EMOJI_SUP'),
                buildChoice(LOL_ANY_SLOT_KEY, 'どこでも', '/assets/lol/lol_06_any.png', 'LOL_EMOJI_ANY', true)
            ],
            targets: [
                buildTarget('top', 'トップ', ['top']),
                buildTarget('jungle', 'ジャングル', ['jungle']),
                buildTarget('middle', 'ミッド', ['middle']),
                buildTarget('bottom', 'ボット', ['bottom']),
                buildTarget('utility', 'サポート', ['utility'])
            ]
        };
    }

    if (party.game === 'ow') {
        return {
            flexibleKey: OW_FLEX_SLOT_KEY,
            choices: [
                buildChoice('tank', 'タンク', '/assets/ow/ow_01_tank.png', 'OW_EMOJI_TANK'),
                buildChoice('damage', 'ダメージ', '/assets/ow/ow_02_damage.png', 'OW_EMOJI_DAMAGE'),
                buildChoice('support', 'サポート', '/assets/ow/ow_03_support.png', 'OW_EMOJI_SUPPORT'),
                buildChoice(OW_FLEX_SLOT_KEY, 'すべて', '/assets/ow/ow_04_flex.png', 'OW_EMOJI_FLEX', true)
            ],
            targets: [
                buildTarget('tank', 'タンク', ['tank']),
                buildTarget('damage', 'ダメージ', ['damage1', 'damage2']),
                buildTarget('support', 'サポート', ['support1', 'support2'])
            ]
        };
    }

    if (party.game === 'ff14') {
        const partyType = getFf14PartyType(party.partyType);

        return {
            flexibleKey: FF14_ALL_ROLE_KEY,
            choices: [
                buildChoice('tank', 'タンク', '/assets/ff14/ff14_01_tank.png', 'FF14_EMOJI_TANK'),
                buildChoice('healer', 'ヒーラー', '/assets/ff14/ff14_02_healer.png', 'FF14_EMOJI_HEALER'),
                buildChoice('dps', 'DPS', '/assets/ff14/ff14_03_dps.png', 'FF14_EMOJI_DPS'),
                buildChoice(FF14_ALL_ROLE_KEY, 'なんでも可', '/assets/ff14/ff14_04_all.png', 'FF14_EMOJI_ALL', true)
            ],
            targets: [
                buildCapacityTarget('tank', 'タンク', partyType.capacities.tank),
                buildCapacityTarget('healer', 'ヒーラー', partyType.capacities.healer),
                buildCapacityTarget('dps', 'DPS', partyType.capacities.dps)
            ]
        };
    }

    return null;
}

export function normalizePreferenceInput(party, input) {
    const definition = getPreferenceDefinition(party);

    if (!definition) {
        return {
            ok: false,
            message: '希望を登録できない募集です。'
        };
    }

    const allowedChoices = new Set(definition.choices.map(function(choice) {
        return choice.key;
    }));
    const firstChoice = String(input.firstChoice || '');
    const fixed = Boolean(input.fixed) && firstChoice !== definition.flexibleKey;
    let secondChoice = fixed ? '' : String(input.secondChoice || '');

    if (!allowedChoices.has(firstChoice)) {
        return {
            ok: false,
            message: '第1希望を選択してください。'
        };
    }

    if (secondChoice === firstChoice || secondChoice === definition.flexibleKey) {
        secondChoice = '';
    }

    if (secondChoice && !allowedChoices.has(secondChoice)) {
        return {
            ok: false,
            message: '第2希望が正しくありません。'
        };
    }

    let jobKey = '';
    let secondJobKey = '';

    if (party.game === 'ff14' && firstChoice !== definition.flexibleKey) {
        const job = getFf14Job(input.jobKey || buildFf14AnyJobKey(firstChoice));

        if (!job || job.role !== firstChoice) {
            return {
                ok: false,
                message: '第1希望のロールに対応するジョブを選択してください。'
            };
        }

        jobKey = job.key;

        if (secondChoice) {
            const secondJob = getFf14Job(input.secondJobKey || buildFf14AnyJobKey(secondChoice));

            if (!secondJob || secondJob.role !== secondChoice) {
                return {
                    ok: false,
                    message: '第2希望のロールに対応するジョブを選択してください。'
                };
            }

            secondJobKey = secondJob.key;
        }
    }

    return {
        ok: true,
        preference: {
            firstChoice: firstChoice,
            secondChoice: secondChoice,
            fixed: fixed,
            jobKey: jobKey,
            secondJobKey: secondJobKey
        }
    };
}

export function applyPreferenceComposition(party, participants) {
    const definition = getPreferenceDefinition(party);

    if (!definition) {
        return {
            ok: false,
            message: '自動編成できない募集です。'
        };
    }

    const assignmentResult = findBestAssignment(definition, participants);

    if (!assignmentResult) {
        return {
            ok: false,
            message: '希望に合う空き枠がありません。第2希望またはどこでも可を指定してください。'
        };
    }

    const assignedParticipants = participants.map(function(participant) {
        return {
            ...participant,
            assignedRole: assignmentResult.assignments[participant.userId]
        };
    });

    party.preferenceParticipants = assignedParticipants;

    if (party.game === 'ff14') {
        party.ff14Participants = assignedParticipants.map(function(participant) {
            const assignedRole = participant.assignedRole;
            let jobKey = buildFf14AnyJobKey(assignedRole);

            if (assignedRole === participant.firstChoice && participant.jobKey) {
                jobKey = participant.jobKey;
            } else if (assignedRole === participant.secondChoice && participant.secondJobKey) {
                jobKey = participant.secondJobKey;
            }

            return {
                userId: participant.userId,
                role: assignedRole,
                jobKey: jobKey
            };
        });
    } else {
        applySlotAssignments(party, definition, assignedParticipants);
    }

    return {
        ok: true,
        party: party
    };
}

export function buildPreferencePublicData(party) {
    if (!usesPreferenceComposition(party)) {
        return null;
    }

    const definition = getPreferenceDefinition(party);

    return {
        choices: definition.choices,
        flexibleKey: definition.flexibleKey,
        targets: definition.targets.map(function(target) {
            return {
                key: target.key,
                label: target.label,
                capacity: target.capacity
            };
        }),
        jobsByRole: party.game === 'ff14'
            ? buildFf14JobsForWeb()
            : {},
        participants: party.preferenceParticipants || []
    };
}

function findBestAssignment(definition, participants) {
    const targets = definition.targets.reduce(function(targetMap, target) {
        targetMap[target.key] = target.capacity;
        return targetMap;
    }, {});
    const prioritizedParticipants = participants.slice().sort(function(left, right) {
        return Number(Boolean(right.fixed)) - Number(Boolean(left.fixed))
            || String(left.joinedAt || '').localeCompare(String(right.joinedAt || ''));
    });
    let bestResult = null;

    searchAssignment(0, prioritizedParticipants, definition, targets, {}, 0, function(result) {
        result.balance = buildAssignmentBalance(definition, result.assignments);
        result.stability = buildAssignmentStability(prioritizedParticipants, result.assignments);

        if (!bestResult || compareAssignmentResults(result, bestResult) > 0) {
            bestResult = result;
        }
    });

    return bestResult;
}

function compareAssignmentResults(left, right) {
    if (left.score !== right.score) {
        return left.score - right.score;
    }

    for (let index = 0; index < left.balance.length; index += 1) {
        if (left.balance[index] !== right.balance[index]) {
            return left.balance[index] - right.balance[index];
        }
    }

    return left.stability - right.stability;
}

function buildAssignmentBalance(definition, assignments) {
    const assignedCounts = {};

    for (const role of Object.values(assignments)) {
        assignedCounts[role] = (assignedCounts[role] || 0) + 1;
    }

    return definition.targets
        .map(function(target) {
            return (assignedCounts[target.key] || 0) / target.capacity;
        })
        .sort(function(left, right) {
            return left - right;
        });
}

function buildAssignmentStability(participants, assignments) {
    return participants.filter(function(participant) {
        return participant.assignedRole && participant.assignedRole === assignments[participant.userId];
    }).length;
}

function searchAssignment(index, participants, definition, remaining, assignments, score, onComplete) {
    if (index >= participants.length) {
        onComplete({
            assignments: {
                ...assignments
            },
            score: score
        });
        return;
    }

    const participant = participants[index];
    const roles = getCandidateRoles(definition, participant);

    for (const role of roles) {
        if ((remaining[role] || 0) <= 0) {
            continue;
        }

        remaining[role] -= 1;
        assignments[participant.userId] = role;
        searchAssignment(
            index + 1,
            participants,
            definition,
            remaining,
            assignments,
            score + getPreferenceScore(participant, role, participants.length - index),
            onComplete
        );
        remaining[role] += 1;
        delete assignments[participant.userId];
    }
}

function getCandidateRoles(definition, participant) {
    const targetKeys = definition.targets.map(function(target) {
        return target.key;
    });

    if (participant.firstChoice === definition.flexibleKey) {
        return targetKeys;
    }

    if (participant.fixed) {
        return [
            participant.firstChoice
        ];
    }

    return [
        participant.firstChoice,
        participant.secondChoice
    ].filter(function(role, index, roles) {
        return targetKeys.includes(role) && roles.indexOf(role) === index;
    });
}

function getPreferenceScore(participant, role, priority) {
    if (participant.firstChoice === role) {
        return 100000 + priority;
    }

    if (participant.secondChoice === role) {
        return 1000 + priority;
    }

    return 1;
}

function applySlotAssignments(party, definition, participants) {
    for (const slotKey of Object.keys(party.slots || {})) {
        party.slots[slotKey] = null;
    }

    for (const slotKey of Object.keys(party.multiParticipants || {})) {
        party.multiParticipants[slotKey] = [];
    }

    for (const target of definition.targets) {
        const assignedToRole = participants
            .filter(function(participant) {
                return participant.assignedRole === target.key;
            })
            .sort(compareJoinOrder);

        target.slotKeys.forEach(function(slotKey, index) {
            party.slots[slotKey] = assignedToRole[index]?.userId || null;
        });
    }
}

function compareJoinOrder(left, right) {
    return String(left.joinedAt || '').localeCompare(String(right.joinedAt || ''));
}

function buildFf14JobsForWeb() {
    const jobs = {};

    for (const roleKey of ['tank', 'healer', 'dps']) {
        const role = getFf14Role(roleKey);
        jobs[roleKey] = [
            {
                key: role.anyJobKey,
                label: 'ジョブ指定無し',
                asset: getFf14RoleAsset(roleKey)
            },
            ...getFf14Jobs(roleKey)
        ];
    }

    return jobs;
}

function getFf14Jobs(roleKey) {
    const assets = {
        paladin: 'ff14_05_paladin',
        warrior: 'ff14_06_warrior',
        dark_knight: 'ff14_07_dark_knight',
        gunbreaker: 'ff14_08_gunbreaker',
        white_mage: 'ff14_09_white_mage',
        scholar: 'ff14_10_scholar',
        astrologian: 'ff14_11_astrologian',
        sage: 'ff14_12_sage',
        monk: 'ff14_13_monk',
        dragoon: 'ff14_14_dragoon',
        ninja: 'ff14_15_ninja',
        samurai: 'ff14_16_samurai',
        reaper: 'ff14_17_reaper',
        viper: 'ff14_18_viper',
        bard: 'ff14_19_bard',
        machinist: 'ff14_20_machinist',
        dancer: 'ff14_21_dancer',
        black_mage: 'ff14_22_black_mage',
        summoner: 'ff14_23_summoner',
        red_mage: 'ff14_24_red_mage',
        pictomancer: 'ff14_25_pictomancer'
    };

    return Object.keys(assets).map(function(jobKey) {
        const job = getFf14Job(jobKey);

        if (!job || job.role !== roleKey) {
            return null;
        }

        return {
            key: job.key,
            label: job.label,
            asset: `/assets/ff14/${assets[jobKey]}.png`
        };
    }).filter(Boolean);
}

function getFf14RoleAsset(roleKey) {
    const assetNames = {
        tank: 'ff14_01_tank',
        healer: 'ff14_02_healer',
        dps: 'ff14_03_dps'
    };

    return `/assets/ff14/${assetNames[roleKey]}.png`;
}

function buildChoice(key, label, asset, emojiEnv, flexible = false) {
    return {
        key: key,
        label: label,
        asset: asset,
        emojiEnv: emojiEnv,
        flexible: flexible
    };
}

function buildTarget(key, label, slotKeys) {
    return {
        key: key,
        label: label,
        capacity: slotKeys.length,
        slotKeys: slotKeys
    };
}

function buildCapacityTarget(key, label, capacity) {
    return {
        key: key,
        label: label,
        capacity: capacity,
        slotKeys: []
    };
}
