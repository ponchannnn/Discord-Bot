const fs = require('fs');
const path = require('path');
const paths = require('../../config/paths');
const env = require('../../config/env');
const logger = require('../../infra/logger');

const TOKEN_FILE = path.join(paths.dataDir, 'eufy_token.json');
const BASE_URL = 'https://home-api.eufylife.com/v1';

// リフレッシュ専用エンドポイントは非公開のため、期限切れ前は再ログインで更新する
const EXPIRY_MARGIN_MS = 60 * 60 * 1000;

let cache = loadCache();

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') logger.error('[eufyStats] eufy_token.json の読み込みに失敗しました', err);
    return null;
  }
}

function saveCache(data) {
  cache = data;
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function login() {
  const res = await fetch(`${BASE_URL}/user/v2/email/login`, {
    method: 'POST',
    headers: { category: 'Health', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.eufy.clientId,
      client_secret: env.eufy.clientSecret,
      email: env.eufy.email,
      password: env.eufy.password,
    }),
  });

  if (!res.ok) {
    throw new Error(`eufyログインに失敗しました: HTTP ${res.status}`);
  }

  const body = await res.json();
  if (body.res_code !== 1 || !body.access_token) {
    throw new Error(`eufyログインに失敗しました: ${body.message || 'unknown error'}`);
  }

  saveCache({
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    deviceId: body.devices?.[0]?.id || null,
  });
  logger.info('[eufyStats] eufy Lifeへログインしました');

  return cache;
}

async function getToken() {
  if (cache && cache.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return cache;
  return login();
}

module.exports = { getToken, login };
