# 体重推移Webサイト向け SQLite スキーマ

`src/features/eufyStats`（Discord bot）が測定のたびに書き込んでいるSQLiteファイルの説明。**別プロジェクト（体重の一覧・推移を見るWebサイト）はこのファイルを読み取り専用で参照する**想定。

## ファイル

- パス: このリポジトリの `data/eufy_weight.db`（Botの起動ディレクトリ基準。`src/config/paths.js` の `dataDir`）
- Webサイト側プロジェクトからは、このファイルをコピーするかパスを直接参照して開く
- 書き込みはBot側のみが行う。Webサイト側は**読み取り専用**で開くこと（`better-sqlite3`なら `new Database(path, { readonly: true })`、他言語のSQLiteドライバでも読み取り専用モードがあれば使う）

## いつ書き込まれるか

- 自動同期は無い。Discord上で🔄リアクションが押され、eufy API側に**新しい測定がある時だけ**追記される（要ヒアリング不要: [`eufyApi.md`](./eufyApi.md) 参照）
- 初回起動時のみ、eufy側の履歴全件（確認時点で160件）をバックフィルする
- 同じ測定（`measured_at`が同じ）は`UNIQUE`制約により重複挿入されない。行が消えることは無い（DELETE操作は無し）

## テーブル: `weight_measurements`

体重計（eufy Smart Scale）1台分の測定履歴。個人情報・ID類（`device_id`/`user_id`/`customer_id`/`group_id`やeufy側のレコードid）は除外済み。

| カラム | 型 | 単位/意味 | 備考 |
|---|---|---|---|
| `id` | INTEGER PK | このテーブル内でのローカル行ID | eufy側のIDとは無関係 |
| `measured_at` | INTEGER, UNIQUE, NOT NULL | 測定日時（unix秒） | **時系列グラフのX軸はこれを使う**。降順/昇順どちらでも取得可 |
| `updated_at` | INTEGER, nullable | eufy側の更新日時（unix秒） | 通常`measured_at`と同一。将来eufy側で測定が訂正された場合のみ変化する想定 |
| `recorded_at` | INTEGER, NOT NULL | Botがこの行をINSERTした日時（unixミリ秒） | 「実際にいつBotが取得したか」。データ鮮度の確認用 |
| `status` | INTEGER, nullable | eufy側の測定ステータスフラグ | 観測値は常に`0` |
| `product_code` | TEXT, nullable | 体重計の機種コード | 例: `"eufy T9149"`。複数台になった場合の識別用 |
| `mode` | INTEGER, nullable | eufy側の測定モード値 | 観測値は常に`0`。用途不明 |
| `weight_kg` | REAL | **体重(kg)** | eufy APIの生値は10倍のintだが、**ここでは既にkgに変換済み**（例: `71.6`） |
| `standard_weight` | REAL, nullable | 標準体重(kg)と思われる | この機種では常に`0` |
| `water_weight` | REAL, nullable | 体水分量(kg)と思われる | この機種では常に`0` |
| `bmi` | REAL | BMI | |
| `body_fat` | REAL | 体脂肪率(%) | |
| `subcutaneous_fat_rate` | REAL | 皮下脂肪率(%) | |
| `visceral_fat_index` | REAL, nullable | 内臓脂肪指数 | この機種では常に`0`（`visceral_fat`と別フィールド） |
| `muscle` | REAL, nullable | 筋肉量関連値 | この機種では常に`0`（`muscle_mass`と別フィールド） |
| `muscle_mass` | REAL | 筋肉量(kg) | |
| `skeletal_muscle_mass` | REAL | 骨格筋量(kg) | |
| `bmr` | INTEGER | 基礎代謝量(kcal) | |
| `bone` | REAL, nullable | 骨関連値 | この機種では常に`0`（`bone_mass`と別フィールド） |
| `bone_mass` | REAL | 骨量(kg) | |
| `water` | REAL | 水分率(%) | |
| `body_age` | INTEGER | 体年齢 | |
| `protein_ratio` | REAL | タンパク質率(%) | |
| `impedance` | INTEGER, nullable | 生体インピーダンス生値 | 体組成計算の元データ。数値自体の可視化は基本不要 |
| `visceral_fat` | INTEGER | 内臓脂肪レベル | Embedで表示している方はこちら |
| `fat_free_weight` | REAL, nullable | 除脂肪体重(kg) | 多くの記録で`0` |
| `body_fat_mass` | REAL | 体脂肪量(kg) | |
| `fat_mode` | INTEGER, nullable | eufy側のフラグ | 観測値は常に`0` |
| `heart_rate` | INTEGER | 心拍数(bpm) | **`0`は未測定**を意味する（測定値としての0ではない） |
| `body_type` | INTEGER | 体型判定の分類値 | eufyアプリ内の体型図（8種類等）に対応すると思われる。観測値は常に`8` |
| `head_size` | REAL, nullable | 用途不明 | この機種では常に`0` |
| `height` | REAL, nullable | 身長(cm)と思われる | この機種では常に`0`（体重計側は身長センサー非搭載のため）。実際の身長は別テーブルには無く、Bot側では未使用 |

`standard_weight`/`water_weight`/`visceral_fat_index`/`muscle`/`bone`/`fat_free_weight`/`head_size`/`height`は今の体重計（Smart Scale P2 Pro / `eufy T9149`）では常に`0`だが、他機種やeufy側の仕様変更で値が入る可能性があるため列は残してある。グラフ化する時は「常に0」のものは自然と対象外になるはずなので、フィルタする必要はない。

## インデックス

- `idx_weight_measurements_measured_at`（`measured_at`）— 期間検索・並び替え用

## SQLサンプル

```sql
-- 直近30件(新しい順)
SELECT * FROM weight_measurements ORDER BY measured_at DESC LIMIT 30;

-- 期間指定(unix秒)
SELECT measured_at, weight_kg, bmi, body_fat
FROM weight_measurements
WHERE measured_at BETWEEN :from AND :to
ORDER BY measured_at ASC;

-- 直近と1つ前の差分(前回比表示用。Discord Embedと同じロジック)
SELECT * FROM weight_measurements ORDER BY measured_at DESC LIMIT 2;
```

## Webサイト側で作れそうなもの（提案・未実装）

- **体重・BMI・体脂肪率などの推移グラフ**（`measured_at`をX軸にした折れ線）。複数指標を切り替え/重ね描画できると良い
- **最新値のサマリーカード**（Discord Embedと同じ項目 + 前回比）
- **測定頻度のカレンダー表示**（`measured_at`の日付ごとにマスを塗る、GitHubのコントリビューショングラフのようなもの）
- **期間フィルタ**（直近7日/30日/90日/全期間）
- **CSVエクスポート**（テーブルをそのままダンプすればよい）

いずれもこのmdの情報だけで実装に着手できるはずだが、Bot側の実装詳細（API仕様等）まで踏み込みたくなった場合は本リポジトリの [`eufyApiReference.md`](./eufyApiReference.md) を参照。
