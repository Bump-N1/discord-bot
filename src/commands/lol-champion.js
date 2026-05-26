import { SlashCommandBuilder } from 'discord.js';
import { getLolSummary } from '../services/riot/lol-service.js';
import { buildLolEmbed } from '../formatters/lol-embed.js';
import { getRiotIdFromOptions } from '../utils/riot-id.js';

export const lolChampionCommand = new SlashCommandBuilder()
    .setName('lol-stats-champion')
    .setDescription('指定チャンピオンだけの直近戦績を表示します')
    .addStringOption(function(option) {
        return option
            .setName('riot-id')
            .setDescription('Riot ID（名前#タグ）')
            .setRequired(true);
    })
    .addStringOption(function(option) {
        return option
            .setName('champion')
            .setDescription('チャンピオン名')
            .setRequired(true);
    })
    .addIntegerOption(function(option) {
        return option
            .setName('count')
            .setDescription('表示する試合数（1〜10）')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10);
    });

export async function handleLolChampionCommand(interaction) {
    await interaction.deferReply();

    try {
        const riotId = getRiotIdFromOptions(interaction.options);
        const champion = interaction.options.getString('champion');
        const count = interaction.options.getInteger('count') || 10;
        const summary = await getLolSummary(riotId.gameName, riotId.tagLine, count, champion);
        const embed = buildLolEmbed(summary, true);

        await interaction.editReply({
            embeds: [embed]
        });
    } catch (error) {
        await interaction.editReply({
            content: `取得に失敗しました。\n${error.message}`
        });
    }
}
