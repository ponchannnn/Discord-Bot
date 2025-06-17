const WebSocket = require('ws');
const handlers = require('./handlers');
const PORT = 31795;

const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.on('message', (data) => handlers.onMessage(ws, data));
  ws.on('close', () => console.log('WebSocket client disconnected'));
  ws.on('error', (err) => console.error('WebSocket error:', err));
});

module.exports = wss;