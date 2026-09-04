import { MessageFlags } from 'discord.js';

export async function replyInteractionError(interaction) {
    const content = '処理に失敗しました。時間をおいてもう一度お試しください。';

    if (interaction.deferred || interaction.replied) {
        if (typeof interaction.followUp === 'function') {
            await interaction.followUp({
                content: content,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (typeof interaction.editReply === 'function') {
            await interaction.editReply({
                content: content
            });
            return;
        }
    }

    if (typeof interaction.reply === 'function') {
        await interaction.reply({
            content: content,
            flags: MessageFlags.Ephemeral
        });
    }
}
