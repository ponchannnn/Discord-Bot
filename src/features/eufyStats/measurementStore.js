const fs = require('fs');
const path = require('path');
const paths = require('../../config/paths');
const logger = require('../../infra/logger');

const STORE_FILE = path.join(paths.dataDir, 'eufy_measurement.json');

// { current, previous } の生measurementオブジェクトを保持する。
// after=<current.create_time> で差分取得するための基準値としても使う
function load() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') logger.error('[eufyStats] eufy_measurement.json の読み込みに失敗しました', err);
    return null;
  }
}

function save({ current, previous }) {
  fs.writeFileSync(STORE_FILE, JSON.stringify({ current, previous: previous || null }, null, 2), 'utf8');
}

module.exports = { load, save };
