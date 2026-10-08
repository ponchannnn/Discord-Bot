const fs = require('fs');
const path = require('path');
const paths = require('../../config/paths');
const logger = require('../../infra/logger');

const STORE_FILE = path.join(paths.dataDir, 'eufy_message.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') logger.error('[eufyStats] eufy_message.json の読み込みに失敗しました', err);
    return {};
  }
}

// 現在🔄リアクションが付いている最新メッセージのID(メッセージは編集せず追加していく方式のため、
// どのメッセージが「今押せるボタン」かをここで追跡する)
function getMessageId() {
  return load().messageId || null;
}

function setMessageId(messageId) {
  fs.writeFileSync(STORE_FILE, JSON.stringify({ messageId }, null, 2), 'utf8');
}

module.exports = { getMessageId, setMessageId };
