const logger = require('../../infra/logger');
const redis = require('../../infra/redis');
const targets = require('../../config/targets');

function formatTime(date) {
  return `${date.getHours()}時${date.getMinutes()}分${date.getSeconds()}秒`;
}

async function updateStatusRedis(statusText) {
  try {
    await redis.client.set('discord_status', statusText);
  } catch (err) {
    logger.error('[presenceWatch] Failed to update redis status', err);
  }
}

module.exports = {
  name: 'presenceWatch',
  events: {
    presenceUpdate: async (client, oldPresence, newPresence) => {
      const { guildId, watchedUserId } = targets.presenceWatch;
      if (!oldPresence) return;
      if (oldPresence.userId !== watchedUserId) return;
      if (oldPresence.guild.id !== guildId) return;

      const me = client.users.cache.get(targets.botOwnerUserId);
      if (!me) return;

      const o = oldPresence;
      const n = newPresence;
      const now = formatTime(new Date());

      if (o.status !== n.status) {
        const via = n.clientStatus
          ? n.clientStatus.desktop
            ? 'デスクトップで'
            : n.clientStatus.mobile
              ? 'モバイルで'
              : n.clientStatus.web
                ? 'ウェブサイトで'
                : ''
          : '';
        await me.send(`${o.user.globalName}さんが${now}に${o.status}から${via}${n.status}になりました。`);
        await updateStatusRedis(n.status);
      } else if (JSON.stringify(o.clientStatus) !== JSON.stringify(n.clientStatus)) {
        if (!o.clientStatus.desktop && o.clientStatus.mobile && n.clientStatus.desktop) {
          await me.send(`${o.user.globalName}さんが${now}にスマホからPC:${n.clientStatus.desktop}になりました。`);
        } else if (o.clientStatus.desktop && !n.clientStatus.desktop && !n.clientStatus.mobile) {
          await me.send(`${o.user.globalName}さんが${now}にPCからスマホ:${n.clientStatus.mobile}になりました。`);
        } else if (o.clientStatus.desktop && !o.clientStatus.mobile && n.clientStatus.desktop && !n.clientStatus.mobile) {
          await me.send(`${o.user.globalName}さんが${now}にPC中にスマホ:${n.clientStatus.mobile}になりました。`);
        }
      } else if (!o.activities[0] && n.activities[0] && n.activities[0].name !== 'Hang Status') {
        const start = formatTime(n.activities[0].timestamps.start);
        await me.send(`${o.user.globalName}さんが${start}に${n.activities[0].name}を始めました。`);
      } else if (o.activities[0] && !n.activities[0] && o.activities[0].name !== 'Hang Status') {
        await me.send(`${o.user.globalName}さんが${now}に${o.activities[0].name}をやめました。`);
      } else if (
        o.activities[0] &&
        n.activities[0] &&
        o.activities[0].name !== 'Hang Status' &&
        n.activities[0].name !== 'Hang Status' &&
        o.activities[0].name !== n.activities[0].name
      ) {
        await me.send(`${o.user.globalName}さんが${now}に${o.activities[0].name}から${n.activities[0].name}に変更しました。`);
      }
    },
  },
  async init() {
    await redis.connect();
  },
};
