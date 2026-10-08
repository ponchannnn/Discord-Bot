// eufy Life 非公式APIの実レスポンスを確認するための使い捨て調査スクリプト。
// 使い方は test/eufy/README.md 参照。
//
//   node test/eufy/explore.js
//
// 各エンドポイントの生レスポンスを test/eufy/output/ に書き出す。
// ここで得たフィールド名・構造を eufyApi.md に反映してから本実装(src/features/eufyStats)に進む想定。

const fs = require('fs');
const path = require('path');

const CRED_PATH = path.join(__dirname, 'credentials.json');
const OUTPUT_DIR = path.join(__dirname, 'output');
const BASE_URL = 'https://home-api.eufylife.com/v1';

function loadCredentials() {
  if (!fs.existsSync(CRED_PATH)) {
    console.error(
      `credentials.json が見つかりません。credentials.example.json をコピーして ${CRED_PATH} を作成し、値を埋めてください。`
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
}

function writeOutput(fileName, data) {
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  -> ${path.relative(process.cwd(), filePath)} に保存`);
}

async function callApi(step, { method = 'GET', url, headers = {}, body }) {
  console.log(`\n[${step.no}] ${step.name}: ${method} ${url}`);

  const record = {
    request: { method, url, headers, body: body ?? null },
    status: null,
    statusText: null,
    responseHeaders: null,
    body: null,
    error: null,
  };

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    record.status = res.status;
    record.statusText = res.statusText;
    record.responseHeaders = Object.fromEntries(res.headers.entries());

    const text = await res.text();
    try {
      record.body = JSON.parse(text);
    } catch {
      record.body = text; // JSONでない場合はそのまま文字列で保存
    }

    console.log(`  status: ${res.status} ${res.statusText}`);
  } catch (err) {
    record.error = { message: err.message, stack: err.stack };
    console.log(`  ERROR: ${err.message}`);
  }

  writeOutput(`${step.no}-${step.name}.json`, record);
  return record;
}

// レスポンス構造が未確認のため、ありそうなパスを一通り試してトークンを拾う
function extractToken(body) {
  if (!body || typeof body !== 'object') return null;
  const candidates = [
    body.access_token,
    body.data?.access_token,
    body.data?.user_info?.access_token,
    body.access_token_info?.access_token,
  ];
  return candidates.find((v) => typeof v === 'string') || null;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const cred = loadCredentials();

  // 1. ログイン
  const loginRecord = await callApi(
    { no: '01', name: 'login' },
    {
      method: 'POST',
      url: `${BASE_URL}/user/v2/email/login`,
      headers: {
        category: 'Health',
        'Content-Type': 'application/json',
      },
      body: {
        client_id: cred.clientId,
        client_secret: cred.clientSecret,
        email: cred.email,
        password: cred.password,
      },
    }
  );

  const token = extractToken(loginRecord.body);
  if (!token) {
    console.warn(
      '\ntoken の自動抽出に失敗しました。output/01-login.json の中身を見て、本スクリプトの extractToken() にパスを追加してください。以降のAPI呼び出しはスキップします。'
    );
    printSummary();
    return;
  }
  console.log(`\ntoken取得: ${token.slice(0, 8)}...(以下省略)`);

  const authHeaders = { token };

  // 2. デバイス一覧
  await callApi(
    { no: '02', name: 'device-list' },
    { url: `${BASE_URL}/device/`, headers: authHeaders }
  );

  // 3. デバイス一覧 v2(グループ情報込み)
  await callApi(
    { no: '03', name: 'device-list-v2' },
    { url: `${BASE_URL}/device/v2`, headers: authHeaders }
  );

  // 4. 最新測定データ(全デバイス一括)
  await callApi(
    { no: '04', name: 'last-device-data' },
    { url: `${BASE_URL}/device/last_device_data`, headers: authHeaders }
  );

  // 5. 体組成詳細(3Dモデルデータ)
  await callApi(
    { no: '05', name: 'body-model' },
    { url: `${BASE_URL}/body_model/`, headers: authHeaders }
  );

  printSummary();
}

function printSummary() {
  console.log(`\n完了。test/eufy/output/ 配下の各JSONを確認し、eufyApi.md に反映してください。`);
}

main().catch((err) => {
  console.error('スクリプト実行中に予期しないエラーが発生しました:', err);
  process.exit(1);
});
