const mcChannels = require('../utils/mcChannels');
const ip = require('ip');
let client = null;

function setClient(discordClient) {
  client = discordClient;
}

function getChannelId(uuid, type) {
  return mcChannels.get(uuid, type);
}

function onJoin(message) {
  const channelId = getChannelId(message.uuid, 'log');
  if (channelId && client) {
    const logChannel = client.channels.cache.get(channelId);
    logChannel?.send(`${message.player}さんが入室しました。ワールド内の人数:${message.playerCount}`);
  }
}
function onQuit(message) {
  const channelId = getChannelId(message.uuid, 'log');
  if (channelId) {
    const logChannel = client.channels.cache.get(channelId);
    logChannel?.send(`${message.player}さんが退室しました。ワールド内の人数:${message.playerCount}`);
  }
}
function onLoad(message) {
  const channelId = getChannelId(message.uuid, 'log');
  if (channelId && client) {
    const logChannel = client.channels.cache.get(channelId);
    logChannel?.send(`${message.name}が開きました。`);
  }
}
function onChat(message) {
  const channelId = getChannelId(message.uuid, 'chat');
  if (channelId && client) {
    const chatChannel = client.channels.cache.get(channelId);
    chatChannel?.send(`<${message.player}>${message.message}`);
  }
}
function onUnload(message) {
  const channelId = getChannelId(message.uuid, 'log');
  if (channelId && client) {
    const logChannel = client.channels.cache.get(channelId);
    logChannel?.send(`${message.name ? message.name : "サーバー"}が閉じました。`);
  }
}
function onSetIpMessage() {
  const me = client.users.cache.get("739006634533060702");
  if (!me) {
    console.error("ユーザーが見つかりませんでした。IDを確認してください。");
    return;
  }
  const myIp = ip.address();
  const now = new Date();
  me.send(`✅ Ubuntuが開きました！\n🕒 時刻: ${now.getHours()}時${now.getMinutes()}分${now.getSeconds()}秒\n🌐 IPアドレス: ${myIp}`);
  console.log(`Sent IP message: ${myIp}`);
}

function onMessage(ws, data) {
  try {
    const message = JSON.parse(data.toString());
    switch (message.state) {
      case "join": onJoin(message); break;
      case "quit": onQuit(message); break;
      case "load": onLoad(message); break;
      case "chat": onChat(message); break;
      case "unload": onUnload(message); break;
      case "setIpMessage": onSetIpMessage(); break;
    }
  } catch (error) {
    console.error('Failed to parse JSON:', error);
  }
}

module.exports = { onMessage, setClient };