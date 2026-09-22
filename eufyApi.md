# eufy Life API × Discord Bot 実装仕様書

## 1. 目的

eufy Life（Ankerの体重計）で測定した最新の体重・体組成データを、Discordの特定メッセージ（Bot送信・編集可能なメッセージ）にリッチテキスト（Embed）で表示する。あわせて、Botユーザーのサーバーニックネームを最新の体重を含む表記に更新する。

---

## 2. やりたいこと（要件）

1. eufy Life の非公式APIにログインし、最新の体組成データを取得する
2. 指定したDiscordサーバー・チャンネルの**既存メッセージ（メッセージIDを指定）**を、取得したデータを整形したEmbedで**編集（edit）**する(もしメッセージIDがなければ、チャンネルIDに新規で作成し、メッセージIDを記憶する)
3. Botのサーバー内ニックネームを、最新体重を含む文字列（例：`68.2`）に変更する
4. 更新用のリアクションボタンを一つ配置し、誰かに押されたら、その人のリアクションボタンを削除して更新する

---

## 3. 前提・必要な認証情報（環境変数）

`.env` などで管理し、コードにハードコードしない。

| 変数名 | 用途 |
|---|---|
| `EUFY_EMAIL` | eufy Lifeアカウントのメールアドレス |
| `EUFY_PASSWORD` | eufy Lifeアカウントのパスワード |
| `EUFY_CLIENT_ID` | 固定値: `eufy-app` |
| `EUFY_CLIENT_SECRET` | 固定値: `8FHf22gaTKu7MZXqz5zytw`（APKから抽出された共通値。ユーザー固有の秘密ではない） |
| `DISCORD_GUILD_ID` | ニックネーム変更対象のサーバーID |
| `DISCORD_CHANNEL_ID` | Embedを編集するメッセージがあるチャンネルID |
| `DISCORD_MESSAGE_ID` | 編集対象の既存メッセージID（Bot自身が送信したもの） |

※ `EUFY_ACCESS_TOKEN` / `EUFY_REFRESH_TOKEN` は初回ログイン後に取得し、以後はキャッシュ・再利用する想定（トークンの有効期限は30日程度という報告あり。期限切れ時は再ログインまたはrefreshで対応）。

---

## 4. eufy Life API（非公式・APK解析ベース）

ベースURL: `https://home-api.eufylife.com/v1/`

### 4.1 認証

```
POST /user/v2/email/login
Headers:
  category: Health
  Content-Type: application/json
Body:
{
  "client_id": "eufy-app",
  "client_secret": "8FHf22gaTKu7MZXqz5zytw",
  "email": "<EUFY_EMAIL>",
  "password": "<EUFY_PASSWORD>"
}
```

**レスポンス（想定・未検証）**: `access_token`, `refresh_token`, ユーザー情報などを含むJSON。以降のリクエストは `token: <access_token>` ヘッダーを付与する。

> ⚠️ 実際のレスポンス構造は未確認。取得でき次第このセクションを更新する。

### 4.2 デバイス一覧取得

```
GET /device/
GET /device/v2  (グループ情報も含むv2版)
Headers:
  token: <ACCESS_TOKEN>
```

体重計の `deviceId` を特定するために使用。**最初に一度叩いて `deviceId` を確定させ、以後は環境変数 `EUFY_DEVICE_ID` として固定してよい**。

### 4.3 最新データ取得（優先候補）

```
GET /device/last_device_data
Headers:
  token: <ACCESS_TOKEN>
```

全デバイスの最新測定データを一括取得できると推測される。毎日のバッチ処理では、これを叩いて対象deviceIdのデータだけ抽出するのが最もシンプル。

### 4.4 履歴データ取得（代替・詳細用）

```
GET /device/{deviceId}/data
GET /device/data
Headers:
  token: <ACCESS_TOKEN>
```

期間指定や複数件取得が必要な場合はこちら。クエリパラメータ（開始日・終了日など）は未確認。

### 4.5 体組成詳細（3Dモデルデータ・任意）

```
GET /body_model/
Headers:
  token: <ACCESS_TOKEN>
```

体脂肪率・筋肉量など、より詳細な体組成データが含まれる可能性がある。`device/last_device_data` で十分な項目が取れない場合の補完用。

---

## 5. データマッピング（Discord Embedに表示する項目案）

eufy製の体組成計は機種によって取得項目が異なるが、一般的に以下が候補（**実際のレスポンスが届き次第、フィールド名を確定させる**）:

| 表示したい項目 | 想定フィールド名（仮） | 単位 |
|---|---|---|
| 体重 | `weight` | kg |
| BMI | `bmi` | - |
| 体脂肪率 | `bodyFat` / `fat_percent` | % |
| 筋肉量 | `muscleMass` | kg |
| 骨量 | `boneMass` | kg |
| 水分率 | `bodyWater` / `water_percent` | % |
| 基礎代謝量 | `bmr` | kcal |
| 内臓脂肪レベル | `visceralFat` | - |
| タンパク質率 | `protein` | % |
| 心拍数（対応機種のみ） | `heartRate` | bpm |
| 測定日時 | `createTime` / `time` | timestamp |

> 🔧 **TODO**: 実際のAPIレスポンスをいただき次第、上記フィールド名と単位・小数桁数を確定する。

---

## 6. Discord連携仕様

### 6.1 メッセージ編集（Embed）

- ライブラリ: `discord.js`
- 対象: `DISCORD_CHANNEL_ID` の `DISCORD_MESSAGE_ID`
- `channel.messages.fetch(messageId)` → `message.edit({ embeds: [embed] })`
- Embed構成案:
  - タイトル: 「最新の体組成データ」
  - タイムスタンプ: 測定日時
  - フィールド: 体重・BMI・体脂肪率など、5節の項目をそれぞれ `EmbedBuilder.addFields()` で追加
  - フッター: 「eufy Life 自動更新」等

### 6.2 ニックネーム変更

- `guild.members.fetch(botUserId)` → `member.setNickname(\`みずき (${weight}kg)\`)`
- Botに **「ニックネームの管理」権限** が必要（サーバー設定でBotロールに付与しておく）
- 変更対象はユーザー本人（みずきさん）のニックネーム

---

## 7. バッチ実行

- `node-cron` を利用し、例: 毎日 7:00 に実行
```js
cron.schedule('0 7 * * *', runDailySync, { timezone: 'Asia/Tokyo' });
```
- 実行フロー:
  1. eufy API ログイン（トークンがキャッシュ済みかつ有効なら省略）
  2. `device/last_device_data` 取得
  3. 対象deviceIdのデータを抽出・整形
  4. Discordメッセージ編集
  5. ニックネーム更新
  6. ログ出力（成功/失敗）

---

## 8. エラーハンドリング方針

- eufyトークン期限切れ → 自動で再ログインを試みる
- eufy APIから新規データが取れなかった場合 → 前回値を維持し、Embedに「更新なし」の旨を表示
- Discord API側のレート制限・権限エラー → リトライ + ログ記録
- デバイスがオフライン等でデータ欠損 → 該当項目を「-」表示

---

## 9. 未確定事項（要ヒアリング／レスポンス確認待ち）

- [ ] ログインAPIの実際のレスポンス構造（トークンの有効期限フィールド含む）
- [ ] `device/last_device_data` の実レスポンス（フィールド名・ネスト構造）
- [ ] お使いの体重計の機種（対応する体組成項目の確定のため）
- [ ] Embedの見た目の希望（色・アイコン画像など）
