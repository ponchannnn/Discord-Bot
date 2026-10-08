// スマホアプリでは最新なのに last_device_data だと古いままになる原因を調べる調査スクリプト。
//
//   node test/eufy/probe-freshness.js
//
// last_device_data の最新レコード(件数/最新時刻/ソート状態)と、別候補エンドポイントの
// 中身を比較したサマリを test/eufy/output/07-probe-freshness.json に書き出す。

const fs = require('fs');
const path = require('path');

const CRED_PATH = path.join(__dirname, 'credentials.json');
const OUTPUT_PATH = path.join(__dirname, 'output', '07-probe-freshness.json');
const BASE_URL = 'https://home-api.eufylife.com/v1';

const jst = (sec) => new Date(sec * 1000).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

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
  return { token: body.access_token, customerId: body.customers?.[0]?.id };
}

async function get(name, url, token) {
  console.log(`\n[probe] ${name}: ${url}`);
  const out = { name, url, status: null, topLevelKeys: null, error: null };
  try {
    const res = await fetch(url, { headers: { token } });
    out.status = res.status;
    const text = await res.text();
    out.byteSize = Buffer.byteLength(text, 'utf8');
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      out.error = 'JSONパース失敗';
      out.rawHead = text.slice(0, 200);
      return out;
    }
    out.topLevelKeys = Object.keys(body);
    out.body = body;
  } catch (err) {
    out.error = err.message;
  }
  console.log(`  status:${out.status} keys:${out.topLevelKeys?.join(',')}`);
  return out;
}

function summarizeMeasurements(records) {
  if (!Array.isArray(records)) return null;
  const times = records.map((r) => r.create_time);
  return {
    count: records.length,
    firstIsMax: times[0] === Math.max(...times),
    descSorted: times.every((v, i) => i === 0 || times[i - 1] >= v),
    newest3: [...records]
      .sort((a, b) => b.create_time - a.create_time)
      .slice(0, 3)
      .map((r) => ({
        createTimeJst: jst(r.create_time),
        updateTimeJst: jst(r.update_time),
        weightKg: r.scale_data?.weight / 10,
        id: r.id,
      })),
  };
}

async function main() {
  if (!fs.existsSync(CRED_PATH)) {
    console.error('credentials.json が見つかりません。');
    process.exit(1);
  }
  const cred = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
  const { token, customerId } = await login(cred);
  if (!token) {
    console.error('ログインに失敗しました。');
    process.exit(1);
  }
  console.log(`現在時刻(JST): ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);

  const results = [];

  const last = await get('last_device_data', `${BASE_URL}/device/last_device_data`, token);
  results.push({ name: last.name, status: last.status, summary: summarizeMeasurements(last.body?.data) });

  // 非公式調査リポジトリで言及されていた候補エンドポイント。中身は構造確認のため要約のみ保存
  const candidates = [
    ['customer-all_target', `${BASE_URL}/customer/all_target`],
    ['customer-target', `${BASE_URL}/customer/target/${customerId}`],
    ['device-list-devices-and-groups', `${BASE_URL}/device/list/devices-and-groups`],
  ];
  for (const [name, url] of candidates) {
    const r = await get(name, url, token);
    const data = r.body?.data;
    results.push({
      name,
      url,
      status: r.status,
      topLevelKeys: r.topLevelKeys,
      error: r.error,
      dataIsArray: Array.isArray(data),
      summary: summarizeMeasurements(data),
      sample: Array.isArray(data) ? data[0] : data ?? null,
    });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n完了。${path.relative(process.cwd(), OUTPUT_PATH)} に保存しました。`);
  console.log('last_device_data の newest3 に、スマホで見えている最新の測定が入っているか確認してください。');
}

main().catch((err) => {
  console.error('スクリプト実行中に予期しないエラーが発生しました:', err);
  process.exit(1);
});
