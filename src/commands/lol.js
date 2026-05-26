import { SlashCommandBuilder } from 'discord.js';
import { getLolSummary } from '../services/riot/lol-service.js';
import { buildLolEmbed } from '../formatters/lol-embed.js';
import { getRiotIdFromOptions } from '../utils/riot-id.js';

export const lolCommand = new SlashCommandBuilder()
    .setName('lol-stats')
    .setDescription('LoLの直近戦績を表示します')
    .addStringOption(function(option) {
        return option
            .setName('riot-id')
            .setDescription('Riot ID（名前#タグ）')
            .setRequired(true);
    })
    .addIntegerOption(function(option) {
        return option
            .setName('count')
            .setDescription('集計する試合数（1〜20）')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20);
    });

export async function handleLolCommand(interaction) {
    await interaction.deferReply();

    try {
        const riotId = getRiotIdFromOptions(interaction.options);
        const count = interaction.options.getInteger('count') || 10;
        const summary = await getLolSummary(riotId.gameName, riotId.tagLine, count);
        const embed = buildLolEmbed(summary, false);

        await interaction.editReply({
            embeds: [embed]
        });
    } catch (error) {
        await interaction.editReply({
            content: `取得に失敗しました。\n${error.message}`
        });
    }
}
