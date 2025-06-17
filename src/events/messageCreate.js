const sendMessageToMinecraft = require('../utils/sendMessageToMinecraft');
const mcChannels = require('../utils/mcChannels');

let allChannels = mcChannels.getAll ? mcChannels.getAll() : require('../../mc_channels.json');

module.exports = (client, message) => {
  if (message.author.bot) return;

  const allChannels = mcChannels.getAll();
  let isMcChatChannel = false;
  let uuidMatched = null;

  for (const uuid in allChannels) {
    if (allChannels[uuid].chat === message.channel.id) {
      isMcChatChannel = true;
      uuidMatched = uuid;
      break;
    }
  }

  if (isMcChatChannel) {
    const displayName =
      message.member?.nickname ||
      message.author.globalName ||
      message.author.username;
    const formattedMessage = `<${displayName}> ${message.content}`;
    sendMessageToMinecraft(formattedMessage);
  }
};