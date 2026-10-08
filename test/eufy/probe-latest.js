// 「最新1件だけ」を効率よく取得できるクエリパラメータ/エンドポイントがあるか調べる調査スクリプト。
// last_device_data がクエリなしだと履歴全件を返すため、page_size/offset等のパラメータや
// 4.4節の代替エンドポイント(device/data, device/{deviceId}/data)が絞り込みに使えるか比較する。
//
//   node test/eufy/probe-latest.js
//
// 生のレスポンスは巨大になりうるため、比較しやすいよう「件数・サイズ・先頭レコード」だけを
// まとめたサマリを test/eufy/output/06-probe-latest.json に書き出す。

const fs = require('fs');
const path = require('path');

const CRED_PATH = path.join(__dirname, 'credentials.json');
const OUTPUT_PATH = path.join(__dirname, 'output', '06-probe-latest.json');
const BASE_URL = 'https://home-api.eufylife.com/v1';

function loadCredentials() {
  if (!fs.existsSync(CRED_PATH)) {
    console.error('credentials.json が見つかりません。explore.js と同じものを使います。');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
}

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
  return { token: body.access_token, deviceId: body.devices?.[0]?.id };
}

async function probe(name, url, headers) {
  console.log(`\n[probe] ${name}: ${url}`);
  const record = { name, url, status: null, error: null, dataLength: null, byteSize: null, firstRecord: null };
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    record.status = res.status;
    record.byteSize = Buffer.byteLength(text, 'utf8');

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      record.error = 'JSONパース失敗';
      console.log(`  status:${res.status} JSONパース失敗`);
      return record;
    }

    const data = body.data;
    if (Array.isArray(data)) {
      record.dataLength = data.length;
      record.firstRecord = data[0] ?? null;
    } else {
      record.dataLength = null;
      record.note = 'dataが配列ではない(構造がlast_device_dataと違う可能性)';
    }
    console.log(`  status:${res.status} dataLength:${record.dataLength} byteSize:${record.byteSize}`);
  } catch (err) {
    record.error = err.message;
    console.log(`  ERROR: ${err.message}`);
  }
  return record;
}

async function main() {
  const cred = loadCredentials();
  const { token, deviceId } = await login(cred);
  if (!token) {
    console.error('ログインに失敗しました。explore.js を先に実行して credentials.json を確認してください。');
    process.exit(1);
  }
  console.log(`token取得OK / deviceId: ${deviceId}`);

  const headers = { token };
  const results = [];

  // ベースライン: クエリなし(件数比較用)
  results.push(await probe('baseline-no-query', `${BASE_URL}/device/last_device_data`, headers));

  // page_size/offset (レスポンスに同名フィールドがあったため最有力候補)
  results.push(await probe('page_size-1-offset-0', `${BASE_URL}/device/last_device_data?page_size=1&offset=0`, headers));
  results.push(await probe('page_size-1-only', `${BASE_URL}/device/last_device_data?page_size=1`, headers));

  // よくあるページングパラメータ名も一応試す
  results.push(await probe('limit-1', `${BASE_URL}/device/last_device_data?limit=1`, headers));
  results.push(await probe('size-1', `${BASE_URL}/device/last_device_data?size=1`, headers));

  // 4.4節の代替エンドポイント
  results.push(await probe('device-data-page_size-1', `${BASE_URL}/device/data?page_size=1&offset=0`, headers));
  if (deviceId) {
    results.push(
      await probe('device-id-data-page_size-1', `${BASE_URL}/device/${deviceId}/data?page_size=1&offset=0`, headers)
    );
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n完了。比較結果を ${path.relative(process.cwd(), OUTPUT_PATH)} に保存しました。`);
  console.log('baseline-no-query と比べて dataLength / byteSize が小さくなっているものが「絞り込み成功」の候補です。');
}

main().catch((err) => {
  console.error('スクリプト実行中に予期しないエラーが発生しました:', err);
  process.exit(1);
});
