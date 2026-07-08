import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import { buildArkBackupUrl, buildArkEditUrl } from '../services/act/act-web-auth.js';
import { registerEphemeralWebReply } from '../services/act/ephemeral-web-link.js';
import {
    buildArkBackupNotificationMessage,
    createArkBackup
} from '../services/ark/ark-backup-service.js';
import {
    buildArkRebootNotificationMessage,
    requestArkReboot
} from '../services/ark/ark-edit-service.js';
import { getArkConfig } from '../services/ark/ark-config.js';
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
    .setDescription('ARKサーバー設定を表示します');

export const arkBackupCommand = new SlashCommandBuilder()
    .setName('ark-backup')
    .setDescription('ARKサーバーデータをバックアップします');

export const arkRestoreCommand = new SlashCommandBuilder()
    .setName('ark-restore')
    .setDescription('ARKバックアップの復元画面を開きます');

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
            content: 'ARK設定の編集画面を開けませんでした。Web画面の設定を確認してください。',
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

export async function handleArkBackupCommand(interaction) {
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    try {
        const result = await createArkBackup({
            reason: '手動バックアップ',
            actorId: interaction.user.id,
            actorName: interaction.member?.displayName || interaction.user.displayName || interaction.user.username
        });

        await postArkNotification(interaction.client, buildArkBackupNotificationMessage(result));
        await interaction.editReply({
            content: `バックアップを作成しました。保存日時：${formatDateTime(result.createdAt)} / ${formatBytes(result.totalBytes)}`
        });
    } catch (error) {
        console.error('ARK backup failed:', error);
        await interaction.editReply({
            content: `ARKバックアップに失敗しました。${error.message}`
        });
    }
}

export async function handleArkRestoreCommand(interaction) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'このコマンドはDiscordサーバー内で実行してください。',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    try {
        const url = buildArkBackupUrl({
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            userId: interaction.user.id,
            displayName: interaction.member?.displayName || interaction.user.displayName || interaction.user.username
        });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('ARKバックアップを確認')
                .setURL(url)
        );

        await interaction.reply({
            content: 'バックアップ一覧から復元できます。復元はプレイヤーがいない場合のみ実行されます。',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
        registerEphemeralWebReply(url, interaction);
    } catch (error) {
        console.error('ARK restore command failed:', error);
        await interaction.reply({
            content: 'ARKバックアップの復元画面を開けませんでした。Web画面の設定を確認してください。',
            flags: MessageFlags.Ephemeral
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
    const steps = [
        '1. サーバー一覧から「非公式」を選択',
        '2. 「パスワードありのサーバーを表示」をON',
        `3. 検索欄に「${formatValue(config.serverName)}」を入力`,
        '4. サーバーを選択して右下の「開始」を押す'
    ];

    return new EmbedBuilder()
        .setTitle('ARK 参加方法')
        .setColor(ARK_COLOR)
        .addFields(
            { name: 'サーバー名', value: formatValue(config.serverName), inline: true },
            { name: 'マップ', value: formatValue(config.map), inline: true },
            { name: 'パスワード', value: formatValue(config.password), inline: true },
            { name: '手順', value: steps.join('\n'), inline: false }
        );
}

function buildArkStatusEmbed(status) {
    const stateText = status.nitradoStatus === 'stopped'
        ? '⏸️ 停止中'
        : formatStateLabel(status.state);

    return new EmbedBuilder()
        .setTitle('ARK サーバーステータス')
        .setColor(ARK_COLOR)
        .addFields(
            { name: 'サーバー名', value: formatValue(status.serverName), inline: true },
            { name: 'マップ', value: formatValue(status.map), inline: true },
            { name: '人数', value: formatPlayers(status), inline: true },
            { name: '状態', value: stateText, inline: true },
            { name: '接続先', value: formatValue(status.address), inline: true }
        )
        .setTimestamp();
}

function buildArkSettingsEmbed(config) {
    const settings = config.settings;
    const differences = config.differences || [];
    const recentChanges = differences.length > 0
        ? differences.slice(0, 3).map(formatSettingDiff).join('\n\n').slice(0, 1024)
        : '自動検出された変更はまだありません。';

    return new EmbedBuilder()
        .setTitle('ARK サーバー設定')
        .setColor(ARK_COLOR)
        .addFields(
            { name: '経験値', value: formatValue(settings.experience), inline: true },
            { name: 'テイム', value: formatValue(settings.taming), inline: true },
            { name: '採取', value: formatValue(settings.harvesting), inline: true },
            { name: '孵化', value: formatValue(settings.hatching), inline: true },
            { name: '成熟', value: formatValue(settings.maturation), inline: true },
            { name: '重量', value: formatValue(settings.weight), inline: true },
            { name: '自動保存', value: formatValue(settings.autosave), inline: true },
            { name: '自動再起動', value: config.restartTime ? `毎日 ${config.restartTime} 頃` : '未設定', inline: true },
            { name: '最近の変更', value: recentChanges, inline: false }
        )
        .setTimestamp();
}

function formatSettingDiff(entry) {
    const date = entry.createdAt ? formatDateTime(entry.createdAt) : '';
    const lines = (entry.changes || []).map(function(change) {
        return `${change.label}: ${change.before} → ${change.after}`;
    });

    return [`・${date}`, ...lines].filter(Boolean).join('\n');
}

function formatPlayers(status) {
    const current = status.playerCount === null || status.playerCount === undefined
        ? '?'
        : String(status.playerCount);
    const max = status.maxPlayers === null || status.maxPlayers === undefined
        ? '?'
        : String(status.maxPlayers);

    return `${current} / ${max}`;
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

function formatBytes(value) {
    const bytes = Number(value) || 0;
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
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

async function postArkNotification(client, content) {
    const channelId = getArkConfig().notifyChannelId;

    if (!channelId) {
        return;
    }

    const channel = await client.channels.fetch(channelId);

    if (!channel?.isTextBased()) {
        throw new Error('ARK_NOTIFY_CHANNEL_ID is not a text channel.');
    }

    await channel.send({
        content: content
    });
}
