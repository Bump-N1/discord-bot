import { EmbedBuilder } from 'discord.js';
import { createCodeBlock, padText } from '../utils/format.js';

export function buildLolEmbed(summary, isChampionMode) {
    const queueLines = summary.queueStats.map(function(stat) {
        return [
            padText(stat.queueName, 8),
            padText(`${stat.wins}W ${stat.losses}L`, 7),
            `WR ${String(stat.winRate).padStart(3, ' ')}%`
        ].join('  ');
    });

    const championLines = summary.championStats.map(function(stat) {
        return [
            padText(stat.championName, 10),
            padText(`${stat.wins}W ${stat.losses}L`, 7),
            `WR ${String(stat.winRate).padStart(3, ' ')}%`
        ].join('  ');
    });

    const matchLines = summary.matches.slice(0, 5).map(function(match) {
        const resultIcon = match.win ? '✅' : '❌';
        const kdaText = `${match.kills}/${match.deaths}/${match.assists}`;

        return [
            resultIcon,
            padText(match.championName, 10),
            padText(kdaText, 7),
            padText(`KDA ${match.kdaRatio}`, 7),
            padText(match.queueName, 6),
            match.gameDurationText
        ].join('  ');
    });

    const title = isChampionMode
        ? `${summary.riotId} / ${summary.championFilter}`
        : summary.riotId;

    const description = [
        `**${summary.wins}W ${summary.losses}L**  ·  **WR ${summary.winRate}%**`,
        `Avg KDA \`${summary.averageKills}/${summary.averageDeaths}/${summary.averageAssists}\`  ·  **${summary.averageKdaRatio}**`
    ].join('\n');

    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(isChampionMode ? 0xC0392B : 0x5865F2)
        .addFields(
            {
                name: '🏆 Rank',
                value: [
                    `**Solo**  ${summary.soloRank}`,
                    `**Flex**  ${summary.flexRank}`
                ].join('\n'),
                inline: false
            },
            {
                name: '🎮 Queue',
                value: queueLines.length > 0 ? createCodeBlock(queueLines.join('\n')) : '-',
                inline: false
            },
            {
                name: '⚔️ Champions',
                value: championLines.length > 0 ? createCodeBlock(championLines.join('\n')) : '-',
                inline: false
            },
            {
                name: '📋 Recent',
                value: matchLines.length > 0 ? createCodeBlock(matchLines.join('\n')) : '-',
                inline: false
            }
        )
        .setFooter({
            text: 'League of Legends'
        })
        .setTimestamp();
}
