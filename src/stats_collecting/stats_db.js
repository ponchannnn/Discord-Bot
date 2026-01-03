// db.js
const Database = require('better-sqlite3');
const db = new Database('server_stats.db');

// テーブルの初期化
db.exec(`
  -- VC滞在ログ
  CREATE TABLE IF NOT EXISTS voice_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    guild_id TEXT,
    channel_id TEXT,
    start_time INTEGER,
    end_time INTEGER,
    duration_seconds INTEGER
  );

  -- ミュートログ
  CREATE TABLE IF NOT EXISTS mute_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    guild_id TEXT,
    channel_id TEXT,
    start_time INTEGER,
    end_time INTEGER,
    duration_seconds INTEGER,
    type TEXT
  );

  -- メッセージログ
  CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    guild_id TEXT,
    channel_id TEXT,
    timestamp INTEGER,
    char_count INTEGER,
    has_image INTEGER -- 0 or 1
  );
`);

module.exports = {
  saveVoiceSession: (userId, guildId, channelId, startTime, endTime) => {
    const duration = Math.floor((endTime - startTime) / 1000);
    const stmt = db.prepare('INSERT INTO voice_logs (user_id, guild_id, channel_id, start_time, end_time, duration_seconds) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(userId, guildId, channelId, startTime, endTime, duration);
  },
  // ミュート記録保存
  saveMuteLog: (userId, guildId, channelId, startTime, endTime, type) => {
    const duration = Math.floor((endTime - startTime) / 1000);
    if (duration < 1) return;
    
    const stmt = db.prepare('INSERT INTO mute_logs (user_id, guild_id, channel_id, start_time, end_time, duration_seconds, type) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(userId, guildId, channelId, startTime, endTime, duration, type);
  },
  // メッセージ統計保存
  saveMessageLog: (userId, guildId, channelId, charCount, hasImage) => {
    const stmt = db.prepare('INSERT INTO message_logs (user_id, guild_id, channel_id, timestamp, char_count, has_image) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(userId, guildId, channelId, Date.now(), charCount, hasImage ? 1 : 0);
  },
};