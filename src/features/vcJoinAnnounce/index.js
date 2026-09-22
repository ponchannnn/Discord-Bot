const targets = require('../../config/targets');

module.exports = {
  name: 'vcJoinAnnounce',
  events: {
    voiceStateUpdate: async (client, oldState, newState) => {
      const { guildId, watchedMemberId, announceChannelId } = targets.vcJoinAnnounce;
      if (oldState.guild.id !== guildId) return;
      if (oldState.member.id !== watchedMemberId) return;
      if (oldState.channelId !== null || newState.channelId === null) return;

      const channel = client.channels.cache.get(announceChannelId);
      channel?.send(
        `@everyone ${newState.member.user.globalName}さんが${newState.guild.name}の${newState.channel.name}に入室しました。`
      );
    },
  },
};
