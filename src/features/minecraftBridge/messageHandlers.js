const ip = require('ip');
const logger = require('../../infra/logger');
const targets = require('../../config/targets');
const channelStore = require('./channelStore');

function createMessageHandler(client) {
  function getChannel(uuid, type) {
    const channelId = channelStore.get(uuid, type);
    return channelId ? client.channels.cache.get(channelId) : null;
  }

  const handlers = {
    join: (message) => {
      getChannel(message.uuid, 'log')?.send(`${message.player}さんが入室しました。ワールド内の人数:${message.playerCount}`);
    },
    quit: (message) => {
      getChannel(message.uuid, 'log')?.send(`${message.player}さんが退室しました。ワールド内の人数:${message.playerCount}`);
    },
    load: (message) => {
      getChannel(message.uuid, 'log')?.send(`${message.name}が開きました。`);
    },
    unload: (message) => {
      getChannel(message.uuid, 'log')?.send(`${message.name ? message.name : 'サーバー'}が閉じました。`);
    },
    chat: (message) => {
      getChannel(message.uuid, 'chat')?.send(`<${message.player}>${message.message}`);
    },
    setIpMessage: () => {
      const me = client.users.cache.get(targets.botOwnerUserId);
      if (!me) {
        logger.error('[minecraftBridge] Owner user not found for setIpMessage');
        return;
      }
      const now = new Date();
      me.send(
        `✅ Ubuntuが開きました！\n🕒 時刻: ${now.getHours()}時${now.getMinutes()}分${now.getSeconds()}秒\n🌐 IPアドレス: ${ip.address()}`
      );
    },
  };

  return (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (err) {
      logger.error('[minecraftBridge] Failed to parse WS message', err);
      return;
    }
    handlers[message.state]?.(message);
  };
}

module.exports = createMessageHandler;
