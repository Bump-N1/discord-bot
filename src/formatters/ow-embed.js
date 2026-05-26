import { EmbedBuilder } from 'discord.js';
import { createCodeBlock, padText } from '../utils/format.js';

export function buildOwEmbed(summary) {
    const rankLines = summary.ranks.map(function(rankRow) {
        return [
            padText(rankRow.role, 7),
            rankRow.rank
        ].join('  ');
    });

    const statsLines = buildStatsLines(summary.stats);
    const roleLines = buildRoleLines(summary.roleStats);

    if (summary.selectedRole && !summary.hasSelectedRoleStats) {
        statsLines.push('');
        statsLines.push('No role stats');
    }

    if (summary.selectedHero && !summary.hasSelectedHeroStats) {
        statsLines.push('');
        statsLines.push('ヒーロー別戦績なし');
    }

    const embed = new EmbedBuilder()
        .setTitle(buildTitle(summary))
        .setDescription(buildDescription(summary))
        .setColor(0xF06414)
        .addFields(
            {
                name: '🏆 Rank',
                value: rankLines.length > 0 ? createCodeBlock(rankLines.join('\n')) : '-',
                inline: false
            },
            {
                name: '📊 Stats',
                value: statsLines.length > 0 ? createCodeBlock(statsLines.join('\n')) : '-',
                inline: false
            }
        )
        .setFooter({
            text: 'Overwatch'
        })
        .setTimestamp();

    if (roleLines.length > 0) {
        embed.addFields({
            name: '🛡️ Role',
            value: createCodeBlock(roleLines.join('\n')),
            inline: false
        });
    }

    if (summary.hero?.portrait) {
        embed.setThumbnail(summary.hero.portrait);
    } else if (summary.player.avatar) {
        embed.setThumbnail(summary.player.avatar);
    }

    if (summary.player.namecard) {
        embed.setImage(summary.player.namecard);
    }

    return embed;
}

function buildTitle(summary) {
    if (summary.selectedHero) {
        return `${summary.player.name} / ${summary.selectedHero}`;
    }

    if (summary.selectedRole) {
        return `${summary.player.name} / ${summary.selectedRole}`;
    }

    return summary.player.name;
}

function buildDescription(summary) {
    const lines = [];

    if (summary.player.title) {
        lines.push(summary.player.title);
    }

    if (summary.hero?.role) {
        lines.push(summary.hero.role.toUpperCase());
    }

    if (summary.stats.winRate !== '-') {
        lines.push(`**WR ${summary.stats.winRate}**`);
    }

    if (summary.stats.kda !== '-') {
        lines.push(`KDA **${summary.stats.kda}**`);
    }

    if (lines.length === 0) {
        return 'Public career profile stats';
    }

    return lines.join('  ·  ');
}

function buildStatsLines(stats) {
    const rows = [
        ['Mode', stats.mode],
        ['Games', stats.games],
        ['Wins', stats.wins],
        ['Losses', stats.losses],
        ['WR', stats.winRate],
        ['KDA', stats.kda],
        ['Avg DMG', stats.avgDamage],
        ['Avg HEAL', stats.avgHealing]
    ];

    return rows.filter(function(row) {
        return row[1] !== '-';
    }).map(function(row) {
        return [
            padText(row[0], 8),
            row[1]
        ].join('  ');
    });
}

function buildRoleLines(roleStats) {
    const lines = [];

    for (const roleStat of roleStats) {
        lines.push(roleStat.role);
        lines.push(buildRoleMetricLine('W/L', `${roleStat.wins}W ${roleStat.losses}L`));
        lines.push(buildRoleMetricLine('WR', roleStat.winRate));
        lines.push(buildRoleMetricLine('KDA', roleStat.kda));
        lines.push(buildRoleMetricLine('DMG', roleStat.avgDamage));
        lines.push(buildRoleMetricLine('HEAL', roleStat.avgHealing));
        lines.push('');
    }

    if (lines[lines.length - 1] === '') {
        lines.pop();
    }

    return lines;
}

function buildRoleMetricLine(label, value) {
    return [
        padText('', 2),
        padText(label, 5),
        value
    ].join('  ');
}
