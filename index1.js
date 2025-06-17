//ip使う
// npm i ip
// npm i ws
// npm i dotenv
const ip = require('ip');
const fs = require('fs');
const path = require('path');
const CHANNELS_FILE = path.join(__dirname, 'mc_channels.json');

//dotenvの適用
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, Client, GatewayIntentBits, MessageFlags } = require("discord.js");
// クライアントインスタンスと呼ばれるオブジェクトを作成します
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const commands = [
  new SlashCommandBuilder()
    .setName('mcset')
    .setDescription('MinecraftのUUIDとチャンネルを紐付け')
    .addStringOption(opt => opt.setName('uuid').setDescription('MinecraftのUUID').setRequired(true))
    .addStringOption(opt => opt.setName('type').setDescription('logかchat').setRequired(true).addChoices(
      { name: 'log', value: 'log' },
      { name: 'chat', value: 'chat' }
    ))
    .addChannelOption(opt => opt.setName('channel').setDescription('紐付けるチャンネル').setRequired(true))
    .toJSON()
];

// クライアントオブジェクトが準備OKとなったとき一度だけ実行されます
client.once("ready", (c) => {
  console.log(`Logged in with ${c.user.tag} n now on ready!`);
});

client.on("presenceUpdate", (o, n) => {
  const me = client.users.cache.get("739006634533060702");
  if (!o) return;
  // TODO: オフラインからオンラインになるときの機構が怪しい
  if (o.userId != "745279748053401601") return; // Sora account
  if (o.guild.id != "1205961095760580679") return; // Minecraft just win server
  // if (o.userId == "739006634533060702") return;
  const nowD = new Date();
  if (o.status != n.status) {
    me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒に${o.status}から${n.clientStatus ? (n.clientStatus.desktop ? "デスクトップで" : n.clientStatus.mobile ? "モバイルで" : n.clientStatus.web ? "ウェブサイトで" : "") : ""}${n.status}になりました。`);
  } else if (JSON.stringify(o.clientStatus) != JSON.stringify(n.clientStatus)) {
    // if renew status
    if (!o.clientStatus.desktop && o.clientStatus.mobile && n.clientStatus.desktop) { // mobile to desktop
      me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒にスマホからPC:${n.clientStatus.desktop}になりました。`);
    } else if (o.clientStatus.desktop && !n.clientStatus.desktop && !n.clientStatus.mobile)
      me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒にPCからスマホ:${n.clientStatus.mobile}になりました。`); // desktop to mobile
    else if (o.clientStatus.desktop && !o.clientStatus.mobile && n.clientStatus.desktop && !n.clientStatus.mobile)
      me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒にPC中にスマホ:${n.clientStatus.mobile}になりました。`); // desktop to mobile desktop
  } else if (!o.activities[0] && n.activities[0] && n.activities[0].name !== "Hang Status")
    me.send(`${o.user.globalName}さんが${n.activities[0].timestamps.start.getHours()}時${n.activities[0].timestamps.start.getMinutes()}分${n.activities[0].timestamps.start.getSeconds()}秒に${n.activities[0].name}を始めました。`); // start activity
  else if (o.activities[0] && !n.activities[0] && o.activities[0].name !== "Hang Status")
    me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒に${o.activities[0].name}をやめました。`); // stop activity
  else if (o.activities[0] && n.activities[0] && o.activities[0].name !== "Hang Status" && n.activities[0].name !== "Hang Status" && o.activities[0].name !== n.activities[0].name)
    me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒に${o.activities[0].name}から${n.activities[0].name}に変更しました。`); // renew activity
});

client.on("voiceStateUpdate", (o, n) => {
  if (o.guild.id !== "1194537981135036446") return; // ponTensai server
  if (o.member.id !== "970321331428139008") return; // yukarin
  const textChennel = client.channels.cache.get('1194537981583831102');
  if (o.channelId === null && n.channelId !== null)
    textChennel.send(
      `@everyone ${n.member.user.globalName}さんが${n.guild.name}の${n.channel.name}に入室しました。`
    ); // comment
});

// Listen for messages
client.on("messageCreate", (message) => {
  if (message.channel.id === "1362343562053812294" && !message.author.bot) {
    const formattedMessage = `<${message.author.username}> ${message.content}`;
    sendMessageToMinecraft(formattedMessage);
  }
});

// ログインします
client.login(process.env.TOKEN);

const WebSocket = require('ws');

const PORT = 31795;

const wss = new WebSocket.Server({ port: PORT });

// 紐付け情報のロード
let mcChannels = {};
function loadMcChannels() {
  try {
    mcChannels = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
  } catch (e) {
    mcChannels = {};
  }
}
function saveMcChannels() {
  fs.writeFileSync(CHANNELS_FILE, JSON.stringify(mcChannels, null, 2), 'utf8');
}
loadMcChannels();

// 紐付け取得ヘルパー
function getChannelId(uuid, type) {
  return mcChannels[uuid]?.[type] || null;
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'mcSet') {
    const uuid = interaction.options.getString('uuid');
    const type = interaction.options.getString('type'); // 'log' or 'chat'
    const channel = interaction.options.getChannel('channel');
    if (!uuid || !['log', 'chat'].includes(type) || !channel) {
      await interaction.reply({ content: '引数が正しくありません。', ephemeral: true });
      return;
    }
    if (!mcChannels[uuid]) mcChannels[uuid] = {};
    mcChannels[uuid][type] = channel.id;
    saveMcChannels();
    await interaction.reply({ content: `UUID:${uuid} の ${type} チャンネルを ${channel.name} に設定しました。`, ephemeral: true });
  }
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received JSON:', message);

      switch (message.state) {
        case "join":
          onJoin(message);
          break;
        case "quit":
          onQuit(message);
          break;
        case "load":
          onLoad(message);
          break;
        case "chat":
          onChat(message);
          break;
        case "unload":
          onUnload(message);
          break;
        case "setIpMessage":
          onSetIpMessage();
          break;
      }
    } catch (error) {
      console.error('Failed to parse JSON:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

function onJoin(message) {
  const channelId = getChannelId(message.uuid, 'log');
  if (channelId) {
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
  if (channelId) {
    const logChannel = client.channels.cache.get(channelId);
    logChannel?.send(`${message.name}が開きました。`);
  }
}
function onChat(message) {
  const channelId = getChannelId(message.uuid, 'chat');
  if (channelId) {
    const chatChannel = client.channels.cache.get(channelId);
    chatChannel?.send(`<${message.player}>${message.message}`);
  }
}
function onUnload(message) {
  const channelId = getChannelId(message.uuid, 'log');
  if (channelId) {
    const logChannel = client.channels.cache.get(channelId);
    logChannel?.send(`${message.name ? message.name : "サーバー"}が閉じました。`);
  }
}

function onSetIpMessage () {
  const me = client.users.cache.get("739006634533060702");
  if (!me) {
    console.error("ユーザーが見つかりませんでした。IDを確認してください。");
    return;
  }

  const myIp = ip.address(); // 自分のIPアドレス取得（デフォルトでローカルIP）
  const now = new Date();
  
  me.send(`✅ Ubuntuが開きました！\n🕒 時刻: ${now.getHours()}時${now.getMinutes()}分${now.getSeconds()}秒\n🌐 IPアドレス: ${myIp}`);
  
  console.log(`Sent IP message: ${myIp}`);
}

function sendMessageToMinecraft(chatMessage) {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ state: "chat", message: chatMessage }));
      } catch (err) {
        console.error("Minecraftへのメッセージ送信中にエラー:", err);
      }
    }
  });
}