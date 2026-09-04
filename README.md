# discord-bot

個人用Discord Botです。ゲームの募集、戦績確認、ARKサーバー管理、PoE2相場、Mistfall Hunter検索に対応し、Cloudflare Workersで公式サイトの更新通知も行います。

## 機能

| 分類 | 機能 |
| --- | --- |
| 募集 | FF14 / LoL / OWの募集作成・参加・自動編成 |
| 戦績 | LoL / OWの戦績確認 |
| ARK | Nitradoサーバーの状態確認・設定変更・再起動・バックアップ・復元 |
| PoE2 | 相場画像の生成・定期投稿・表示アイテム編集 |
| MFH | Mistfall Hunterの日本語名対応データ検索 |
| 更新通知 | LoL / TFT / OW / PoE2 / FF14 / 原神の公式更新通知 |

## はじめに

```bash
npm install
cp .env.example .env
npm run deploy
npm start
```

`.env` には利用する機能の環境変数を設定します。変数名と初期値は [`.env.example`](./.env.example) を参照してください。秘密情報はコミットしないでください。

## ドキュメント

詳細な使い方、Web画面、設定、運用、開発手順は [GitHub Wiki](https://github.com/Bump-N1/discord-bot/wiki) にまとめています。

- [Wikiホーム](https://github.com/Bump-N1/discord-bot/wiki)
- [コマンド一覧](https://github.com/Bump-N1/discord-bot/wiki/コマンド一覧)
- [募集](https://github.com/Bump-N1/discord-bot/wiki/募集)
- [戦績確認](https://github.com/Bump-N1/discord-bot/wiki/戦績確認)
- [ARK](https://github.com/Bump-N1/discord-bot/wiki/ARK)
- [PoE2相場](https://github.com/Bump-N1/discord-bot/wiki/PoE2相場)
- [MFH](https://github.com/Bump-N1/discord-bot/wiki/MFH)
- [Cloudflare Workers](https://github.com/Bump-N1/discord-bot/wiki/Cloudflare-Workers)
- [運用](https://github.com/Bump-N1/discord-bot/wiki/運用)
- [開発](https://github.com/Bump-N1/discord-bot/wiki/開発)

## リポジトリ構成

| パス | 内容 |
| --- | --- |
| `src/` | Discord Bot本体とWeb画面 |
| `scripts/` | MFH日本語辞書などの補助スクリプト |
| `workers/discord-bot/` | Cloudflare Workersの更新通知 |
| `test/` | Bot本体とWorkerのテスト |
| `.github/workflows/` | PRとmain push時のCI |
