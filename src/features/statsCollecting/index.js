const db = require('./repository');
const targets = require('../../config/targets');
const logger = require('../../infra/logger');

const voiceSessions = new Map();
const muteSessions = new Map();

function isTarget(guildId, userId, userBot) {
  if (userBot) return false;
  const { targetGuilds, targetUsers } = targets.statsCollecting;
  if (!targetGuilds.includes(guildId)) return false;
  if (targetUsers !== 'all' && !targetUsers.includes(userId)) return false;
  return true;
}

function endVoiceSession(userId) {
  const session = voiceSessions.get(userId);
  if (session) {
    db.saveVoiceSession(userId, session.guildId, session.channelId, session.startTime, Date.now());
    voiceSessions.delete(userId);
  }
}

function endMuteSession(userId) {
  const session = muteSessions.get(userId);
  if (session) {
    db.saveMuteLog(userId, session.guildId, session.channelId, session.startTime, Date.now(), session.type);
    muteSessions.delete(userId);
  }
}

module.exports = {
  name: 'statsCollecting',
  events: {
    messageCreate: async (client, message) => {
      if (!message.guild || !isTarget(message.guild.id, message.author.id, message.author.bot)) return;
      const charCount = message.content.length;
      const hasImage = message.attachments.size > 0;
      db.saveMessageLog(message.author.id, message.guild.id, message.channelId, message.id, charCount, hasImage, message.content);
    },

    voiceStateUpdate: async (client, oldState, newState) => {
      const userId = newState.member.id;
      const guildId = newState.guild.id;
      if (!isTarget(guildId, userId, newState.member.user.bot)) return;

      const now = Date.now();
      const wasMuted = muteSessions.has(userId);
      const isMuted = newState.selfMute || newState.selfDeaf;
      const muteType = newState.selfDeaf ? 'deaf' : 'mute';

      // 退出処理
      if (oldState.channelId && !newState.channelId) {
        endMuteSession(userId);
        endVoiceSession(userId);
        return;
      }

      // 移動処理
      if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        endVoiceSession(userId);
        endMuteSession(userId);

        voiceSessions.set(userId, { startTime: now, guildId, channelId: newState.channelId });
        if (isMuted) {
          muteSessions.set(userId, { startTime: now, guildId, channelId: newState.channelId, type: muteType });
        }
        return;
      }

      // 入室処理
      if (!oldState.channelId && newState.channelId) {
        voiceSessions.set(userId, { startTime: now, guildId, channelId: newState.channelId });
        if (isMuted) {
          muteSessions.set(userId, { startTime: now, guildId, channelId: newState.channelId, type: muteType });
        }
        return;
      }

      // 同じチャンネル内での状態変化 (ミュートON/OFF)
      if (oldState.channelId === newState.channelId) {
        if (!wasMuted && isMuted) {
          muteSessions.set(userId, { startTime: now, guildId, channelId: newState.channelId, type: muteType });
        } else if (wasMuted && !isMuted) {
          endMuteSession(userId);
        }
      }
    },
  },

  async init(client) {
    client.guilds.cache.forEach((guild) => {
      if (!targets.statsCollecting.targetGuilds.includes(guild.id)) return;

      guild.voiceStates.cache.forEach((state) => {
        if (!isTarget(guild.id, state.member.id, state.member.user.bot)) return;
        if (!state.channelId) return;

        const now = Date.now();
        voiceSessions.set(state.member.id, { startTime: now, guildId: guild.id, channelId: state.channelId });
        if (state.selfMute || state.selfDeaf) {
          muteSessions.set(state.member.id, {
            startTime: now,
            guildId: guild.id,
            channelId: state.channelId,
            type: state.selfDeaf ? 'deaf' : 'mute',
          });
        }
      });
    });
    logger.info('[statsCollecting] VC監視を開始しました');
  },

  async shutdown() {
    for (const userId of voiceSessions.keys()) endVoiceSession(userId);
    for (const userId of muteSessions.keys()) endMuteSession(userId);
    logger.info('[statsCollecting] 完了');
  },
};
