import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { handleLolCommand } from './commands/lol.js';
import { handleLolChampionCommand } from './commands/lol-champion.js';
import { handleOwCommand } from './commands/ow.js';
import { handleOwHeroAutocomplete, handleOwHeroCommand } from './commands/ow-hero.js';
import { handleActCommand, handleActComponent, handleActModalSubmit } from './commands/act.js';
import {
    handleArkBackupCommand,
    handleArkEditCommand,
    handleArkJoinCommand,
    handleArkRebootCommand,
    handleArkRestoreCommand,
    handleArkSettingsCommand,
    handleArkStatusCommand
} from './commands/ark.js';
import { startArkStatusMonitor } from './services/ark/ark-monitor.js';
import { startArkConfigHistoryMonitor } from './services/ark/ark-config-history.js';
import { startArkBackupMonitor } from './services/ark/ark-backup-monitor.js';
import { startActMonitor } from './services/act/act-monitor.js';
import { startActWebServer } from './services/act/act-web-server.js';
import { handlePoe2MarketCommand, handlePoe2MarketEditCommand } from './commands/poe2.js';
import { startPoe2MarketMonitor } from './services/poe2/poe2-market-monitor.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

client.once('clientReady', function() {
    console.log(`Logged in as ${client.user.tag}`);
    startArkStatusMonitor(client);
    startArkConfigHistoryMonitor();
    startArkBackupMonitor(client);
    startActMonitor(client);
    startActWebServer(client);
    startPoe2MarketMonitor(client);
});

client.on('interactionCreate', async function(interaction) {
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'ow-stats-hero') {
            await handleOwHeroAutocomplete(interaction);
        }

        return;
    }

    if (interaction.isStringSelectMenu() || interaction.isButton()) {
        const handled = await handleActComponent(interaction);

        if (handled) {
            return;
        }
    }

    if (interaction.isModalSubmit()) {
        const handled = await handleActModalSubmit(interaction);

        if (handled) {
            return;
        }
    }

    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (interaction.commandName === 'ark-edit') {
        await handleArkEditCommand(interaction);
        return;
    }

    if (interaction.commandName === 'ark-backup') {
        await handleArkBackupCommand(interaction);
        return;
    }

    if (interaction.commandName === 'ark-restore') {
        await handleArkRestoreCommand(interaction);
        return;
    }

    if (interaction.commandName === 'ark-join') {
        await handleArkJoinCommand(interaction);
        return;
    }

    if (interaction.commandName === 'ark-reboot') {
        await handleArkRebootCommand(interaction);
        return;
    }

    if (interaction.commandName === 'ark-status') {
        await handleArkStatusCommand(interaction);
        return;
    }

    if (interaction.commandName === 'ark-settings') {
        await handleArkSettingsCommand(interaction);
        return;
    }

    if (interaction.commandName === 'lol-stats') {
        await handleLolCommand(interaction);
        return;
    }

    if (interaction.commandName === 'lol-stats-champion') {
        await handleLolChampionCommand(interaction);
        return;
    }

    if (interaction.commandName === 'ow-stats') {
        await handleOwCommand(interaction);
        return;
    }

    if (interaction.commandName === 'ow-stats-hero') {
        await handleOwHeroCommand(interaction);
        return;
    }

    if (interaction.commandName === 'act-lol') {
        await handleActCommand(interaction);
        return;
    }

    if (interaction.commandName === 'act-ow') {
        await handleActCommand(interaction);
        return;
    }

    if (interaction.commandName === 'act-ff14') {
        await handleActCommand(interaction);
        return;
    }

    if (interaction.commandName === 'poe2-market') {
        await handlePoe2MarketCommand(interaction);
        return;
    }

    if (interaction.commandName === 'poe2-market-edit') {
        await handlePoe2MarketEditCommand(interaction);
        return;
    }
});

client.login(process.env.DISCORD_TOKEN);
