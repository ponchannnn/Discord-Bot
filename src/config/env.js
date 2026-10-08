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
  // eufy Life(体重計)連携 (features/eufyStats)。email/passwordが未設定ならfeature側で無効化する
  eufy: {
    email: process.env.EUFY_EMAIL,
    password: process.env.EUFY_PASSWORD,
    // APKから抽出された固定値。ユーザー固有の秘密ではないが念のため上書き可能にしておく
    clientId: process.env.EUFY_CLIENT_ID || 'eufy-app',
    clientSecret: process.env.EUFY_CLIENT_SECRET || '8FHf22gaTKu7MZXqz5zytw',
  },
};
