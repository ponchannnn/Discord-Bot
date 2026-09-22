const env = require('./config/env');
const logger = require('./infra/logger');
const redis = require('./infra/redis');
const createClient = require('./bot/client');
const registerFeatures = require('./bot/registerFeatures');

const client = createClient();
const lifecycle = registerFeatures(client);

client.login(env.discordToken);

const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down...`);
  await lifecycle.shutdown();
  await redis.quit();
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = client;
