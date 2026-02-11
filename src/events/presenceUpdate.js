module.exports = async (client, o, n) => {
  const me = client.users.cache.get("739006634533060702");
  if (!o) return;
  if (o.userId != "745279748053401601") return;
  if (o.guild.id != "1205961095760580679") return;
  const nowD = new Date();
  if (o.status != n.status) {
    me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒に${o.status}から${n.clientStatus ? (n.clientStatus.desktop ? "デスクトップで" : n.clientStatus.mobile ? "モバイルで" : n.clientStatus.web ? "ウェブサイトで" : "") : ""}${n.status}になりました。`);
    await updateStatusFile(n.status);
  } else if (JSON.stringify(o.clientStatus) != JSON.stringify(n.clientStatus)) {
    if (!o.clientStatus.desktop && o.clientStatus.mobile && n.clientStatus.desktop) {
      me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒にスマホからPC:${n.clientStatus.desktop}になりました。`);
    } else if (o.clientStatus.desktop && !n.clientStatus.desktop && !n.clientStatus.mobile)
      me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒にPCからスマホ:${n.clientStatus.mobile}になりました。`);
    else if (o.clientStatus.desktop && !o.clientStatus.mobile && n.clientStatus.desktop && !n.clientStatus.mobile)
      me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒にPC中にスマホ:${n.clientStatus.mobile}になりました。`);
  } else if (!o.activities[0] && n.activities[0] && n.activities[0].name !== "Hang Status")
    me.send(`${o.user.globalName}さんが${n.activities[0].timestamps.start.getHours()}時${n.activities[0].timestamps.start.getMinutes()}分${n.activities[0].timestamps.start.getSeconds()}秒に${n.activities[0].name}を始めました。`);
  else if (o.activities[0] && !n.activities[0] && o.activities[0].name !== "Hang Status")
    me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒に${o.activities[0].name}をやめました。`);
  else if (o.activities[0] && n.activities[0] && o.activities[0].name !== "Hang Status" && n.activities[0].name !== "Hang Status" && o.activities[0].name !== n.activities[0].name)
    me.send(`${o.user.globalName}さんが${nowD.getHours()}時${nowD.getMinutes()}分${nowD.getSeconds()}秒に${o.activities[0].name}から${n.activities[0].name}に変更しました。`);
};

async function updateStatusFile(statusText) {
  const fs = require("fs");
  const path = "/tmp/discord_status.txt";
  fs.writeFileSync(path, statusText);
}