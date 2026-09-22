const redis = require('redis');
const env = require('../config/env');
const logger = require('./logger');

const client = redis.createClient(env.redisUrl ? { url: env.redisUrl } : undefined);
client.on('error', (err) => logger.error('[redis] Client error', err));

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
