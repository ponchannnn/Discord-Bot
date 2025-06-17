const fs = require('fs');
const path = require('path');
const CHANNELS_FILE = path.join(__dirname, '../mc_channels.json');

let mcChannels = {};
function load() {
  try {
    mcChannels = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
  } catch (e) {
    mcChannels = {};
  }
}
function save() {
  fs.writeFileSync(CHANNELS_FILE, JSON.stringify(mcChannels, null, 2), 'utf8');
}
function get(uuid, type) {
  return mcChannels[uuid]?.[type] || null;
}
function set(uuid, type, channelId) {
  if (!mcChannels[uuid]) mcChannels[uuid] = {};
  mcChannels[uuid][type] = channelId;
  save();
}
function getAll() {
  return mcChannels;
}
load();

module.exports = { get, set, getAll , load };