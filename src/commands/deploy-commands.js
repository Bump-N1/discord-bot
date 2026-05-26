import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { lolCommand } from './lol.js';
import { lolChampionCommand } from './lol-champion.js';
import { owCommand } from './ow.js';
import { owHeroCommand } from './ow-hero.js';
import { ff14ActCommand, owActCommand, lolActCommand } from './act.js';
import { arkJoinCommand, arkSettingsCommand, arkStatusCommand } from './ark.js';

const commands = [
    arkJoinCommand.toJSON(),
    arkStatusCommand.toJSON(),
    arkSettingsCommand.toJSON(),
    lolCommand.toJSON(),
    lolChampionCommand.toJSON(),
    owCommand.toJSON(),
    owHeroCommand.toJSON(),
    lolActCommand.toJSON(),
    owActCommand.toJSON(),
    ff14ActCommand.toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
    {
        body: commands
    }
);

console.log('Slash commands registered.');
