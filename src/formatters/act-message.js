import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import {
    CLOSED_ACT_REOPEN_VISIBLE_MS,
    FF14_ALL_ROLE_KEY,
    FF14_ROLE_OPTIONS,
    ACT_COMPONENT_PREFIX,
    ACT_STATUS_CLOSED,
    getFf14Job,
    getFf14JobsByRole,
    getFf14PartyType,
    getFf14Role,
    getMultipleSlotParticipants,
    getActDefinition,
    usesFf14RoleSlots
} from '../services/act/act-definitions.js';
import { getPreferenceDefinition, usesPreferenceComposition } from '../services/act/act-composition.js';
import { resolveEmojiComponent, resolveEmojiText } from '../utils/discord-emoji.js';

const EMPTY_TEXT = '\u200B';

export async function buildActMessage(party, guild) {
    return {
        embeds: [
            await buildPartyEmbed(party, guild)
        ],
        components: await buildPartyComponents(party, guild)
    };
}

export async function buildFf14SelectionPrompt(party, guild, selection = {}) {
    const role = getFf14Role(selection.roleKey);
    const selectedJobKey = selection.jobKey || '';

    const components = [
        await buildFf14RoleSelectRow(party, guild, selection.roleKey)
    ];

    if (role && role.key !== FF14_ALL_ROLE_KEY) {
        components.push(await buildFf14JobSelectRow(party, guild, role, selectedJobKey));
    }

    components.push(buildFf14PromptButtonRow(party, !canConfirmFf14Prompt(role, selectedJobKey)));

    return {
        content: role ? `${role.label}を選択中` : '参加内容を選択',
        components: components,
        ephemeral: true
    };
}

function canConfirmFf14Prompt(role, selectedJobKey) {
    if (!role) {
        return false;
    }

    return role.key === FF14_ALL_ROLE_KEY || Boolean(selectedJobKey);
}

async function buildPartyEmbed(party, guild) {
    const definition = getActDefinition(party);
    const embed = new EmbedBuilder()
        .setTitle(await buildTitle(definition, party, guild))
        .setDescription(await buildDescription(party, definition, guild))
        .setColor(definition.color)
        .setTimestamp();

    if (definition.ff14) {
        embed.addFields(await buildFf14Fields(party, guild));
    } else if (!party.usesSlots) {
        embed.addFields({
            name: definition.listFieldName,
            value: buildParticipantLines(party),
            inline: false
        });
    }

    return embed;
}

async function buildDescription(party, definition, guild) {
    if (definition.ff14) {
        return await buildFf14Description(party, guild);
    }

    const lines = [
        `日時: ${party.datetime}`
    ];
    const details = party.details || party.note || '';

    if (details) {
        lines.push(`詳細: ${details}`);
    }

    if (party.usesSlots) {
        lines.push('');
        lines.push(await buildSlotLines(party, definition, guild));
    }

    return lines.join('\n');
}

async function buildFf14Description(party, guild) {
    const lines = [
        `日時: ${party.datetime}`
    ];
    const details = party.details || party.note || '';

    if (details) {
        lines.push(`詳細: ${details}`);
    }

    return lines.join('\n');
}

async function buildSlotLines(party, definition, guild) {
    const lines = [];
    const slots = usesPreferenceComposition(party)
        ? definition.slots.filter(function(slot) {
            return !slot.multiple;
        })
        : definition.slots;
    const fallbackLabelWidth = getFallbackLabelWidth(slots);

    for (const slot of slots) {
        if (slot.multiple && lines.length > 0) {
            lines.push('');
        }

        const displayLabel = getSlotDisplayLabel(slot);
        const label = await resolveEmojiText(guild, slot.emojiEnv, displayLabel);
        const participantText = slot.multiple
            ? formatParticipants(getMultipleSlotParticipants(party, slot.key))
            : await formatAssignedParticipant(party, party.slots[slot.key], guild);

        lines.push(`${formatSlotLabel(label, displayLabel, fallbackLabelWidth)} ${participantText}`);
    }

    return lines.join('\n');
}

async function buildFf14Fields(party, guild) {
    if (!usesFf14RoleSlots(party)) {
        return await buildFf14FreeFields(party, guild);
    }

    const partyType = getFf14PartyType(party.partyType);
    const fields = [];
    const columns = await buildFf14CompositionColumns(party, guild);

    if (partyType.maxParticipants === 8) {
        fields.push({
            name: EMPTY_TEXT,
            value: columns[0].join('\n') || EMPTY_TEXT,
            inline: true
        });
        fields.push({
            name: EMPTY_TEXT,
            value: columns[1].join('\n') || EMPTY_TEXT,
            inline: true
        });
    } else {
        fields.push({
            name: EMPTY_TEXT,
            value: columns[0].join('\n') || EMPTY_TEXT,
            inline: false
        });
    }

    if (!usesPreferenceComposition(party)) {
        const allLines = await buildFf14AllLines(party, guild);

        fields.push({
            name: EMPTY_TEXT,
            value: allLines.join('\n') || EMPTY_TEXT,
            inline: false
        });
    }

    return fields;
}

async function buildFf14CompositionColumns(party, guild) {
    const partyType = getFf14PartyType(party.partyType);
    const labelWidth = getFf14FallbackLabelWidth();
    const participantsByRole = {
        tank: getSortedFf14Participants(party, 'tank'),
        healer: getSortedFf14Participants(party, 'healer'),
        dps: getSortedFf14Participants(party, 'dps')
    };
    const roleIndexes = {
        tank: 0,
        healer: 0,
        dps: 0
    };
    const layout = partyType.maxParticipants === 8
        ? [
            ['tank', 'tank'],
            ['healer', 'healer'],
            ['dps', 'dps'],
            ['dps', 'dps']
        ]
        : [
            ['tank'],
            ['healer'],
            ['dps'],
            ['dps']
        ];
    const columns = partyType.maxParticipants === 8 ? [[], []] : [[]];

    for (const row of layout) {
        for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
            const roleKey = row[columnIndex];
            const role = getFf14Role(roleKey);
            const participant = participantsByRole[roleKey][roleIndexes[roleKey]];

            roleIndexes[roleKey] += 1;
            columns[columnIndex].push(await formatFf14ParticipantLine(party, participant, role, guild, labelWidth));
        }
    }

    return columns;
}

async function buildFf14FreeFields(party, guild) {
    const partyType = getFf14PartyType(party.partyType);
    const labelWidth = getFf14FallbackLabelWidth();
    const participants = getSortedFf14FreeParticipants(party);

    if (participants.length === 0) {
        return [
            {
                name: '参加者',
                value: EMPTY_TEXT,
                inline: false
            }
        ];
    }

    const lines = [];

    for (const participant of participants) {
        lines.push(await formatFf14ParticipantLine(party, participant, getFf14Role(participant.role), guild, labelWidth));
    }

    if (partyType.maxParticipants !== 8) {
        return [
            {
                name: '参加者',
                value: lines.join('\n'),
                inline: false
            }
        ];
    }

    const columns = [
        [],
        []
    ];

    lines.forEach(function(line, index) {
        columns[index % 2].push(line);
    });

    return [
        {
            name: '参加者',
            value: columns[0].join('\n') || EMPTY_TEXT,
            inline: true
        },
        {
            name: EMPTY_TEXT,
            value: columns[1].join('\n') || EMPTY_TEXT,
            inline: true
        }
    ];
}

function getSortedFf14FreeParticipants(party) {
    return (party.ff14Participants || []).slice().sort(function(left, right) {
        return getFf14RoleSortOrder(left) - getFf14RoleSortOrder(right)
            || getFf14SortOrder(left) - getFf14SortOrder(right);
    });
}

function getFf14RoleSortOrder(participant) {
    return getFf14Role(participant.role)?.sortOrder || 999;
}

async function buildFf14AllLines(party, guild) {
    const labelWidth = getFf14FallbackLabelWidth();
    const allRole = getFf14Role(FF14_ALL_ROLE_KEY);
    const allParticipants = getSortedFf14Participants(party, FF14_ALL_ROLE_KEY);

    if (allParticipants.length === 0) {
        return [
            await formatFf14ParticipantLine(party, null, allRole, guild, labelWidth)
        ];
    }

    const label = await resolveEmojiText(guild, allRole.emojiEnv, allRole.label);
    const participantText = formatParticipants(allParticipants.map(function(participant) {
        return participant.userId;
    }));

    return [
        `${formatSlotLabel(label, allRole.label, labelWidth)} ${participantText}`
    ];
}

async function formatFf14ParticipantLine(party, participant, fallbackRole, guild, labelWidth) {
    const display = participant
        ? getFf14Job(participant.jobKey)
        : fallbackRole;
    const fallbackLabel = display?.label || fallbackRole.label;
    const label = await resolveEmojiText(guild, display?.emojiEnv || fallbackRole.emojiEnv, fallbackLabel);
    const participantText = participant ? await formatAssignedParticipant(party, participant.userId, guild) : EMPTY_TEXT;

    return `${formatSlotLabel(label, fallbackLabel, labelWidth)} ${participantText}`;
}

function getSortedFf14Participants(party, roleKey) {
    return (party.ff14Participants || [])
        .filter(function(participant) {
            return participant.role === roleKey;
        })
        .sort(function(left, right) {
            return getFf14SortOrder(left) - getFf14SortOrder(right);
        });
}

function getFf14SortOrder(participant) {
    return getFf14Job(participant.jobKey)?.sortOrder || 999;
}

function buildParticipantLines(party) {
    if (party.participants.length === 0) {
        return EMPTY_TEXT;
    }

    return party.participants.map(function(participantId) {
        return formatParticipant(participantId);
    }).join('\n');
}

function formatSlotLabel(label, fallbackLabel, fallbackLabelWidth) {
    if (label !== fallbackLabel) {
        return label;
    }

    return `\`${padDisplayText(label, fallbackLabelWidth)}\``;
}

function formatParticipant(userId) {
    return userId ? `<@${userId}>` : EMPTY_TEXT;
}

async function formatAssignedParticipant(party, userId, guild) {
    if (!userId) {
        return EMPTY_TEXT;
    }

    return `${formatParticipant(userId)}${await buildPreferenceAnnotation(party, userId, guild)}`;
}

async function buildPreferenceAnnotation(party, userId, guild) {
    if (!usesPreferenceComposition(party)) {
        return '';
    }

    const participant = (party.preferenceParticipants || []).find(function(candidate) {
        return candidate.userId === userId;
    });
    const definition = getPreferenceDefinition(party);

    if (!participant || !definition) {
        return '';
    }

    if (participant.firstChoice === definition.flexibleKey) {
        const flexibleChoice = definition.choices.find(function(choice) {
            return choice.key === definition.flexibleKey;
        });

        if (!flexibleChoice) {
            return '';
        }

        const flexibleEmoji = await resolveEmojiText(guild, flexibleChoice.emojiEnv, flexibleChoice.label);

        return ` ${flexibleEmoji}`;
    }

    if (participant.secondChoice && participant.assignedRole === participant.secondChoice) {
        return '（第2希望）';
    }

    return '';
}

function formatParticipants(userIds) {
    if (userIds.length === 0) {
        return EMPTY_TEXT;
    }

    return userIds.map(function(userId) {
        return `<@${userId}>`;
    }).join(' ');
}

function getSlotDisplayLabel(slot) {
    return slot.displayLabel || slot.label;
}

function getSlotSelectValue(slot) {
    return slot.selectKey || slot.key;
}

async function buildTitle(definition, party, guild) {
    const emoji = await resolveEmojiText(guild, definition.titleEmojiEnv, '');
    const modeLabel = getModeDisplayLabel(definition, party.mode);
    const title = emoji
        ? `${emoji}  ${modeLabel}`
        : `${definition.titlePrefix} ${modeLabel}`;

    if (party.status === ACT_STATUS_CLOSED) {
        return `${title}（締切）`;
    }

    return title;
}

function getFallbackLabelWidth(slots) {
    return slots.reduce(function(maxLength, slot) {
        return Math.max(maxLength, getDisplayWidth(getSlotDisplayLabel(slot)));
    }, 0);
}

function getFf14FallbackLabelWidth() {
    const labels = [
        ...FF14_ROLE_OPTIONS.map(function(role) {
            return role.label;
        }),
        ...FF14_ROLE_OPTIONS.flatMap(function(role) {
            return getFf14JobsByRole(role.key).map(function(job) {
                return job.label;
            });
        })
    ];

    return labels.reduce(function(maxLength, label) {
        return Math.max(maxLength, getDisplayWidth(label));
    }, 0);
}

function getModeDisplayLabel(definition, mode) {
    return definition.modeLabels?.[mode] || mode;
}

function padDisplayText(text, targetWidth) {
    const value = String(text || '');
    const padding = Math.max(targetWidth - getDisplayWidth(value), 0);

    return value + ' '.repeat(padding);
}

function getDisplayWidth(text) {
    return Array.from(String(text || '')).reduce(function(width, character) {
        return width + getCharacterWidth(character);
    }, 0);
}

function getCharacterWidth(character) {
    return /[^\u0000-\u00ff]/.test(character) ? 2 : 1;
}

async function buildPartyComponents(party, guild) {
    if (party.webManaged) {
        return [
            buildWebButtonRow(party)
        ];
    }

    if (party.status === ACT_STATUS_CLOSED) {
        return buildClosedComponents(party);
    }

    const definition = getActDefinition(party);

    if (definition.ff14) {
        return await buildFf14Components(party, guild);
    }

    if (party.usesSlots) {
        return [
            await buildSlotSelectRow(party, guild),
            buildSlotButtonRow(party)
        ];
    }

    return [
        buildListButtonRow(party)
    ];
}

function buildWebButtonRow(party) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:open-web:${party.id}`)
            .setLabel(party.status === ACT_STATUS_CLOSED ? '募集を確認' : '参加・編集')
            .setStyle(ButtonStyle.Primary)
    );
}

async function buildSlotSelectRow(party, guild) {
    const definition = getActDefinition(party);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`${ACT_COMPONENT_PREFIX}:select-slot:${party.id}`)
        .setPlaceholder(definition.joinPlaceholder);
    const options = [];
    const optionKeys = new Set();

    for (const slot of definition.slots) {
        const optionValue = getSlotSelectValue(slot);

        if (optionKeys.has(optionValue)) {
            continue;
        }

        optionKeys.add(optionValue);

        const option = new StringSelectMenuOptionBuilder()
            .setLabel(getSlotDisplayLabel(slot))
            .setValue(optionValue);
        const emoji = await resolveEmojiComponent(guild, slot.emojiEnv);

        if (emoji) {
            option.setEmoji(emoji);
        }

        options.push(option);
    }

    menu.addOptions(options);

    return new ActionRowBuilder().addComponents(menu);
}

function buildClosedComponents(party) {
    if (!shouldShowReopenButton(party)) {
        return [];
    }

    return [
        buildReopenButtonRow(party)
    ];
}

function shouldShowReopenButton(party) {
    if (party.autoClosedAt) {
        return false;
    }

    const closedAt = Date.parse(party.closedAt || party.updatedAt || party.createdAt || '');

    if (Number.isNaN(closedAt)) {
        return true;
    }

    return Date.now() - closedAt < CLOSED_ACT_REOPEN_VISIBLE_MS;
}

async function buildFf14Components(party, guild) {
    return [
        buildFf14PublicButtonRow(party)
    ];
}

async function buildFf14RoleSelectRow(party, guild, selectedRoleKey = '') {
    const definition = getActDefinition(party);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`${ACT_COMPONENT_PREFIX}:select-ff14-role:${party.id}`)
        .setPlaceholder(definition.joinPlaceholder);
    const options = [];

    for (const role of FF14_ROLE_OPTIONS) {
        const option = new StringSelectMenuOptionBuilder()
            .setLabel(role.label)
            .setValue(role.key);
        const emoji = await resolveEmojiComponent(guild, role.emojiEnv);

        if (selectedRoleKey === role.key) {
            option.setDefault(true);
        }

        if (emoji) {
            option.setEmoji(emoji);
        }

        options.push(option);
    }

    menu.addOptions(options);

    return new ActionRowBuilder().addComponents(menu);
}

async function buildFf14JobSelectRow(party, guild, role, selectedJobKey = '') {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`${ACT_COMPONENT_PREFIX}:select-ff14-job:${party.id}:${role.key}`)
        .setPlaceholder(`${role.label}のジョブを選択`);

    const options = [];

    for (const job of getFf14JobsByRole(role.key)) {
        options.push(await buildFf14JobOption(guild, job, selectedJobKey));
    }

    options.push(await buildFf14JobOption(guild, {
        key: role.anyJobKey,
        label: 'ジョブ指定無し',
        emojiEnv: role.emojiEnv
    }, selectedJobKey));

    menu.addOptions(options);

    return new ActionRowBuilder().addComponents(menu);
}

async function buildFf14JobOption(guild, job, selectedJobKey = '') {
    const option = new StringSelectMenuOptionBuilder()
        .setLabel(job.label)
        .setValue(job.key);
    const emoji = await resolveEmojiComponent(guild, job.emojiEnv);

    if (selectedJobKey === job.key) {
        option.setDefault(true);
    }

    if (emoji) {
        option.setEmoji(emoji);
    }

    return option;
}

function buildSlotButtonRow(party) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:join-slot:${party.id}`)
            .setLabel('参加')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:edit:${party.id}`)
            .setLabel('編集')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:leave:${party.id}`)
            .setLabel('抜ける')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:close:${party.id}`)
            .setLabel('締め切る')
            .setStyle(ButtonStyle.Danger)
    );
}
function buildFf14PublicButtonRow(party) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:start-ff14-join:${party.id}`)
            .setLabel('参加')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:edit:${party.id}`)
            .setLabel('編集')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:leave:${party.id}`)
            .setLabel('抜ける')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:close:${party.id}`)
            .setLabel('締め切る')
            .setStyle(ButtonStyle.Danger)
    );
}
function buildFf14PromptButtonRow(party, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:join-slot:${party.id}`)
            .setLabel('参加')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );
}

function buildReopenButtonRow(party) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:reopen:${party.id}`)
            .setLabel('締め切り解除')
            .setStyle(ButtonStyle.Success)
    );
}

function buildListButtonRow(party) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:join-list:${party.id}`)
            .setLabel('参加')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:edit:${party.id}`)
            .setLabel('編集')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:leave:${party.id}`)
            .setLabel('抜ける')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`${ACT_COMPONENT_PREFIX}:close:${party.id}`)
            .setLabel('締め切る')
            .setStyle(ButtonStyle.Danger)
    );
}
