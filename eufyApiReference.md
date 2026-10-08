# eufy Life API リファレンス（確認済み）

`test/eufy/` の各調査スクリプトで実際に叩いて確認した、eufy Life 非公式APIのエンドポイント・レスポンス構造・仕様上の注意点をまとめる。実装時はここを正とする。

要件・設計・実装方針は [`eufyApi.md`](./eufyApi.md) を参照。

ベースURL: `https://home-api.eufylife.com/v1`（APK解析ベース。実装で使用）

> 📱 iOSアプリ本体は `POST /api/estimate/estimate_domain` で取得した `ap_cloud_url`（`https://api.eufylife.com`）をメインホストとして使っている。パス・認証方式（`token`ヘッダー）は`home-api.eufylife.com`と同じで、本リファレンスに載せたエンドポイントは全て`home-api.eufylife.com`側でも動作確認済み。ホストを使い分ける必要は無い。

---

## 1. ログイン

```
POST /user/v2/email/login
Headers:
  category: Health
  Content-Type: application/json
Body:
{
  "client_id": "<EUFY_CLIENT_ID>",     // 固定値: eufy-app
  "client_secret": "<EUFY_CLIENT_SECRET>", // 固定値: 8FHf22gaTKu7MZXqz5zytw
  "email": "<EUFY_EMAIL>",
  "password": "<EUFY_PASSWORD>"
}
```

レスポンス（200 OK）:

```jsonc
{
  "res_code": 1,
  "message": "",
  "access_token": "...",   // ★トップレベル直下。data等にネストされていない
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 2592000,    // 30日(秒)
  "user_id": "...",
  "email": "...",
  "user_info": { "id": "...", "nick_name": "...", "email": "...", "timezone": "Asia/Tokyo", "language": "ja", /* ... */ },
  "devices": [ /* 2章の device オブジェクトと同一構造 */ ],
  "customers": [
    {
      "id": "...",
      "name": "...",
      "sex": "Male",
      "birthday": 1047308400,     // unix秒
      "height": 171,              // cm
      "target_weight": 0,
      "member_type": "adult",
      "unit_height": "cm"
      /* ... */
    }
  ],
  "has_blood_pressure": 0,
  "user_center_token": "...",
  "user_center_id": "...",
  "T9150_min_version": "...",
  "scale_ota_message": null
}
```

- 以降のAPI呼び出しは全て `token: <access_token>` ヘッダーで認証する
- **リフレッシュ専用エンドポイントは無い**。非公式調査リポジトリ（[robbalmbra/eufy-api](https://github.com/robbalmbra/eufy-api) 等）に記載が無いだけでなく、**iOSアプリ自体もアプリ再起動時にログイン/リフレッシュ通信を一切行わず、保存済みトークンをそのまま使い続けている**ことを通信キャプチャで確認済み。`expires_in`（30日）経過後は `refresh_token` を使わず**再ログインする方針**でよい（実装済みの通り: `eufyAuth.js` は401時のみ再ログインする）
- トークンの有効性だけを軽く確認したい場合は `GET /v1/user/details`（ログインレスポンスとほぼ同じ構造を返す）が使えるが、本実装では401時に自動で再ログインする設計にしているため採用していない

---

## 2. デバイス一覧

```
GET /device/
Headers:
  token: <ACCESS_TOKEN>
```

```jsonc
{
  "res_code": 1,
  "message": "",
  "devices": [
    {
      "id": "...",                 // deviceId
      "name": "Smart Scale P2 Pro",
      "alias_name": "Smart Scale P2 Pro",
      "bluetooth": { "ble_mac": "..." },
      "wifi": { "mac": "...", "wifi_ssid": "..." },
      "product": {
        "id": "149149",
        "name": "Smart Scale P2 Pro",
        "category": "Health",
        "appliance": "Scale",
        "product_code": "eufy T9149"
        /* ... */
      },
      "user_id": "...",
      "home_id": "...",
      "room_id": "...",
      "room_name": "Living Room",
      "setting": {
        "device_id": "...",
        "scale_setting": { "unit_weight": "kg", "safe_mode": 0, "heart_rate": true, "tap_switch": true }
      },
      "update_version": { "mcu": "...", "wifi": "...", "ble": "...", "res": "..." },
      "current_version": { "mcu": "...", "wifi": "...", "ble": "...", "res": "..." }
      /* ... */
    }
  ]
}
```

確認した実機は **Smart Scale P2 Pro（product_code: `eufy T9149`）**、単位設定は `kg`。

---

## 3. デバイス一覧 v2（オンライン状態付き）

```
GET /device/v2
Headers:
  token: <ACCESS_TOKEN>
```

`devices[]` の各要素は2章と同一構造 + 以下が追加される:

```jsonc
{
  "device_status": {
    "device_id": "...",
    "is_online": false,   // ★オンライン判定はここでしか取れない(device/には無い)
    "mcu_version": "2.0.3",
    "update_time": 1790059843,
    "update_time_ms": 1790059843273
    /* ... */
  },
  "update_packages": []
}
```

トップレベルに `groups: []` も追加される（グループ機能未使用のため空配列）。

---

## 4. 測定データ（`device/data`）

```
GET /device/data
GET /device/data?after=<unix秒>
GET /device/last_device_data   // 同一データを返す別名エンドポイント
Headers:
  token: <ACCESS_TOKEN>
```

```jsonc
{
  "res_code": 1,
  "message": "",
  "page_size": 0,
  "offset": 0,
  "data": [
    {
      "id": "...",
      "device_id": "...",
      "user_id": "...",
      "customer_id": "...",
      "create_time": 1790059784,   // unix秒。★降順ソート済み
      "update_time": 1790059784,
      "scale_data": {
        "weight": 716,              // ★kgの10倍値(int)。716 → 71.6kg
        "bmi": 24.4,
        "body_fat": 22.2,            // %
        "subcutaneous_fat_rate": 19.7,
        "muscle_mass": 53,           // kg
        "skeletal_muscle_mass": 28.9,
        "bmr": 1615,                 // kcal
        "bone_mass": 2.8,            // kg
        "water": 53.3,               // %
        "body_age": 25,
        "protein_ratio": 16.3,       // %
        "impedance": 3450797,
        "visceral_fat": 9,
        "body_fat_mass": 15.8,       // kg
        "heart_rate": 115,           // bpm (0の場合は未測定)
        "body_type": 8,
        // 常に0固定だったフィールド(未使用/機種非対応とみられる):
        "mode": 0, "standard_weight": 0, "water_weight": 0, "muscle": 0,
        "bone": 0, "fat_free_weight": 0, "fat_mode": 0, "head_size": 0, "height": 0,
        "visceral_fat_index": 0
      },
      "status": 0,
      "product_code": "eufy T9149"
    }
    /* ... 過去の測定履歴が降順で続く ... */
  ]
}
```

### 重要な仕様上の注意

- **`after`無しだと「最新1件」ではなく過去の測定履歴を全件返す**（確認時点で160件、約112KB）
- `create_time` 降順でソート済みのため **`data[0]` が常に最新の測定値**
- `page_size` / `offset` / `limit` / `size` はいずれも効かない（全パターンで全件160件のまま。
- ★**`after=<unix秒>` は本物の絞り込みパラメータで、正しく機能する。**
  - `after=<最新のcreate_time>` → `data: []`（新規なし、レスポンス62バイト）
  - `after=<40日前のunix秒>` → 該当期間の測定だけを含む部分配列（3.5KB程度、160件よりずっと少ない）
  - アプリ自身も起動後30秒おきに `after=<自分が知っている最新create_time>` でポーリングしている
  - → **実装では前回同期した測定の`create_time`を保存しておき、次回は`after`で差分だけ取得する**方針（`measurementStore.js`）。初回のみ`after`無しで全件取得し先頭2件を基準にする
- `wifi_scale/raw_data/{deviceId}`・`wifi_scale/unmatched_data`（アプリを開かないと処理されない未反映データがあるかの確認用エンドポイント）は共に空だった。**「アプリでは最新、Botでは古い」という現象の原因はここではなかった**（[`test/eufy/probe-after.js`](./test/eufy/probe-after.js) 参照。原因は依然未特定 — 再発したら`data/eufy_measurement.json`を消してから同期し直し、ログの測定日時が実際の最新測定と一致するか確認する）
- `scale_data.weight` は **kgの10倍のint値**。`bmi = weight_kg / height_m²` の逆算で単位を確認済み（例: `weight:716, bmi:24.4, height:171cm` → `716/10 ÷ (1.71)² ≈ 24.5` で整合）

---

## 5. 体組成詳細（3Dモデルデータ）

```
GET /body_model/
Headers:
  token: <ACCESS_TOKEN>
```

```jsonc
{
  "res_code": 1,
  "message": "",
  "data": [
    {
      "id": 123656,
      "biceps": 31.49,   // cm
      "chest": 91.81,    // cm
      "waist": 77.98,    // cm
      "hip": 92.98,      // cm
      "thigh": 49.15,    // cm
      "height": 171,     // cm
      "weight": 60.3,    // ★こちらはそのままkg(10倍されていない)
      "user_id": "...",
      "day": 1706659200, // unix秒
      "customer_id": "..."
    }
  ]
}
```

> ⚠️ **単位注意**: `body_model` の `weight` は素のkg値。`last_device_data.scale_data.weight`（10倍値）と混同しないこと。今回の要件（体重・体組成のEmbed表示）では使わない想定だが、将来サイズ計測系の機能を足す場合に利用できる。

---

## 6. 目標体重（未使用・将来用）

```
GET /customer/all_target       // 全メンバー分。{ target_list: [...] }
GET /customer/target/{customerId} // 1メンバー分。{ target: {...} }
Headers:
  token: <ACCESS_TOKEN>
```

`home-api.eufylife.com` でも動作確認済み（[`test/eufy/probe-freshness.js`](./test/eufy/probe-freshness.js)）。`target`構造:

```jsonc
{
  "customer_id": "...",
  "target_weight": 550,   // ★kgの10倍。550 → 55.0kg
  "current_weight": 608,  // ★kgの10倍。目標設定時点の体重
  "weight_reach_time": 1709392455,
  "target_weight_created_time": 1706247329
  /* target_bodyfat/current_bodyfat 等も同様の構造だが今回のアカウントは0 */
}
```

現在は未使用。Embedに「目標まであと○kg」を出したくなったらここを使う（`customerId`はログインレスポンスの`customers[0].id`）。

---

## 7. フィールドマッピング（確定版）

Discord Embedに表示する項目と、`last_device_data` の `scale_data` オブジェクトの対応:

| 表示したい項目 | フィールド名 | 単位・変換 |
|---|---|---|
| 体重 | `weight` | kg（**値を10で割る**） |
| BMI | `bmi` | そのまま |
| 体脂肪率 | `body_fat` | % |
| 皮下脂肪率 | `subcutaneous_fat_rate` | % |
| 筋肉量 | `muscle_mass` | kg |
| 骨格筋量 | `skeletal_muscle_mass` | kg |
| 骨量 | `bone_mass` | kg |
| 水分率 | `water` | % |
| 基礎代謝量 | `bmr` | kcal |
| 内臓脂肪レベル | `visceral_fat` | そのまま |
| タンパク質率 | `protein_ratio` | % |
| 体年齢 | `body_age` | そのまま |
| 体脂肪量 | `body_fat_mass` | kg |
| 心拍数 | `heart_rate` | bpm（`0`は未測定として扱う） |
| 測定日時 | `create_time` | unix秒 |

---
