const WebSocket = require('ws');
const logger = require('../../infra/logger');

const WS_PORT = 31795;
let wss = null;

function start(onMessage) {
  wss = new WebSocket.Server({ port: WS_PORT });
  wss.on('connection', (ws) => {
    logger.info('[minecraftBridge] WebSocket client connected');
    ws.on('message', (data) => onMessage(data));
    ws.on('close', () => logger.info('[minecraftBridge] WebSocket client disconnected'));
    ws.on('error', (err) => logger.error('[minecraftBridge] WebSocket error', err));
  });
  logger.info(`[minecraftBridge] WebSocket server listening on port ${WS_PORT}`);
}

function stop() {
  wss?.close();
  wss = null;
}

function broadcast(payload) {
  if (!wss) return;
  const data = JSON.stringify(payload);
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(data);
      } catch (err) {
        logger.error('[minecraftBridge] Failed to send message to Minecraft', err);
      }
    }
  });
}

module.exports = { start, stop, broadcast };
