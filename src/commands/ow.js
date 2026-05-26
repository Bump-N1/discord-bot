import { SlashCommandBuilder } from 'discord.js';
import { getOwSummary } from '../services/overwatch/ow-service.js';
import { buildOwEmbed } from '../formatters/ow-embed.js';

export const owCommand = new SlashCommandBuilder()
    .setName('ow-stats')
    .setDescription('OWの戦績を表示します')
    .addStringOption(function(option) {
        return option
            .setName('battletag')
            .setDescription('BattleTag（名前#タグ）')
            .setRequired(true);
    })
    .addStringOption(function(option) {
        return option
            .setName('role')
            .setDescription('表示するロール')
            .setRequired(false)
            .addChoices(
                {
                    name: 'Tank',
                    value: 'tank'
                },
                {
                    name: 'Damage',
                    value: 'damage'
                },
                {
                    name: 'Support',
                    value: 'support'
                }
            );
    });

export async function handleOwCommand(interaction) {
    await interaction.deferReply();

    try {
        const battleTag = interaction.options.getString('battletag');
        const role = interaction.options.getString('role') || '';
        const summary = await getOwSummary(battleTag, role);
        const embed = buildOwEmbed(summary);

        await interaction.editReply({
            embeds: [embed]
        });
    } catch (error) {
        await interaction.editReply({
            content: `取得に失敗しました。\n${error.message}`
        });
    }
}
