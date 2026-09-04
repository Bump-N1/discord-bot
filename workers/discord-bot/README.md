# discord-bot Worker

ゲーム公式サイトの更新情報を確認し、Discord Webhookへ通知するCloudflare Workerです。

詳細な対象サイト、通知仕様、Cloudflare設定、Secret管理、障害時の確認方法は[GitHub WikiのCloudflare Workersページ](https://github.com/Bump-N1/discord-bot/wiki/Cloudflare-Workers)を参照してください。

## ローカル確認

リポジトリのルートから実行します。

```bash
npm install
npm --prefix workers/discord-bot install
npm --prefix workers/discord-bot run check
```

`check` はCloudflareへのdry-runです。ローカルでWorkerを起動する場合は、`workers/discord-bot/.dev.vars` を用意して次を実行します。

```bash
npm --prefix workers/discord-bot run dev
```

## デプロイ

Cloudflare WorkersのGit連携を使う場合は、Root directoryを `workers/discord-bot`、Deploy commandを `npx wrangler deploy` にします。

手動でデプロイする場合は次を実行します。

```bash
npm --prefix workers/discord-bot run deploy
```

Worker名、KV Binding、Cron Trigger、SecretはWikiの手順に従って設定してください。
