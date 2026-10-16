# STAR TAP

Vite + JavaScript で作るブラウザゲームの開発用ひな形です。
20秒間で星をクリック・タップしてスコアを競います。キーボードでも操作でき、ベストスコアはブラウザ内に保存します。

## 開発

Node.js 24（`.nvmrc` は 24.19.0）と npm を使用します。
クラウド環境の作業ディレクトリは `/workspace/game` です。

```sh
npm ci
npm run dev
```

開発サーバーはポート 5173 で起動します。API キーや外部サービスは不要です。
npm キャッシュは `.npmrc` で書き込み可能な `/tmp/game-npm-cache` を使用します。

## 検証

```sh
npm run build
npm test
```

Playwright が開発サーバーを必要に応じて起動し、得点・時間切れ・再開・記録保存・キーボード操作・モバイルのプレイ範囲を確認します。
クラウド環境では既存の `/usr/bin/chromium` を使います。それがない環境では先に `npx playwright install chromium` を実行してください。

`npm run preview` で `dist/` のビルド成果物をポート 4173 で確認できます。

## 構成

- `index.html`: 日本語の画面
- `src/main.js`: ゲームの動作
- `src/style.css`: レスポンシブな表示
- `tests/game.spec.js`: ブラウザでの動作テスト

依存関係は `package-lock.json` で固定しています。開発を始める際は既存のチェックアウトを使い、追加の Git worktree は不要です。
