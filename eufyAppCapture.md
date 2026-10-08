# eufy Life iOSアプリ 通信キャプチャ解析

iPhoneの EufyLife アプリ（iOS 3.3.12）をプロキシ経由で起動・操作した際の通信（2026-09-29 17:48〜17:54、約6分間）を解析したもの。

元データ（Charlesセッション形式のJSON、リポジトリ直下・gitignore対象）:

| ファイル | ホスト | リクエスト数 |
|---|---|---|
| `api.eufylife.com.json` | `api.eufylife.com` | 74（ユニーク19エンドポイント） |
| `log,eufylife.com.json` | `log.eufylife.com` | 5 |
| `aiot-light-api-eu.eufylife.com.json` | `aiot-light-api-eu.eufylife.com` | 1 |

実装で使っている `home-api.eufylife.com` との関係・既知のエンドポイント仕様は [`eufyApiReference.md`](./eufyApiReference.md) を参照。

---

## 0. 要点

1. **`GET /v1/device/data?after=<unix秒>` で差分取得ができる。** アプリは最新測定の `create_time` を `after` に渡し、それより新しい測定だけを受け取っている（新規なしなら `data: []`、62バイト）。`eufyApiReference.md` §4 の「絞り込み不可」は `page_size`/`limit` 等についての話で、`after` は未検証だった。
2. アプリは起動後 **30秒ごとに3本をポーリング**している: `device/data?after=`・`wifi_scale/raw_data/{deviceId}?after=`・`customer/all_target`。
3. アプリのメインAPIホストは `home-api` ではなく **`api.eufylife.com`**。パスは同じ `/v1/...` 体系で、認証も同じ `token` ヘッダー。
4. 体重計データ以外に、**目標体重・カロリー記録（食事）・食品DB・リマインダー・ボディモデル**のAPIが見つかった。
5. `aiot-light-api-*` はECDH鍵交換＋署名付きの別系統API（今回のキャプチャでは鍵交換のみ）。体重計には使われておらず、扱う必要はない。

---

## 1. ドメイン構成

`POST /api/estimate/estimate_domain` がリージョンごとの接続先一覧を返す（アプリ起動時に取得）。

```jsonc
// Request body
{ "client_id": "eufy-app", "client_secret": "8FHf22gaTKu7MZXqz5zytw" }

// Response
{
  "res_code": 1,
  "data": {
    "ap_cloud_url":  "https://api.eufylife.com",              // ★メインAPI（今回の74件）
    "iot_url":       "https://aiot-clean-api-pr.eufylife.com", // 掃除機等のIoT
    "iot_light_url": "https://aiot-light-api-pr.eufylife.com", // 照明等のIoT（§5）
    "mqtt_url":      "ssl://new-broker.eufylife.com:8883",
    "log_url":       "https://log.eufylife.com",               // 行動ログ（§4）
    "caring_url":    "https://home-api.eufylife.com/eufyhome/", // ★Botが使っているホスト
    "shopping_url":  "https://security-mall.eufylife.com/"
  }
}
```

補足: `user/details` の `user_info.registered_region` は `EU`、`request_host` は `https://appliances-api-eu.eufylife.com` だった（アカウントはEUリージョンに登録されている）。

---

## 2. 共通リクエストヘッダー（`api.eufylife.com`）

| ヘッダー | 値の例 | 備考 |
|---|---|---|
| `token` | ログインで得た `access_token` | 認証。base64デコードすると `JP_<user_id>_...` 形式 |
| `uid` | `<user_id>` | |
| `category` | `Health` | |
| `openudid` | 端末固有ID（40桁hex） | |
| `user-agent` / `http_user_agent` | `EufyLife-iOS-3.3.12` | |
| `country` / `ab_code` | `JP` | |
| `x-anker-selected-country-code` | `JP` または `DE` | リクエストにより混在 |
| `language` / `accept-language` | `ja` | |
| `timezone` | `Asia/Tokyo` | |

レスポンスは全て `{"res_code": 1, "message": "", ...}` 形式（`res_code: 1` が成功）。

---

## 3. `api.eufylife.com` エンドポイント一覧

### 3.1 ユーザー・アカウント

| メソッド | パス | 用途 / レスポンス要点 |
|---|---|---|
| GET | `/v1/user/details` | ログインレスポンスとほぼ同じ構造（`user_info`/`devices`/`customers`/`has_blood_pressure` 等）。ただし `access_token` 等は空文字。**トークンがまだ有効かの確認や、ログインし直さずにデバイス・メンバー情報を取るのに使える** |
| POST | `/v1/notification/life/save-push-token` | プッシュ通知トークン(FCM)登録。body: `os_version, user_id, client_type:1, push_token, push_type:"FCM"` |
| GET | `/v1/user/app/upload_url?file=<日時>.zip` | アプリログアップロード用のS3署名付きURL発行 |
| GET | `/v1/help/privacy_and_terms?last_time=<unix>` | 規約・プライバシーポリシーURL |
| GET | `/v1/reminder` | 測定リマインダー。`data[]: { id, times:"22:00", days:[0..6] }` |
| GET | `/v1/advertisement/life` | 広告（空） |
| GET | `/v1/reddot/v2/?dot_name=EXPLORE&config_key=explore_key` | UIの赤バッジ表示用 |

### 3.2 体重計・測定データ

| メソッド | パス | 用途 / レスポンス要点 |
|---|---|---|
| GET | `/v1/device/data?after=<unix秒>` | ★**差分取得**。`after` より新しい測定のみ返す。アプリは `after=1790059784`（= 最新測定の `create_time`）を指定し、結果は `{"page_size":0,"offset":0,"data":[]}`。30秒ごとにポーリング |
| GET | `/v1/device/wifi_scale/raw_data/{deviceId}?after=<unix秒>` | Wi-Fi経由で体重計がアップした**未処理の生データ**。`list: null`（該当なし）。30秒ごとにポーリング |
| GET | `/v1/device/wifi_scale/unmatched_data` | 誰の測定か判定できなかったデータ（メンバー振り分け待ち）。`list, page_size, offset` |
| GET | `/v1/device/wifi_scale/screen` | 体重計の画面表示設定と推測（`data: []`） |

> 結果が空のケースしか取れていないため、`device/data?after=` で新規データが返る時の構造は未確認。`eufyApiReference.md` §4 の記述どおり `/device/data` は `last_device_data` と同じ形式と考えられる。

### 3.3 目標・レポート

| メソッド | パス | 用途 / レスポンス要点 |
|---|---|---|
| GET | `/v1/customer/all_target` | 全メンバーの目標。`target_list[]`（下記）。30秒ごとにポーリング |
| GET | `/v1/customer/target/{customerId}` | 1メンバー分の目標。`target`（同構造） |
| GET | `/v1/report/week/is_gen?customer_id=` | 週間レポートの生成済み/既読フラグ。`{ is_gen, is_read }` |

`target` の構造:

```jsonc
{
  "customer_id": "...",
  "target_weight": 550,          // ★kgの10倍。550 → 55.0kg
  "current_weight": 608,         // ★kgの10倍。目標設定時点の体重と思われる
  "weight_reach_time": 1709392455,
  "target_weight_created_time": 1706247329,
  "target_bodyfat": 0, "current_bodyfat": 0, "bodyfat_reach_time": 0,
  "target_muscle_mass": 0, "current_muscle_mass": 0, "muscle_mass_reach_time": 0,
  "current_analysis": null, "diet": null, "sport": null, "plan_time": 0, "weight_loss_info": null
}
```

### 3.4 ボディモデル

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/v1/body_model?start=<unix>&end=<unix>&customer_id=&limit=1` | `eufyApiReference.md` §5 と同じデータ。アプリは `start`/`end`/`limit` で**期間・件数を絞っている** |

### 3.5 カロリー（食事記録）

| メソッド | パス | 用途 / レスポンス要点 |
|---|---|---|
| GET | `/v1/calorie?start=&end=&customer_id=&limit=1` | 期間内の日別カロリー記録。`data.list[]` + `data.food_detail[]`（下記） |
| GET | `/v1/calorie/data_day?start=&end=&customer_id=` | 記録がある日の一覧。`list: [1734480000, ...]`（その日の0:00 UTCのunix秒） |
| GET | `/v1/calorie/like_food?customer_id=` | お気に入り食品。`list[]` は `food_detail` と同構造 |
| GET | `/v1/food?name=<検索語>` | 食品検索（空文字でユーザー登録食品一覧）。`list[]: { code, name, weight, calory }` |

日付境界は UTC 0:00（例: 1日分の取得は `start=1786233600&end=1786319999`）。

`/v1/calorie` の `data.list[]`:

```jsonc
{
  "id": 10952134,
  "day": 1786320000,       // その日の0:00 UTC
  "goal": 1577,            // 目標摂取kcal
  "intake": 1123.93,       // 摂取kcal合計
  "burned": 0,             // 消費kcal
  "customer_id": "...",
  "intakes": [
    { "id": 10227462, "code": "<食品コード>", "name": "セブンゴールド - 金の海老チリソース",
      "quantity": 150,      // g
      "kcal": 214.8,
      "intake_type": 2 }    // 食事区分（観測値 2,3,4。1=朝食/2=昼食/3=夕食/4=間食 と推測）
  ],
  "burns": []
}
```

`food_detail[]`（食品マスタ）: `code, name, weight, calory, protein, fat, carbohydrate, fiberDietary, natrium, vitaminA/C/E, calcium, iron, ... , gi, gl, dietType, isLiquid, thumbImageUrl`（栄養素は多くが0で未登録）。

---

## 4. `log.eufylife.com`（行動ログ）

| メソッド | パス | 用途 |
|---|---|---|
| POST | `/push_log_hdfs` | アプリ内イベントの送信。レスポンスは `{"res_code":1}` のみ |

```jsonc
{
  "user_id": "...", "uuid": "<openudid>", "phone_model": "iPhone", "sys_version": "26.3.1",
  "app_start_time": "1790671694382",   // ms
  "events": [
    { "module": "LAUNCH", "name": "OPEN_APP", "device_id": "...", "product_code": "eufy T9149", "time": "..." },
    { "module": "DEVICE", "name": "DEVICE_MAIN_PAGE_CLICK", "value_string": "body_info" /* or "calorie_intake" */ }
  ]
}
```

テレメトリのみでデータ取得には関係しない。

---

## 5. `aiot-light-api-eu.eufylife.com`（暗号化API）

| メソッド | パス | 用途 |
|---|---|---|
| POST | `/openapi/oauth/key/exchange` | ECDH鍵交換。body `{ client_public_key }` → `{ code:0, data:{ server_public_key, signature } }` |

ヘッダーに `x-signature`・`x-request-ts`・`x-request-once`（nonce）・`x-key-ident`・`x-encryption-info: algo_ecdh`・`app-name: eufy_life` が付き、以後の通信は暗号化される前提。今回のキャプチャでは鍵交換以外の呼び出しは無く、体重計データはこの系統を通っていない。

---

## 6. アプリの通信シーケンス

```
起動
 ├ save-push-token / upload_url / user/details / privacy_and_terms / estimate_domain
 ├ (aiot-light) key/exchange
 ├ wifi_scale/screen, unmatched_data, reminder
 ├ wifi_scale/raw_data/{deviceId}?after= , device/data?after=
 ├ customer/all_target, customer/target/{id}, report/week/is_gen
 └ body_model?limit=1, calorie?limit=1, reddot
以後30秒ごと
 └ device/data?after= , wifi_scale/raw_data/{deviceId}?after= , customer/all_target
カロリー画面を開いた時
 └ calorie, calorie/data_day, calorie/like_food, food?name=, 日付切替で calorie?start=&end=
```

---

## 7. Bot実装への示唆

- **差分取得で通信量を削れる可能性**: 前回の `create_time` を保存しておき `GET /device/data?after=<前回値>` を叩けば、新規測定がある時だけデータが返る。現在の `last_device_data`（全件・約112KB）の代わりになり得る。要検証:
  - `home-api.eufylife.com/v1/device/data?after=` でも効くか（アプリは `api.eufylife.com` を使用）
  - 新規データがある時のレスポンス構造・ソート順
- **目標体重をEmbedに出せる**: `customer/target/{customerId}` の `target_weight`（10倍値）で「目標まであと○kg」が表示可能。
- **トークン有効性チェック**: `GET /v1/user/details` が軽量な疎通確認に使える。
- 未確認のまま: `refresh_token` を使う更新エンドポイントは今回のキャプチャにも現れなかった（アプリ再起動でもログイン・リフレッシュ通信は発生せず、保存済みトークンをそのまま使用）。

---
