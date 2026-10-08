// Discord関連ID設定の一元管理。
// 秘匿情報ではないが、意味の分からない値がロジックに散らばるのを防ぐためここに集約する。

module.exports = {
  // 各種通知をDMで受け取るBot管理者
  botOwnerUserId: '739006634533060702',

  // warn/errorログの送信先チャンネル (infra/logger)
  logging: {
    guildId: '1235463523581296692',
    channelId: '1384431966404743178',
  },

  // 特定ユーザーのオンライン状況をDM通知する機能 (features/presenceWatch)
  presenceWatch: {
    guildId: '1205961095760580679', // Minecraft just win server
    watchedUserId: '745279748053401601', // Sora
  },

  // 特定メンバーのVC入室を告知する機能 (features/vcJoinAnnounce)
  vcJoinAnnounce: {
    guildId: '1194537981135036446', // ponTensai server
    watchedMemberId: '970321331428139008', // yukarin
    announceChannelId: '1194537981583831102',
  },

  // VC/メッセージ統計の収集対象 (features/statsCollecting)
  statsCollecting: {
    targetGuilds: [
      '1386059625685586032',
      '1303784382015864952',
      '1235463523581296692',
    ],
    // 'all' を指定すると全ユーザーを対象にできる
    targetUsers: [
      '739006634533060702',
      '799983553559396382',
      '745279748053401601',
      '970321331428139008',
      '394623363651338240',
    ],
  },
};
