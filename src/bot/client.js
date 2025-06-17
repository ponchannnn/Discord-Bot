const { Client, GatewayIntentBits } = require('discord.js');
const ready = require('../events/ready');
const presenceUpdate = require('../events/presenceUpdate');
const voiceStateUpdate = require('../events/voiceStateUpdate');
const messageCreate = require('../events/messageCreate');
const interactionCreate = require('../events/interactionCreate');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once('ready', (c) => ready(client, c));
client.on('presenceUpdate', (o, n) => presenceUpdate(client, o, n));
client.on('voiceStateUpdate', (o, n) => voiceStateUpdate(client, o, n));
client.on('messageCreate', (msg) => messageCreate(client, msg));
client.on('interactionCreate', (i) => interactionCreate(client, i));

client.login(process.env.TOKEN);

module.exports = client;