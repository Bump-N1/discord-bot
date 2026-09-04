# discord-bot Worker

ゲーム公式サイトの更新情報を確認し、Discordへ通知するCloudflare Worker。
15分ごとにLoL / TFT / OW / PoE2 / FF14 / 原神の更新を確認し、未投稿の記事だけをWebhookへ投稿する。

## Git連携

Cloudflare WorkersのGit連携では次の設定を使用する。

```text
Worker名: discord-bot
Root directory: workers/discord-bot
Deploy command: npx wrangler deploy
```

Worker名は [wrangler.jsonc](./wrangler.jsonc) の `name` と一致させる。

## 設定

以下の設定は [wrangler.jsonc](./wrangler.jsonc) で管理する。

```text
KV Binding: PATCHNOTE_KV
Cron Trigger: */15 * * * *
Compatibility Date: 2026-04-30
```

以下はCloudflare上のSecretsとして管理し、値はリポジトリに保存しない。

```bash
npx wrangler secret put DISCORD_WEBHOOK_URL_LOL
npx wrangler secret put DISCORD_WEBHOOK_URL_TFT
npx wrangler secret put DISCORD_WEBHOOK_URL_OW
npx wrangler secret put DISCORD_WEBHOOK_URL_POE2
npx wrangler secret put DISCORD_WEBHOOK_URL_FF14
npx wrangler secret put DISCORD_MAINTENANCE_FF14
npx wrangler secret put DISCORD_WEBHOOK_URL_GENSHIN_NOTICE
npx wrangler secret put DISCORD_WEBHOOK_URL_GENSHIN_NEWS
```

`POST_ON_FIRST_RUN=true` は初回取得時にも投稿を許可する場合に設定する。
`keep_vars: true` により、既にダッシュボードで設定している変数をデプロイ時に保持する。

ローカル確認では `.dev.vars.example` を `.dev.vars` として用意する。

```bash
npm install
npm run dev
```

## 確認

```bash
npm run check
```

公開URLへアクセスすると、手動で更新確認を実行して結果をJSONで返す。
