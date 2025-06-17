const mcChannels = require('../utils/mcChannels');
module.exports = async (client, interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'mcSet') {
    const uuid = interaction.options.getString('uuid');
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');
    if (!uuid || !['log', 'chat'].includes(type) || !channel) {
      await interaction.reply({ content: '引数が正しくありません。', ephemeral: true });
      return;
    }
    mcChannels.set(uuid, type, channel.id);
    await interaction.reply({ content: `UUID:${uuid} の ${type} チャンネルを ${channel.name} に設定しました。`, ephemeral: true });
  }
};