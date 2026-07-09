# discord-bot

個人用Discord Bot。
FF14 / LoL / OWの募集作成、LoL / OWの戦績確認、ARKサーバー管理、PoE2相場画像、Cloudflare Workersによる更新通知に対応する。

## ドキュメント

詳細な使い方と運用手順はGitHub Wikiに分離しています。

- [Wikiホーム](https://github.com/Bump-N1/discord-bot/wiki)
- [コマンド一覧](https://github.com/Bump-N1/discord-bot/wiki/コマンド一覧)
- [募集](https://github.com/Bump-N1/discord-bot/wiki/募集)
- [ARK](https://github.com/Bump-N1/discord-bot/wiki/ARK)
- [PoE2相場](https://github.com/Bump-N1/discord-bot/wiki/PoE2相場)
- [戦績確認](https://github.com/Bump-N1/discord-bot/wiki/戦績確認)
- [運用](https://github.com/Bump-N1/discord-bot/wiki/運用)
- [開発](https://github.com/Bump-N1/discord-bot/wiki/開発)

## 主なコマンド

| カテゴリ | コマンド |
| --- | --- |
| 募集 | `/act-ff14`, `/act-lol`, `/act-ow` |
| 戦績確認 | `/lol-stats`, `/lol-stats-champion`, `/ow-stats`, `/ow-stats-hero` |
| ARK | `/ark-join`, `/ark-status`, `/ark-settings`, `/ark-edit`, `/ark-reboot`, `/ark-backup`, `/ark-restore` |
| PoE2 | `/poe2-market`, `/poe2-edit` |

## セットアップ

```bash
npm install
cp .env.example .env
npm run deploy
npm start
```

環境変数の一覧は `.env.example` を参照。

## 運用

Oracle Cloud上では配置先ディレクトリとPM2プロセス名を `discord-bot` で統一する。

```bash
cd ~/discord-bot
git pull --ff-only
npm install
npm run deploy
pm2 restart discord-bot --update-env
pm2 status
```
