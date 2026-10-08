const { Client, GatewayIntentBits, Partials } = require('discord.js');

function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildVoiceStates,
    ],
    // 再起動でキャッシュされていないメッセージへのリアクションも拾うため(features/eufyStats)
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });
}

module.exports = createClient;
