const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');

const LEVELS = { info: 0, warn: 1, error: 2 };
const DM_MIN_LEVEL = LEVELS[process.env.LOG_DM_LEVEL] ?? LEVELS.warn;
const DISCORD_MESSAGE_LIMIT = 2000;
const LOG_DIR = path.join(paths.dataDir, 'logs');

let client = null;
let ownerId = null;
// DM送信を直列化して順序を保つ
let sendChain = Promise.resolve();

function format(level, args) {
  const body = args
    .map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${body}`;
}

// ここで失敗してもloggerを再帰的に呼ばないよう console のみ使う
function writeToFile(line) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const file = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(file, line + '\n', 'utf8');
  } catch (err) {
    console.error('[logger] Failed to write log file', err);
  }
}

async function sendToOwner(line) {
  if (!client?.isReady()) throw new Error('Discord client not ready');
  const owner = await client.users.fetch(ownerId);
  const text = line.length > DISCORD_MESSAGE_LIMIT - 10 ? line.slice(0, DISCORD_MESSAGE_LIMIT - 10) + '…' : line;
  await owner.send('```\n' + text.replace(/```/g, "'''") + '\n```');
}

function log(level, args) {
  const line = format(level, args);
  const consoleFn = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error;
  consoleFn(line);

  if (LEVELS[level] < DM_MIN_LEVEL) return;
  if (!ownerId) {
    writeToFile(line);
    return;
  }
  sendChain = sendChain
    .then(() => sendToOwner(line))
    .catch(() => writeToFile(line));
}

// ready後に呼ぶ。それまでのDM対象ログはファイルに貯まる
function attachDiscord(discordClient, ownerUserId) {
  client = discordClient;
  ownerId = ownerUserId;
}

module.exports = {
  info: (...args) => log('info', args),
  warn: (...args) => log('warn', args),
  error: (...args) => log('error', args),
  attachDiscord,
  // シャットダウン前に未送信のDMを流し切る
  flush: () => sendChain,
};
