# eufy Life API × Discord Bot 実装仕様書

## 1. 目的

eufy Life（Ankerの体重計）で測定した最新の体重・体組成データを、Discordの特定メッセージ（Bot送信・編集可能なメッセージ）にリッチテキスト（Embed）で表示する。あわせて、Botユーザーのサーバーニックネームを最新の体重を含む表記に更新する。

---

## 2. やりたいこと（要件）

1. eufy Life の非公式APIにログインし、最新の体組成データを取得する
2. 指定したDiscordサーバー・チャンネルの**既存メッセージ（メッセージIDを指定）**を、取得したデータを整形したEmbedで**編集（edit）**する(もしメッセージIDがなければ、チャンネルIDに新規で作成し、メッセージIDを記憶する)
3. Botのサーバー内ニックネームを、最新体重を含む文字列（例：`68.2`）に変更する
4. 更新用のリアクションボタンを一つ配置し、誰かに押されたら、その人のリアクションボタンを削除して更新する（**自動同期は行わない。更新はこのリアクション操作のみを起点とする**）

---

## 3. 前提・必要な認証情報（環境変数）

`.env` などで管理し、コードにハードコードしない。

| 変数名 | 用途 |
|---|---|
| `EUFY_EMAIL` | eufy Lifeアカウントのメールアドレス（必須） |
| `EUFY_PASSWORD` | eufy Lifeアカウントのパスワード（必須） |
| `EUFY_CLIENT_ID` | 任意。未設定時は固定値`eufy-app`を使用 |
| `EUFY_CLIENT_SECRET` | 任意。未設定時は固定値`8FHf22gaTKu7MZXqz5zytw`を使用（APKから抽出された共通値。ユーザー固有の秘密ではない） |

`EUFY_EMAIL`/`EUFY_PASSWORD`が未設定の場合、他機能はそのまま動作し `eufyStats` 機能のみ無効化される（`registerFeatures.js`のfeature単位try/catchによるfault isolation。詳細は[`src/config/env.js`](./src/config/env.js)参照）。

対象サーバー・チャンネルIDは他機能と同様に秘匿情報ではないため、env経由ではなく [`src/config/targets.js`](./src/config/targets.js) の `eufyStats` に直接記述する（実装前に実際のIDへ書き換えが必要）。編集対象のメッセージIDは要件2の通り自動採番され、`data/eufy_message.json` に永続化される（`src/features/eufyStats/messageStore.js`）。

※ `access_token` は初回ログイン後に取得し、以後はキャッシュ・再利用する想定（有効期限30日＝`expires_in: 2592000`と確認済み）。リフレッシュ専用エンドポイントは非公開のため、期限切れ時は**再ログイン**で対応する（詳細は [`eufyApiReference.md`](./eufyApiReference.md#1-ログイン) 参照）。

---

## 4. eufy Life API（非公式）

ベースURL: `https://home-api.eufylife.com/v1/`

エンドポイント一覧・実レスポンス構造・単位換算などの確定情報は調査済みのため、詳細は別ファイルにまとめた:

**→ [`eufyApiReference.md`](./eufyApiReference.md) を参照**

実装で使うのは以下の3つ:

1. `POST /user/v2/email/login` — ログイン、`access_token`取得
2. `GET /device/data`（`after=<unix秒>`付き） — 測定データ。前回同期した測定の`create_time`を`after`に渡すことで、新規測定が無ければ空配列（約60バイト）だけ返る差分取得ができる（`measurementStore.js`が基準値を保持）
3. （初回のみ）`GET /device/data`（`after`無し） — 履歴全件から先頭2件を取得し、以後の差分取得の基準にする

`body_model`（3Dモデルデータ）は今回のEmbed表示には使わない。

---

## 5. データマッピング（Discord Embedに表示する項目）

測定データの `scale_data` から以下を抽出してEmbedに表示する。各項目は前回測定との差分（▲/▼/± 0）付きで表示する。フィールド名・単位の詳細は [`eufyApiReference.md#7-フィールドマッピング確定版`](./eufyApiReference.md#7-フィールドマッピング確定版) 参照。

- 体重（`weight` ÷10）
- BMI（`bmi`）
- 体脂肪率（`body_fat`）
- 筋肉量（`muscle_mass`）
- 骨量（`bone_mass`）
- 水分率（`water`）
- 基礎代謝量（`bmr`）
- 内臓脂肪レベル（`visceral_fat`）
- タンパク質率（`protein_ratio`）
- 心拍数（`heart_rate`、`0`は未測定として非表示）
- 測定日時（`create_time`）

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

- `guild.members.fetch(targets.botOwnerUserId)` → `member.setNickname(weight)`（Bot自身ではなくownerのニックネームを変更）
- Botに **「ニックネームの管理」権限** が必要で、かつBotのロールがowner本人のロールより上位である必要がある
- Discordの仕様上、**サーバーオーナー本人のニックネームはBotから変更できない**
- 失敗時はtry/catchでログのみ出して処理を継続する（Embed更新は成功させる）

---

## 7. 実行トリガー

自動バッチ（cron等）は使わない。**Bot起動時にEmbedメッセージ＋🔄リアクションの存在だけを保証し、実際のデータ同期は誰かが🔄を押した時のみ**実行する。

- 実行フロー（`src/features/eufyStats/sync.js` の `runSync`）:
  1. eufy API ログイン（トークンがキャッシュ済みかつ有効なら省略）
  2. `measurementStore`に保存済みの前回測定があれば、その`create_time`を`after`にして差分取得。無ければ全件取得して先頭2件を基準にする
  3. 新規データが無ければ前回値のままEmbedに「更新なし」と表示して終了（ニックネーム変更はスキップ）
  4. 新規データがあれば `measurementStore` を更新し、Discordメッセージ編集・ニックネーム変更を行う
  5. ログ出力（成功/失敗、測定日時、新規有無）

---

## 8. エラーハンドリング方針

- eufyトークン期限切れ（401） → 自動で再ログインを試みる（`eufyClient.js`が1回だけリトライ）
- eufy APIから新規データが取れなかった場合 → 前回値（`measurementStore`のキャッシュ）を維持し、Embedのフッターに「更新なし」の旨を表示。ニックネーム変更はスキップして実装済み
- Discord側の権限エラー（ニックネーム変更・リアクション削除） → try/catchでログのみ出して処理を継続。実装済み

---

## 9. 未確定事項

API仕様は [`eufyApiReference.md`](./eufyApiReference.md) の調査で確定済み。残っているのはDiscord側・実装方針の決めごとのみ:

- [ ] Embedの見た目の希望（色・アイコン画像など。現状は仮で青系＋シンプルなフィールド構成で実装済み）
- [ ] `src/config/targets.js` の `eufyStats.guildId` / `eufyStats.channelId` に実際のID値を設定する（実装はプレースホルダーのまま）
- [ ] `.env` に `EUFY_EMAIL` / `EUFY_PASSWORD` を追加する（未設定の間は機能が自動的に無効化される）
