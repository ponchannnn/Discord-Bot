const fs = require('fs');
const path = require('path');
const logger = require('../infra/logger');

const FEATURES_DIR = path.join(__dirname, '..', 'features');

function loadFeatures() {
  return fs
    .readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => require(path.join(FEATURES_DIR, entry.name)));
}

function registerFeatures(client) {
  const features = loadFeatures();

  for (const feature of features) {
    for (const [eventName, handler] of Object.entries(feature.events || {})) {
      client.on(eventName, async (...args) => {
        try {
          await handler(client, ...args);
        } catch (err) {
          logger.error(`[${feature.name}] "${eventName}" handler failed`, err);
        }
      });
    }
  }

  client.once('ready', async () => {
    // 並列実行にすることで、1機能の初期化が遅延/停止しても他機能をブロックしない
    await Promise.allSettled(
      features
        .filter((feature) => feature.init)
        .map(async (feature) => {
          try {
            await feature.init(client);
          } catch (err) {
            logger.error(`[${feature.name}] init failed`, err);
          }
        })
    );
  });

  return {
    shutdown: async () => {
      for (const feature of features) {
        if (!feature.shutdown) continue;
        try {
          await feature.shutdown();
        } catch (err) {
          logger.error(`[${feature.name}] shutdown failed`, err);
        }
      }
    },
  };
}

module.exports = registerFeatures;
