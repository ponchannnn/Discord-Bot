// eufyAppCapture.md で見つかった `after` 差分取得と、wifi_scale系(未処理データ)の実態を確認する調査スクリプト。
//
//   node test/eufy/probe-after.js
//
// 1. home-api.eufylife.com で /device/data?after=<最新create_time> が絞り込めるか
// 2. 同じく古いafter値を渡した時に部分的な結果が返るか(絞り込みが本当に効いているかの確認)
// 3. wifi_scale/raw_data・wifi_scale/unmatched_data に「アプリを開かないと処理されない」
//    未反映データが溜まっていないか(スマホでは最新、Botでは古いままの原因調査)

const fs = require('fs');
const path = require('path');

const CRED_PATH = path.join(__dirname, 'credentials.json');
const OUTPUT_PATH = path.join(__dirname, 'output', '08-probe-after.json');
const BASE_URL = 'https://home-api.eufylife.com/v1';

async function login(cred) {
  const res = await fetch(`${BASE_URL}/user/v2/email/login`, {
    method: 'POST',
    headers: { category: 'Health', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
      email: cred.email,
      password: cred.password,
    }),
  });
  const body = await res.json();
  return { token: body.access_token, deviceId: body.devices?.[0]?.id, customerId: body.customers?.[0]?.id };
}

async function get(name, url, token) {
  console.log(`\n[probe] ${name}: ${url}`);
  const out = { name, url, status: null, error: null };
  try {
    const res = await fetch(url, { headers: { token } });
    out.status = res.status;
    const text = await res.text();
    out.byteSize = Buffer.byteLength(text, 'utf8');
    out.body = JSON.parse(text);
  } catch (err) {
    out.error = err.message;
  }
  console.log(`  status:${out.status} byteSize:${out.byteSize} error:${out.error}`);
  return out;
}

async function main() {
  const cred = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
  const { token, deviceId, customerId } = await login(cred);
  if (!token) {
    console.error('ログインに失敗しました。');
    process.exit(1);
  }
  console.log(`deviceId: ${deviceId} / customerId: ${customerId}`);

  const results = [];

  const baseline = await get('device-data-no-param', `${BASE_URL}/device/data`, token);
  results.push(baseline);
  const latest = baseline.body?.data?.[0];
  const latestCreateTime = latest?.create_time;
  console.log(`最新measurement: create_time=${latestCreateTime} weight=${latest?.scale_data?.weight}`);

  if (latestCreateTime) {
    const afterLatest = await get(
      'device-data-after-latest',
      `${BASE_URL}/device/data?after=${latestCreateTime}`,
      token
    );
    results.push({ ...afterLatest, dataLength: afterLatest.body?.data?.length, note: '空(0件)なら絞り込み成功・新規データ無し' });

    const fortyDaysAgo = latestCreateTime - 40 * 24 * 3600;
    const afterOld = await get(
      'device-data-after-40days-ago',
      `${BASE_URL}/device/data?after=${fortyDaysAgo}`,
      token
    );
    results.push({
      ...afterOld,
      dataLength: afterOld.body?.data?.length,
      note: '160件より少なく1件以上なら絞り込みが正しく効いている',
    });
  }

  const rawData = await get(
    'wifi_scale-raw_data',
    `${BASE_URL}/device/wifi_scale/raw_data/${deviceId}`,
    token
  );
  results.push({ ...rawData, note: 'アプリを開かないと処理されない未反映データが無いか' });

  const unmatched = await get('wifi_scale-unmatched_data', `${BASE_URL}/device/wifi_scale/unmatched_data`, token);
  results.push({ ...unmatched, note: 'メンバー未割当のまま溜まっているデータが無いか' });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n完了。${path.relative(process.cwd(), OUTPUT_PATH)} に保存しました。`);
}

main().catch((err) => {
  console.error('スクリプト実行中に予期しないエラーが発生しました:', err);
  process.exit(1);
});
