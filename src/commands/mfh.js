import {
    EmbedBuilder,
    SlashCommandBuilder
} from 'discord.js';
import {
    autocompleteMfhEntries,
    formatMfhStats,
    getMfhEntryDetail,
    MFH_SOURCES,
    searchMfhEntries
} from '../services/mfh/mfh-service.js';
import {
    hasMfhLocalDictionary,
    looksLikeJapaneseMfhText
} from '../services/mfh/mfh-localization.js';

const MFH_COLOR = 0x8EA85A;
const SOURCE_NAME = 'Mistfall Hunter GameDB';

export const mfhSearchCommand = new SlashCommandBuilder()
    .setName('mfh-search')
    .setDescription('MFHの装備・スキル・アイテムなどを検索します')
    .addStringOption(function(option) {
        return option
            .setName('keyword')
            .setDescription('検索したい名前やキーワードを入力')
            .setRequired(true);
    })
    .addStringOption(function(option) {
        return option
            .setName('category')
            .setDescription('検索対象のカテゴリを絞り込む')
            .setRequired(false)
            .addChoices(...MFH_SOURCES.map(function(source) {
                return {
                    name: source.label,
                    value: source.key
                };
            }));
    });

export const mfhItemCommand = new SlashCommandBuilder()
    .setName('mfh-item')
    .setDescription('MFHの指定データを詳しく表示します')
    .addStringOption(function(option) {
        return option
            .setName('name')
            .setDescription('表示したいデータ名を入力')
            .setRequired(true)
            .setAutocomplete(true);
    });

export async function handleMfhSearchCommand(interaction) {
    await interaction.deferReply();

    const keyword = interaction.options.getString('keyword', true);
    const category = interaction.options.getString('category') || '';

    try {
        const entries = await searchMfhEntries(keyword, {
            category: category
        });

        if (entries.length === 0) {
            await interaction.editReply({
                content: buildMfhNoResultMessage(keyword, 'search')
            });
            return;
        }

        await interaction.editReply({
            embeds: [buildMfhSearchEmbed(keyword, entries)]
        });
    } catch (error) {
        console.error('MFH search failed:', error);
        await interaction.editReply({
            content: 'MFHデータを取得できませんでした。GameDB側の状態や接続状況を確認してください。'
        });
    }
}

export async function handleMfhItemCommand(interaction) {
    await interaction.deferReply();

    const name = interaction.options.getString('name', true);

    try {
        const entry = await getMfhEntryDetail(name);

        await interaction.editReply({
            embeds: [buildMfhDetailEmbed(entry)]
        });
    } catch (error) {
        console.error('MFH item lookup failed:', error);
        await interaction.editReply({
            content: buildMfhNoResultMessage(name, 'item')
        });
    }
}

export async function handleMfhItemAutocomplete(interaction) {
    try {
        const focused = interaction.options.getFocused();
        const choices = await autocompleteMfhEntries(focused);

        await interaction.respond(choices);
    } catch (error) {
        console.error('MFH autocomplete failed:', error);
        await interaction.respond([]);
    }
}

function buildMfhSearchEmbed(keyword, entries) {
    const embed = new EmbedBuilder()
        .setTitle(`MFH検索：${keyword}`)
        .setColor(MFH_COLOR)
        .setDescription(`一致度が高い順に最大${entries.length}件を表示しています。詳細は \`/mfh-item\` で確認できます。`)
        .setFooter({
            text: SOURCE_NAME
        })
        .setTimestamp();

    for (const entry of entries) {
        embed.addFields({
            name: `${getMfhDisplayName(entry)} / ${entry.categoryLabel}`,
            value: formatMfhSearchEntry(entry),
            inline: false
        });
    }

    return embed;
}

function buildMfhDetailEmbed(entry) {
    const embed = new EmbedBuilder()
        .setTitle(`MFH詳細：${getMfhDisplayName(entry)}`)
        .setURL(entry.url)
        .setColor(MFH_COLOR)
        .setDescription(formatDescription(entry.description))
        .addFields({
            name: 'カテゴリ',
            value: entry.categoryLabel || '未取得',
            inline: true
        })
        .setFooter({
            text: SOURCE_NAME
        })
        .setTimestamp();

    if (entry.iconUrl) {
        embed.setThumbnail(entry.iconUrl);
    }

    if (entry.localizedTags?.length > 0) {
        embed.addFields({
            name: 'タグ',
            value: entry.localizedTags.join(' / '),
            inline: false
        });
    }

    for (const stat of formatMfhStats(entry, 10)) {
        embed.addFields({
            name: stat.name,
            value: stat.value,
            inline: true
        });
    }

    embed.addFields({
        name: 'データ元',
        value: `[${SOURCE_NAME}](${entry.url})`,
        inline: false
    });

    return embed;
}

function formatMfhSearchEntry(entry) {
    const tags = entry.localizedTags?.length > 0
        ? `タグ：${entry.localizedTags.join(' / ')}\n`
        : '';
    const originalName = entry.localizedName && entry.localizedName !== entry.name
        ? `英語名：${entry.name}\n`
        : '';
    const summary = entry.description
        ? `${truncateText(entry.description, 140)}\n`
        : '';

    return `${originalName}${tags}${summary}[詳細ページを開く](${entry.url})`;
}

function getMfhDisplayName(entry) {
    return entry.displayName || entry.localizedName || entry.name;
}

function formatDescription(description) {
    const text = String(description || '').trim();

    if (!text) {
        return '説明文は取得できませんでした。';
    }

    return truncateText(text, 700);
}

function truncateText(text, maxLength) {
    const value = String(text || '');

    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength - 3)}...`;
}

function buildMfhNoResultMessage(keyword, type, localDictionaryAvailable = hasMfhLocalDictionary()) {
    if (looksLikeJapaneseMfhText(keyword) && !localDictionaryAvailable) {
        return [
            `「${keyword}」に一致するMFHデータは見つかりませんでした。`,
            '日本語名検索用のローカル辞書が未生成のため、現在は英語名またはGameDB上の表記で検索してください。'
        ].join('\n');
    }

    if (type === 'item') {
        return `「${keyword}」に一致するMFHデータは見つかりませんでした。まず \`/mfh-search\` で候補を確認してください。`;
    }

    return `「${keyword}」に一致するMFHデータは見つかりませんでした。英語名、GameDB上の表記、短い単語で試してみてください。`;
}

export const __testables = {
    buildMfhNoResultMessage
};
