const wsServer = require('./wsServer');
const createMessageHandler = require('./messageHandlers');
const channelStore = require('./channelStore');

function isMcChatChannel(channelId) {
  return Object.values(channelStore.getAll()).some((entry) => entry.chat === channelId);
}

module.exports = {
  name: 'minecraftBridge',
  events: {
    messageCreate: async (client, message) => {
      if (message.author.bot) return;
      if (!isMcChatChannel(message.channelId)) return;

      const displayName = message.member?.nickname || message.author.globalName || message.author.username;
      wsServer.broadcast({ state: 'chat', message: `<${displayName}> ${message.content}` });
    },
  },
  async init(client) {
    wsServer.start(createMessageHandler(client));
  },
  async shutdown() {
    wsServer.stop();
  },
};
