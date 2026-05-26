import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { buildFf14SelectionPrompt, buildActMessage } from '../formatters/act-message.js';
import {
    closeAct,
    confirmActSlot,
    createFf14Act,
    createLolAct,
    createOwAct,
    getActById,
    joinActList,
    leaveAct,
    reopenAct,
    selectFf14Job,
    selectFf14Role,
    selectActSlot,
    setActMessageId,
    updateActEditableFields
} from '../services/act/act-service.js';
import {
    ACT_COMPONENT_PREFIX,
    CLOSED_ACT_REOPEN_VISIBLE_MS,
    ACT_STATUS_CLOSED
} from '../services/act/act-definitions.js';
import {
    formatActDateTimeInputFromScheduledAt,
    formatDefaultActDateTimeInput,
    parseActDateTime
} from '../services/act/act-datetime.js';
import {
    buildActCreateUrl,
    buildActManageUrl,
    isActWebConfigured
} from '../services/act/act-web-auth.js';

const actMessageUpdateQueues = new Map();
const actCreateDrafts = new Map();
const ACT_CREATE_DRAFT_TTL_MS = 15 * 60 * 1000;

export const lolActCommand = new SlashCommandBuilder()
    .setName('act-lol')
    .setDescription('LoLの募集を作成します')
    .addStringOption(function(option) {
        return option
            .setName('mode')
            .setDescription('ゲームモードを選択')
            .setRequired(true)
            .addChoices(
                {
                    name: 'Normal',
                    value: 'Normal'
                },
                {
                    name: 'Flex',
                    value: 'Flex'
                },
                {
                    name: 'ARAM',
                    value: 'ARAM'
                }
            );
    });

export const owActCommand = new SlashCommandBuilder()
    .setName('act-ow')
    .setDescription('OWの募集を作成します')
    .addStringOption(function(option) {
        return option
            .setName('mode')
            .setDescription('ゲームモードを選択')
            .setRequired(true)
            .addChoices(
                {
                    name: 'Quick',
                    value: 'Quick'
                },
                {
                    name: 'Rival',
                    value: 'Rival'
                },
                {
                    name: 'Stadium',
                    value: 'Stadium'
                }
            );
    });

export const ff14ActCommand = new SlashCommandBuilder()
    .setName('act-ff14')
    .setDescription('FF14の募集を作成します')
    .addStringOption(function(option) {
        return option
            .setName('mode')
            .setDescription('コンテンツ人数を選択（LIGHT PARTY / FULL PARTY）')
            .setRequired(true)
            .addChoices(
                {
                    name: 'LIGHT PARTY',
                    value: 'LIGHT PARTY'
                },
                {
                    name: 'FULL PARTY',
                    value: 'FULL PARTY'
                }
            );
    });

export async function handleActCommand(interaction) {
    try {
        if (isActWebConfigured()) {
            await showActWebCreateLink(interaction);
            return;
        }

        await showActCreateModal(interaction);
    } catch (error) {
        await interaction.reply({
            content: `募集の作成に失敗しました。\n${error.message}`
        });
    }
}

async function showActWebCreateLink(interaction) {
    const draft = createActDraftFromInteraction(interaction);
    const url = buildActCreateUrl({
        ...draft,
        displayName: getInteractionDisplayName(interaction)
    });

    await interaction.reply({
        content: '募集内容の入力と編成はWeb画面で行います。',
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('募集を作成')
                    .setStyle(ButtonStyle.Link)
                    .setURL(url)
            )
        ],
        ephemeral: true
    });
}

async function showActCreateModal(interaction) {
    cleanupExpiredActCreateDrafts();

    const draft = createActDraftFromInteraction(interaction);
    actCreateDrafts.set(interaction.id, draft);

    const modal = new ModalBuilder()
        .setCustomId(`${ACT_COMPONENT_PREFIX}:create-submit:${interaction.id}`)
        .setTitle('募集を作成');

    if (interaction.commandName === 'act-ff14') {
        modal.addComponents(buildTextInputRow(
            new TextInputBuilder()
                .setCustomId('content')
                .setLabel('コンテンツ名')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
                .setPlaceholder('コンテンツ名')
        ));
    }

    modal.addComponents(
        buildTextInputRow(
            new TextInputBuilder()
                .setCustomId('datetime')
                .setLabel('開始日時（MM/DD HH:mm）')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
                .setValue(formatDefaultActDateTimeInput())
                .setPlaceholder('MM/DD HH:mm')
        ),
        buildTextInputRow(
            new TextInputBuilder()
                .setCustomId('details')
                .setLabel('募集内容')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000)
                .setPlaceholder('募集内容')
        )
    );

    await interaction.showModal(modal);
}

function createActDraftFromInteraction(interaction) {
    const draft = {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        createdAt: Date.now()
    };

    if (interaction.commandName === 'act-ff14') {
        return {
            ...draft,
            partyType: interaction.options.getString('mode'),
            ff14RoleSelection: 'ON'
        };
    }

    return {
        ...draft,
        mode: interaction.options.getString('mode')
    };
}

async function createActFromDraft(draft, interaction) {
    const commonOptions = {
        datetime: interaction.fields.getTextInputValue('datetime'),
        details: interaction.fields.getTextInputValue('details'),
        creatorId: interaction.user.id,
        guildId: draft.guildId || interaction.guildId,
        channelId: draft.channelId || interaction.channelId
    };

    if (draft.commandName === 'act-ow') {
        return await createOwAct({
            ...commonOptions,
            mode: draft.mode
        });
    }

    if (draft.commandName === 'act-ff14') {
        return await createFf14Act({
            ...commonOptions,
            partyType: draft.partyType,
            ff14RoleSelection: draft.ff14RoleSelection,
            contentName: interaction.fields.getTextInputValue('content')
        });
    }

    return await createLolAct({
        ...commonOptions,
        mode: draft.mode
    });
}

export async function handleActComponent(interaction) {
    if (!String(interaction.customId || '').startsWith(`${ACT_COMPONENT_PREFIX}:`)) {
        return false;
    }

    try {
        const parts = interaction.customId.split(':');
        const action = parts[1];
        const partyId = parts[2];

        if (action === 'open-web') {
            await showActWebManageLink(interaction, partyId);
            return true;
        }

        if (action === 'edit') {
            await showPartyEditModal(interaction, partyId);
            return true;
        }

        if (action === 'start-ff14-join') {
            await handleFf14JoinStart(interaction, partyId);
            return true;
        }

        if (action === 'select-ff14-role') {
            await handleFf14RoleSelect(interaction, partyId);
            return true;
        }

        if (action === 'select-ff14-job') {
            await handleFf14JobSelect(interaction, partyId);
            return true;
        }

        const result = await handleActComponentAction(interaction);

        if (result.deferred) {
            await interaction.deferUpdate();
            return true;
        }

        if (!result.ok) {
            if (action === 'reopen' && result.party) {
                await interaction.deferUpdate();
                await queuePartyMessageEdit(interaction.client, result.party.id);
                await interaction.followUp({
                    content: result.message,
                    ephemeral: true
                });
                return true;
            }

            await interaction.reply({
                content: result.message,
                ephemeral: true
            });
            return true;
        }

        await updateActMessageFromInteraction(interaction, result.party);

        if (action === 'close') {
            scheduleClosedPartyControlsRefresh(result.party, interaction.client);
        }

        return true;
    } catch (error) {
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({
                content: `募集の更新に失敗しました。\n${error.message}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: `募集の更新に失敗しました。\n${error.message}`,
                ephemeral: true
            });
        }

        return true;
    }
}

async function showActWebManageLink(interaction, partyId) {
    const party = await getActById(partyId);

    if (!party?.webManaged) {
        await interaction.reply({
            content: '募集が見つかりません。',
            ephemeral: true
        });
        return;
    }

    const url = buildActManageUrl({
        partyId: party.id,
        userId: interaction.user.id,
        displayName: getInteractionDisplayName(interaction)
    });

    await interaction.reply({
        content: 'Web画面で参加内容の登録や変更を行えます。',
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('募集を開く')
                    .setStyle(ButtonStyle.Link)
                    .setURL(url)
            )
        ],
        ephemeral: true
    });
}

async function handleFf14JoinStart(interaction, partyId) {
    const party = await getActById(partyId);

    if (!party) {
        await interaction.reply({
            content: '募集が見つかりません。',
            ephemeral: true
        });
        return;
    }

    if (party.status === ACT_STATUS_CLOSED) {
        await interaction.reply({
            content: 'この募集は締め切られています。',
            ephemeral: true
        });
        return;
    }

    const selection = party.pendingFf14Selections?.[interaction.user.id] || {};

    await interaction.reply(await buildFf14SelectionPrompt(party, interaction.guild, {
        roleKey: selection.role,
        jobKey: selection.jobKey
    }));
}

async function handleFf14RoleSelect(interaction, partyId) {
    const roleKey = interaction.values[0];
    const result = await selectFf14Role(partyId, roleKey, interaction.user.id);

    if (!result.ok) {
        await interaction.reply({
            content: result.message,
            ephemeral: true
        });
        return;
    }

    await respondWithFf14SelectionPrompt(interaction, result.party, {
        roleKey: roleKey
    });
}

async function handleFf14JobSelect(interaction, partyId) {
    const result = await selectFf14Job(partyId, interaction.values[0], interaction.user.id);

    if (!result.ok) {
        await interaction.reply({
            content: result.message,
            ephemeral: true
        });
        return;
    }

    const selection = result.party.pendingFf14Selections?.[interaction.user.id] || {};

    await interaction.update(toMessageUpdate(await buildFf14SelectionPrompt(result.party, interaction.guild, {
        roleKey: selection.role,
        jobKey: selection.jobKey
    })));
}

async function respondWithFf14SelectionPrompt(interaction, party, selection) {
    const messageBody = await buildFf14SelectionPrompt(party, interaction.guild, selection);

    if (interaction.message?.id === party.messageId) {
        await interaction.reply(messageBody);
        return;
    }

    await interaction.update(toMessageUpdate(messageBody));
}

function toMessageUpdate(messageBody) {
    const {
        ephemeral,
        ...updateBody
    } = messageBody;

    return updateBody;
}

async function updateActMessageFromInteraction(interaction, party) {
    if (interaction.message?.id === party.messageId) {
        await interaction.deferUpdate();
        await queuePartyMessageEdit(interaction.client, party.id);
        return;
    }

    await interaction.deferUpdate();
    await queuePartyMessageEdit(interaction.client, party.id);
    await clearInteractionMessage(interaction);
}

async function clearInteractionMessage(interaction) {
    try {
        await interaction.deleteReply();
    } catch (deleteError) {
        try {
            await interaction.editReply({
                content: '\u200B',
                embeds: [],
                components: []
            });
        } catch (editError) {
            console.error('Failed to clear interaction message:', editError);
        }
    }
}

async function queuePartyMessageEdit(client, partyId) {
    const previousUpdate = actMessageUpdateQueues.get(partyId) || Promise.resolve();
    const nextUpdate = previousUpdate.catch(function() {
        return null;
    }).then(async function() {
        const latestParty = await getActById(partyId);

        if (!latestParty?.channelId || !latestParty.messageId) {
            return latestParty;
        }

        const channel = await client.channels.fetch(latestParty.channelId);
        const message = await channel.messages.fetch(latestParty.messageId);

        await message.edit(await buildActMessage(latestParty, message.guild));

        return latestParty;
    });

    actMessageUpdateQueues.set(partyId, nextUpdate);
    nextUpdate.finally(function() {
        if (actMessageUpdateQueues.get(partyId) === nextUpdate) {
            actMessageUpdateQueues.delete(partyId);
        }
    }).catch(function() {
        return null;
    });

    return await nextUpdate;
}

export async function handleActModalSubmit(interaction) {
    if (!String(interaction.customId || '').startsWith(`${ACT_COMPONENT_PREFIX}:`)) {
        return false;
    }

    try {
        const parts = interaction.customId.split(':');

        if (parts[1] === 'create-submit') {
            await handleActCreateModalSubmit(interaction, parts[2]);
            return true;
        }

        if (parts[1] !== 'edit-submit') {
            return false;
        }

        const partyId = parts[2];
        const fields = {
            datetime: interaction.fields.getTextInputValue('datetime'),
            details: interaction.fields.getTextInputValue('details')
        };

        if (hasTextInput(interaction, 'content')) {
            fields.contentName = interaction.fields.getTextInputValue('content');
        }

        const result = await updateActEditableFields(partyId, interaction.user.id, fields);

        if (!result.ok) {
            await interaction.reply({
                content: result.message,
                ephemeral: true
            });
            return true;
        }

        await interaction.deferUpdate();
        await queuePartyMessageEdit(interaction.client, result.party.id);
        return true;
    } catch (error) {
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({
                content: `募集の編集に失敗しました。\n${error.message}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: `募集の編集に失敗しました。\n${error.message}`,
                ephemeral: true
            });
        }

        return true;
    }
}

async function handleActCreateModalSubmit(interaction, draftId) {
    cleanupExpiredActCreateDrafts();

    const draft = actCreateDrafts.get(draftId);
    actCreateDrafts.delete(draftId);

    if (!draft || draft.userId !== interaction.user.id) {
        await interaction.reply({
            content: '募集の作成情報が見つかりません。もう一度コマンドを実行してください。',
            ephemeral: true
        });
        return;
    }

    const validationError = validateActDateTimeInput(interaction.fields.getTextInputValue('datetime'));

    if (validationError) {
        await interaction.reply({
            content: validationError,
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply();

    try {
        const party = await createActFromDraft(draft, interaction);
        const messageBody = await buildActMessage(party, interaction.guild);
        const message = await interaction.editReply(messageBody);

        await setActMessageId(party.id, message.id);
    } catch (error) {
        await interaction.editReply({
            content: `募集の作成に失敗しました。\n${error.message}`
        });
    }
}

function validateActDateTimeInput(value) {
    return parseActDateTime(value) ? '' : '開始日時は MM/DD HH:mm の形式で入力してください。';
}

async function showPartyEditModal(interaction, partyId) {
    const party = await getActById(partyId);

    if (!party) {
        await interaction.reply({
            content: '募集が見つかりません。',
            ephemeral: true
        });
        return;
    }

    if (party.creatorId !== interaction.user.id) {
        await interaction.reply({
            content: '募集を編集できるのは作成者だけです。',
            ephemeral: true
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId(`${ACT_COMPONENT_PREFIX}:edit-submit:${party.id}`)
        .setTitle('募集を編集');

    if (party.game === 'ff14') {
        modal.addComponents(buildTextInputRow(
            new TextInputBuilder()
                .setCustomId('content')
                .setLabel('コンテンツ名')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
                .setValue(party.contentName || party.mode || '')
        ));
    }

    modal.addComponents(
        buildTextInputRow(
            new TextInputBuilder()
                .setCustomId('datetime')
                .setLabel('開始日時（MM/DD HH:mm）')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
                .setValue(party.datetimeInput || formatActDateTimeInputFromScheduledAt(party.scheduledAt) || formatDefaultActDateTimeInput())
        ),
        buildTextInputRow(
            new TextInputBuilder()
                .setCustomId('details')
                .setLabel('募集内容')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000)
                .setValue(party.details || party.note || '')
        )
    );

    await interaction.showModal(modal);
}

function buildTextInputRow(input) {
    return new ActionRowBuilder().addComponents(input);
}

function hasTextInput(interaction, customId) {
    return interaction.fields.fields.has(customId);
}

function cleanupExpiredActCreateDrafts() {
    const expiresAt = Date.now() - ACT_CREATE_DRAFT_TTL_MS;

    for (const [draftId, draft] of actCreateDrafts.entries()) {
        if (!draft.createdAt || draft.createdAt < expiresAt) {
            actCreateDrafts.delete(draftId);
        }
    }
}

function getInteractionDisplayName(interaction) {
    return interaction.member?.displayName
        || interaction.user.globalName
        || interaction.user.username
        || '参加者';
}

function scheduleClosedPartyControlsRefresh(party, client) {
    const closedAt = Date.parse(party.closedAt || '');
    const delay = Number.isNaN(closedAt)
        ? CLOSED_ACT_REOPEN_VISIBLE_MS
        : Math.max(CLOSED_ACT_REOPEN_VISIBLE_MS - (Date.now() - closedAt), 0);

    setTimeout(async function() {
        try {
            const latestParty = await getActById(party.id);

            if (!latestParty || latestParty.status !== ACT_STATUS_CLOSED) {
                return;
            }

            const latestClosedAt = Date.parse(latestParty.closedAt || '');

            if (!Number.isNaN(latestClosedAt) && Date.now() - latestClosedAt < CLOSED_ACT_REOPEN_VISIBLE_MS) {
                return;
            }

            await queuePartyMessageEdit(client, latestParty.id);
        } catch (error) {
            console.error('Failed to hide reopen button:', error);
        }
    }, delay + 1000);
}

async function handleActComponentAction(interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const partyId = parts[2];

    if (action === 'select-slot') {
        return await selectActSlot(partyId, interaction.values[0], interaction.user.id);
    }

    if (action === 'select-ff14-role') {
        return await selectFf14Role(partyId, interaction.values[0], interaction.user.id);
    }

    if (action === 'select-ff14-job') {
        return await selectFf14Job(partyId, interaction.values[0], interaction.user.id);
    }

    if (action === 'join-slot') {
        return await confirmActSlot(partyId, interaction.user.id);
    }

    if (action === 'join-list') {
        return await joinActList(partyId, interaction.user.id);
    }

    if (action === 'leave') {
        return await leaveAct(partyId, interaction.user.id);
    }

    if (action === 'close') {
        return await closeAct(partyId, interaction.user.id);
    }

    if (action === 'reopen') {
        return await reopenAct(partyId, interaction.user.id);
    }

    return {
        ok: false,
        party: null,
        message: '対応していない操作です。'
    };
}
