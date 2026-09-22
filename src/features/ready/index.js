const logger = require('../../infra/logger');

module.exports = {
  name: 'ready',
  events: {},
  async init(client) {
    logger.info(`Logged in as ${client.user.tag}`);
  },
};
