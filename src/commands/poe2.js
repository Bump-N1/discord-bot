import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import { buildPoe2MarketEditUrl } from '../services/act/act-web-auth.js';
import { postCurrentPoe2MarketImage } from '../services/poe2/poe2-market-monitor.js';
import {
    getPoe2MarketSettings,
    getPoe2MarketSubscription,
    removePoe2MarketSubscription,
    savePoe2MarketSubscription
} from '../services/poe2/poe2-market-store.js';

export const poe2MarketCommand = new SlashCommandBuilder()
    .setName('poe2-market')
    .setDescription('PoE2の相場画像の定期投稿を開始・停止します');

export const poe2MarketEditCommand = new SlashCommandBuilder()
    .setName('poe2-market-edit')
    .setDescription('PoE2相場画像に表示するアイテムを設定します');

export async function handlePoe2MarketCommand(interaction) {
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    const subscription = await getPoe2MarketSubscription(interaction.channelId);

    if (subscription) {
        await removePoe2MarketSubscription(interaction.channelId);
        await interaction.editReply({
            content: 'このチャンネルのPoE2相場画像の定期投稿を停止しました。'
        });
        return;
    }

    try {
        const settings = await getPoe2MarketSettings(interaction.guildId);

        if (settings.selectedProducts.length === 0) {
            await interaction.editReply({
                content: '表示するアイテムが設定されていません。先に `/poe2-market-edit` で設定してください。'
            });
            return;
        }

        const snapshot = await postCurrentPoe2MarketImage(interaction.client, interaction.channelId, interaction.guildId);
        const now = new Date().toISOString();

        await savePoe2MarketSubscription({
            channelId: interaction.channelId,
            guildId: interaction.guildId,
            enabledBy: interaction.user.id,
            enabledAt: now,
            updatedAt: now,
            lastPostedChangeId: snapshot.changeId
        });

        await interaction.editReply({
            content: 'このチャンネルでPoE2相場画像の定期投稿を開始しました。以降は1時間ごとに新しい相場画像を投稿します。'
        });
    } catch (error) {
        console.error('PoE2 market command failed:', error);
        await interaction.editReply({
            content: 'PoE2相場を取得できませんでした。API設定または接続状況を確認してください。'
        });
    }
}

export async function handlePoe2MarketEditCommand(interaction) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'この設定はDiscordサーバー内で実行してください。',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    try {
        const url = buildPoe2MarketEditUrl({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            displayName: interaction.member?.displayName || interaction.user.displayName || interaction.user.username
        });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('相場の表示アイテムを設定')
                .setURL(url)
        );

        await interaction.reply({
            content: 'このサーバーで表示するPoE2相場アイテムを設定できます。',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('PoE2 market edit command failed:', error);
        await interaction.reply({
            content: '相場設定画面を開けませんでした。Web画面の設定を確認してください。',
            flags: MessageFlags.Ephemeral
        });
    }
}

