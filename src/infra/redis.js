const redis = require('redis');
const env = require('../config/env');
const logger = require('./logger');

const MAX_RECONNECT_ATTEMPTS = 10;

const client = redis.createClient({
  ...(env.redisUrl ? { url: env.redisUrl } : {}),
  socket: {
    // デフォルトは無限リトライで connect() が永遠にpendingのままになるため上限を設ける
    reconnectStrategy: (retries) => {
      if (retries > MAX_RECONNECT_ATTEMPTS) {
        return new Error('redis reconnect attempts exhausted');
      }
      return Math.min(retries * 200, 3000);
    },
  },
});
let loggedConnectionError = false;
client.on('error', (err) => {
  // 接続できない間はリトライのたびにエラーが飛んでくるため、ログの氾濫を防ぐ
  if (loggedConnectionError) return;
  loggedConnectionError = true;
  logger.error('[redis] Client error', err);
});
client.on('connect', () => {
  loggedConnectionError = false;
});

let connectPromise = null;
function connect() {
  if (!connectPromise) {
    connectPromise = client
      .connect()
      .then(() => logger.info('[redis] Connected'))
      .catch((err) => {
        logger.error('[redis] Failed to connect', err);
        connectPromise = null;
      });
  }
  return connectPromise;
}

async function quit() {
  if (client.isOpen) await client.quit();
}

module.exports = { client, connect, quit };
