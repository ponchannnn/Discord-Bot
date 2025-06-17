module.exports = (client, o, n) => {
  if (o.guild.id !== "1194537981135036446") return; // ponTensai server
  if (o.member.id !== "970321331428139008") return; // yukarin
  const textChennel = client.channels.cache.get('1194537981583831102');
  if (o.channelId === null && n.channelId !== null)
    textChennel.send(
      `@everyone ${n.member.user.globalName}さんが${n.guild.name}の${n.channel.name}に入室しました。`
    );
};