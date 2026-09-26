const env = require('./config/env');
const targets = require('./config/targets');
const logger = require('./infra/logger');
const redis = require('./infra/redis');
const createClient = require('./bot/client');
const registerFeatures = require('./bot/registerFeatures');

const client = createClient();
const lifecycle = registerFeatures(client);

client.once('ready', () => logger.attachDiscord(client, targets.botOwnerUserId));
client.login(env.discordToken);

const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down...`);
  await lifecycle.shutdown();
  await redis.quit();
  await logger.flush();
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = client;
