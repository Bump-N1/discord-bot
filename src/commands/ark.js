import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import { buildArkEditUrl } from '../services/act/act-web-auth.js';
import { registerEphemeralWebReply } from '../services/act/ephemeral-web-link.js';
import {
    buildArkRebootNotificationMessage,
    requestArkReboot
} from '../services/ark/ark-edit-service.js';
import {
    formatStateLabel,
    getArkJoinInfo,
    getArkSettings,
    getArkStatus
} from '../services/ark/ark-service.js';

const ARK_COLOR = 0x2DAA8A;
const EMPTY_VALUE = '未取得';

export const arkEditCommand = new SlashCommandBuilder()
    .setName('ark-edit')
    .setDescription('ARKサーバーのMAPとMODをWeb画面で編集します');

export const arkJoinCommand = new SlashCommandBuilder()
    .setName('ark-join')
    .setDescription('ARKサーバーへの参加方法を表示します');

export const arkRebootCommand = new SlashCommandBuilder()
    .setName('ark-reboot')
    .setDescription('ARKサーバーを再起動します');

export const arkStatusCommand = new SlashCommandBuilder()
    .setName('ark-status')
    .setDescription('ARKサーバーの状態を表示します');

export const arkSettingsCommand = new SlashCommandBuilder()
    .setName('ark-settings')
    .setDescription('ARKサーバーの設定を表示します');

export async function handleArkEditCommand(interaction) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'このコマンドはDiscordサーバー内で実行してください。',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    try {
        const url = buildArkEditUrl({
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            userId: interaction.user.id,
            displayName: interaction.member?.displayName || interaction.user.displayName || interaction.user.username
        });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('ARK設定を編集')
                .setURL(url)
        );

        await interaction.reply({
            content: 'ARKサーバーのMAPとMODを編集できます。保存すると、プレイヤーがいない場合のみ自動で再起動します。',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
        registerEphemeralWebReply(url, interaction);
    } catch (error) {
        console.error('ARK edit command failed:', error);
        await interaction.reply({
            content: 'ARK設定編集画面を開けませんでした。Web画面の設定を確認してください。',
            flags: MessageFlags.Ephemeral
        });
    }
}

export async function handleArkRebootCommand(interaction) {
    await interaction.deferReply();

    try {
        const result = await requestArkReboot({
            actorId: interaction.user.id,
            actorName: interaction.member?.displayName || interaction.user.displayName || interaction.user.username
        });

        await interaction.editReply({
            content: buildArkRebootNotificationMessage(result)
        });
    } catch (error) {
        console.error('ARK reboot failed:', error);
        await interaction.editReply({
            content: 'NitradoからARKサーバーの状態を取得できなかったため、再起動を実行できませんでした。'
        });
    }
}

export async function handleArkJoinCommand(interaction) {
    await interaction.deferReply();

    try {
        const config = await getArkJoinInfo();

        await interaction.editReply({
            embeds: [buildArkJoinEmbed(config)]
        });
    } catch (error) {
        await replyNitradoError(interaction, '参加情報', error);
    }
}

export async function handleArkStatusCommand(interaction) {
    await interaction.deferReply();

    try {
        const status = await getArkStatus();

        await interaction.editReply({
            embeds: [buildArkStatusEmbed(status)]
        });
    } catch (error) {
        await replyNitradoError(interaction, '状態', error);
    }
}

export async function handleArkSettingsCommand(interaction) {
    await interaction.deferReply();

    try {
        const config = await getArkSettings();

        await interaction.editReply({
            embeds: [buildArkSettingsEmbed(config)]
        });
    } catch (error) {
        await replyNitradoError(interaction, '設定', error);
    }
}

function buildArkJoinEmbed(config) {
    const description = [
        '【サーバー情報】',
        `サーバー名：${formatValue(config.serverName)}`,
        `マップ：${formatValue(config.map)}`,
        `パスワード：${formatValue(config.password)}`,
        '',
        '【参加手順】',
        '1. 一覧から「非公式」を選択',
        '2. 「パスワードありのサーバーを表示」にチェック',
        `3. 検索欄に「${formatValue(config.serverName)}」と入力`,
        '4. サーバーを選択して右下の「開始」を押す'
    ];

    return new EmbedBuilder()
        .setTitle('ARK 参加方法')
        .setColor(ARK_COLOR)
        .setDescription(description.join('\n'));
}

function buildArkStatusEmbed(status) {
    const playerText = status.playerCount === null
        ? `? / ${status.maxPlayers}`
        : `${status.playerCount} / ${status.maxPlayers}`;
    const description = [
        `サーバー名：${status.serverName}`,
        `マップ：${status.map}`,
        `人数：${playerText}`,
        `状態：${status.nitradoStatus === 'stopped' ? '停止中' : formatStateLabel(status.state)}`,
        `IP：${status.address}`
    ];

    return new EmbedBuilder()
        .setTitle('ARK ASA Server Status')
        .setColor(ARK_COLOR)
        .setDescription(description.join('\n'))
        .setTimestamp();
}

function buildArkSettingsEmbed(config) {
    const settings = config.settings;
    const differences = config.differences || [];
    const description = [
        `経験値：${formatValue(settings.experience)}`,
        `テイム：${formatValue(settings.taming)}`,
        `採取：${formatValue(settings.harvesting)}`,
        `孵化：${formatValue(settings.hatching)}`,
        `成熟：${formatValue(settings.maturation)}`,
        `重量：${formatValue(settings.weight)}`,
        `自動保存：${formatValue(settings.autosave)}`,
        config.restartTime ? `自動再起動：毎日 ${config.restartTime} 頃` : '自動再起動：設定なし',
        '',
        '【直近の変更】',
        differences.length > 0
            ? differences.slice(0, 3).map(formatSettingDiff).join('\n')
            : 'まだ自動検出した設定変更はありません。'
    ];

    return new EmbedBuilder()
        .setTitle('現在のARK鯖設定')
        .setColor(ARK_COLOR)
        .setDescription(description.join('\n'));
}

function formatSettingDiff(entry) {
    const date = entry.createdAt ? formatDateTime(entry.createdAt) : '';
    const lines = (entry.changes || []).map(function(change) {
        return `${change.label}：${change.before} -> ${change.after}`;
    });

    return [`・${date}`, ...lines].join('\n');
}

function formatDateTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function formatValue(value) {
    return String(value || '').trim() || EMPTY_VALUE;
}

async function replyNitradoError(interaction, target, error) {
    console.error(`ARK ${target} fetch failed:`, error);
    await interaction.editReply({
        content: `NitradoからARKサーバーの${target}を取得できませんでした。`
    });
}
