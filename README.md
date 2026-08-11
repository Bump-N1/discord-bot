# discord-bot

個人用Discord Bot。
FF14 / LoL / OWの募集作成、LoL / OWの戦績確認、ARKサーバー管理、PoE2相場画像、MFH検索、Cloudflare Workersによる更新通知に対応する。

## ドキュメント

詳細な使い方と運用手順はGitHub Wikiに分けて管理する。

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
| MFH | `/mfh-search`, `/mfh-item` |

## セットアップ

```bash
npm install
cp .env.example .env
npm run deploy
npm start
```

環境変数の一覧は `.env.example` を参照する。

### PoE2相場

相場はGGG公式の公開Currency Exchange CDNから取得するため、OAuthクライアントやアクセストークンは不要。
`/poe2-edit` では表示アイテム、投稿間隔、PC / Xbox / PlayStationを設定できる。
画像には確定した時間帯の価格帯、前時間比、在庫を表示する。

### MFH検索

MFHはGameDBのデータを検索する。
ゲーム本体の静的データから生成した公式日本語辞書を同梱しており、日本語名と英語名のどちらでも検索できる。

辞書を更新する場合は、抽出済みの `I18NText.json` とアイテム・スキル定義JSONがあるディレクトリを指定して生成する。

```bash
npm run mfh:build-localization -- --input <抽出済みデータのディレクトリ>
```

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
