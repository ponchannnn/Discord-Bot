const eufyAuth = require('./eufyAuth');

const BASE_URL = 'https://home-api.eufylife.com/v1';

async function request(pathname, { retry = true } = {}) {
  const { accessToken } = await eufyAuth.getToken();
  const res = await fetch(`${BASE_URL}${pathname}`, { headers: { token: accessToken } });

  if (res.status === 401 && retry) {
    await eufyAuth.login();
    return request(pathname, { retry: false });
  }
  if (!res.ok) {
    throw new Error(`eufy APIの呼び出しに失敗しました (${pathname}): HTTP ${res.status}`);
  }

  const body = await res.json();
  if (body.res_code !== 1) {
    throw new Error(`eufy APIの呼び出しに失敗しました (${pathname}): ${body.message || 'unknown error'}`);
  }
  return body;
}

// afterCreateTime指定時は「それより新しい測定」だけを返す(絞り込み確認済み。eufyApiReference.md参照)
// 未指定時は履歴全件(create_time降順)を返す
async function getMeasurements(afterCreateTime) {
  const query = afterCreateTime ? `?after=${afterCreateTime}` : '';
  const body = await request(`/device/data${query}`);
  return body.data || [];
}

module.exports = { getMeasurements };
