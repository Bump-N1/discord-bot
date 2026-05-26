import { SlashCommandBuilder } from 'discord.js';
import { getOwHeroSummary, searchOwHeroes } from '../services/overwatch/ow-service.js';
import { buildOwEmbed } from '../formatters/ow-embed.js';

export const owHeroCommand = new SlashCommandBuilder()
    .setName('ow-stats-hero')
    .setDescription('指定ヒーローだけの戦績を表示します')
    .addStringOption(function(option) {
        return option
            .setName('battletag')
            .setDescription('BattleTag（名前#タグ）')
            .setRequired(true);
    })
    .addStringOption(function(option) {
        return option
            .setName('hero')
            .setDescription('ヒーロー名')
            .setRequired(true)
            .setAutocomplete(true);
    });

export async function handleOwHeroCommand(interaction) {
    await interaction.deferReply();

    try {
        const battleTag = interaction.options.getString('battletag');
        const hero = interaction.options.getString('hero');
        const summary = await getOwHeroSummary(battleTag, hero);
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

export async function handleOwHeroAutocomplete(interaction) {
    try {
        const focusedValue = interaction.options.getFocused();
        const choices = await searchOwHeroes(focusedValue, 25);

        await interaction.respond(choices);
    } catch (error) {
        await interaction.respond([]);
    }
}
