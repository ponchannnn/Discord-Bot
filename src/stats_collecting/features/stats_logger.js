const db = require('../stats_db');
const config = require('../stats_config.json');

const voiceSessions = new Map();
const muteSessions = new Map();

function isTarget(guildId, userId, userBot) {
  if (userBot) return false;
  if (!config.targetGuilds.includes(guildId)) return false;
  if (config.targetUsers !== "all" && !config.targetUsers.includes(userId)) return false;
  return true;
}

module.exports = (client) => {
    // 共通処理: セッション終了
  const endVoiceSession = (userId) => {
    const session = voiceSessions.get(userId);
    if (session) {
      db.saveVoiceSession(userId, session.guildId, session.channelId, session.startTime, Date.now());
      voiceSessions.delete(userId);
    }
  };

  // 共通処理: ミュート終了
  const endMuteSession = (userId) => {
    const session = muteSessions.get(userId);
    if (session) {
      db.saveMuteLog(userId, session.guildId, session.channelId, session.startTime, Date.now(), session.type);
      muteSessions.delete(userId);
    }
  };

  client.on('ready', () => {
    client.guilds.cache.forEach(guild => {
        if (!config.targetGuilds.includes(guild.id)) return;

      guild.voiceStates.cache.forEach(state => {
        if (!isTarget(guild.id, state.member.id, state.member.user.bot)) return;
        if (!state.channelId) return;

        const now = Date.now();
        voiceSessions.set(state.member.id, {
            startTime: now,
            guildId: guild.id,
            channelId: state.channelId
        });
        if (state.selfMute || state.selfDeaf) {
            muteSessions.set(state.member.id, {
                startTime: now,
                guildId: guild.id,
                channelId: state.channelId,
                type: state.selfDeaf ? 'deaf' : 'mute'
            });
        }
      });
    });
    console.log('[Stats] VC監視を開始しました');
  });

  // メッセージ集計
  client.on('messageCreate', message => {
    if (!message.guild || !isTarget(message.guild.id, message.author.id, message.author.bot)) return;
    const charCount = message.content.length;
    const hasImage = message.attachments.size > 0;
    db.saveMessageLog(message.author.id, message.guild.id, message.channelId, charCount, hasImage);
  });

  // VC状態監視
  client.on('voiceStateUpdate', (oldState, newState) => {
    const userId = newState.member.id;
    const guildId = newState.guild.id;
    if (!isTarget(guildId, userId, newState.member.user.bot)) return;

    // 入室
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

    voiceSessions.set(userId, { 
        startTime: now, 
        guildId: guildId, 
        channelId: newState.channelId 
    });
    if (isMuted) {
        muteSessions.set(userId, { 
            startTime: now, 
            guildId: guildId, 
            channelId: newState.channelId, 
            type: muteType 
        });
    }
    return;
    }

    // 入室処理
    if (!oldState.channelId && newState.channelId) {
      voiceSessions.set(userId, { 
          startTime: now, 
          guildId: guildId, 
          channelId: newState.channelId 
      });
      if (isMuted) {
        muteSessions.set(userId, { 
            startTime: now, 
            guildId: guildId, 
            channelId: newState.channelId, 
            type: muteType 
        });
      }
      return;
    }

    // 同じチャンネル内での状態変化 (ミュートON/OFF)
    if (oldState.channelId === newState.channelId) {
        // ミュート開始 (OFF -> ON)
        if (!wasMuted && isMuted) {
            muteSessions.set(userId, {
                startTime: now,
                guildId: guildId,
                channelId: newState.channelId,
                type: muteType
            });
        }
        // ミュート終了 (ON -> OFF)
        else if (wasMuted && !isMuted) {
            endMuteSession(userId);
        }
    }
  });

  // シャットダウン時の保存処理を公開
  return {
    saveAndExit: () => {
      for (const userId of voiceSessions.keys()) endVoiceSession(userId);
      for (const userId of muteSessions.keys()) endMuteSession(userId);
      console.log('[Stats] 完了');
    }
  };
};