require('dotenv').config();

const required = ['TOKEN'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  discordToken: process.env.TOKEN,
  // 未設定ならredisクライアントのデフォルト接続先(localhost:6379)を使う
  redisUrl: process.env.REDIS_URL,
};
