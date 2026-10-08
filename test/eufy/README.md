# eufy Life API 調査スクリプト

`eufyApi.md` の「未確定事項」（実レスポンス構造）を確認するための使い捨てスクリプトです。
本実装(`src/features/eufyStats`)を作る前に、ここで実際のAPIレスポンスを確認します。

## 使い方

1. `credentials.example.json` をコピーして `credentials.json` を作成し、値を埋める

   ```
   cp credentials.example.json credentials.json
   ```

2. 実行する

   ```
   node test/eufy/explore.js
   ```

3. `output/` 配下に各エンドポイントの生レスポンス(リクエスト内容・ステータス・ヘッダー・ボディ)がJSONで保存される

   - `01-login.json`
   - `02-device-list.json`
   - `03-device-list-v2.json`
   - `04-last-device-data.json`
   - `05-body-model.json`

4. 中身を確認し、`eufyApi.md` の該当セクション（4章のレスポンス構造、5章のフィールド名マッピング、9章の未確定事項）を更新する

## 補足

- `credentials.json` と `output/` の中身は `.gitignore` 済み。実際のメール・パスワード・測定データがコミットされることはない
- ログインレスポンスのトークン格納パスが `extractToken()` の想定と違う場合、`01-login.json` を見てパスを追加すればそのまま以降のステップも動く
- `deviceId` が判明したら、`04-last-device-data.json` の中から対象デバイス分だけ抽出すればよいことが確認できるはず
