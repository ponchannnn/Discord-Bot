const wss = require('../ws/server');
module.exports = function sendMessageToMinecraft(chatMessage) {
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify({ state: "chat", message: chatMessage }));
      } catch (err) {
        console.error("Minecraftへのメッセージ送信中にエラー:", err);
      }
    }
  });
};