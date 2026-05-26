import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { postCurrentPoe2MarketImage } from '../services/poe2/poe2-market-monitor.js';
import {
    getPoe2MarketSubscription,
    removePoe2MarketSubscription,
    savePoe2MarketSubscription
} from '../services/poe2/poe2-market-store.js';

export const poe2MarketCommand = new SlashCommandBuilder()
    .setName('poe2-market')
    .setDescription('PoE2の相場画像の定期投稿を開始・停止します');

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
        const snapshot = await postCurrentPoe2MarketImage(interaction.client, interaction.channelId);
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
            content: 'このチャンネルでPoE2相場画像の定期投稿を開始しました。最新の確定相場が更新されるたびに投稿します。'
        });
    } catch (error) {
        console.error('PoE2 market command failed:', error);
        await interaction.editReply({
            content: 'PoE2相場を取得できませんでした。API設定または接続状況を確認してください。'
        });
    }
}

