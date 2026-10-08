const env = require('../../config/env');
const targets = require('../../config/targets');
const logger = require('../../infra/logger');
const messageStore = require('./messageStore');
const { runSync, ensurePlaceholder, UPDATE_EMOJI } = require('./sync');

module.exports = {
  name: 'eufyStats',
  events: {
    messageReactionAdd: async (client, reaction, user) => {
      if (user.bot) return;
      if (reaction.emoji.name !== UPDATE_EMOJI) return;
      if (reaction.message.id !== messageStore.getMessageId()) return;

      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (err) {
          logger.error('[eufyStats] リアクションの取得に失敗しました', err);
          return;
        }
      }

      await reaction.users
        .remove(user.id)
        .catch((err) =>
          logger.error('[eufyStats] リアクションの削除に失敗しました(チャンネルの「メッセージの管理」権限を確認してください)', err)
        );
      await runSync(client).catch((err) => logger.error('[eufyStats] 手動更新に失敗しました', err));
    },
  },

  // 自動同期は行わない。🔄リアクションが押された時のみ更新する
  async init(client) {
    if (!env.eufy.email || !env.eufy.password) {
      logger.warn('[eufyStats] EUFY_EMAIL/EUFY_PASSWORD が未設定のため機能を無効化します');
      return;
    }

    const { channelId } = targets.eufyStats;
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
      logger.warn('[eufyStats] targets.eufyStats.channelId が未設定/不正のためスキップします');
      return;
    }

    await ensurePlaceholder(channel).catch((err) => logger.error('[eufyStats] 初期化に失敗しました', err));
    logger.info('[eufyStats] 初期化完了(🔄リアクションで手動更新)');
  },
};
