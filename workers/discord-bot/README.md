# discord-bot Worker

ゲーム公式サイトの更新情報を確認し、Discordへ通知するCloudflare Worker。
15分ごとにLoL / TFT / OW / PoE2 / FF14 / 原神の更新を確認し、未投稿の記事だけをWebhookへ投稿する。

## 通知元ごとの監視要件

すべての一覧取得でキャッシュを回避し、取得・解析に失敗した場合は定期的に再試行する。復旧後は障害通知の抑止状態を解除する。

| 通知 | 公式ソース | 検出対象 | 取得上限 |
| --- | --- | --- | --- |
| FF14メンテナンス | Lodestone メンテナンス一覧 | ワールド／データセンターのメンテナンス（コンパニオンアプリ等は除外） | 30件 |
| FF14パッチノート | Lodestone パッチノート一覧 | バージョン付きパッチノート | 10件 |
| LoL / TFT | 各公式パッチノート一覧 | `game-updates` 配下のバージョン付きパッチ | 各10件 |
| OW | 日本語・英語の公式パッチノート一覧 | テキストおよび構造化HTMLのパッチ一覧 | 20件 |
| PoE2 | 公式フォーラム | パッチノート、コンテンツアップデート、ホットフィックス | 30件 |
| 原神 | 公式コンテンツAPI、公式ニュースページ | 告知／お知らせカテゴリ | 各20件 |
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
npx wrangler secret put DISCORD_ALERT_WEBHOOK_URL
```

`DISCORD_ALERT_WEBHOOK_URL` は、各通知元の取得・解析失敗と、個別Webhookへの送信失敗を集約する監視用Webhook。送信失敗は同じWebhookでは通知できないため、この設定を必須とする。未設定時も取得失敗は該当通知先へ一度だけ警告するが、送信失敗はWorkerログにだけ残る。
`POST_ON_FIRST_RUN=true` は初回取得時にも最新1件だけ投稿する場合に設定する。過去記事の一括投稿は行わない。
`keep_vars: true` により、既にダッシュボードで設定している変数をデプロイ時に保持する。

## 通知状態とKV移行

通知元ごとの状態は `source-state:<game>` にスキーマバージョン付きで保存する。

- `observedIds`: 一覧で確認済みの記事。過去記事の遡及投稿を防ぐ。
- `pendingIds`: 新着として検出したがDiscord送信が完了していない記事。成功するまで再試行する。
- `deliveredIds`: Discord送信が完了した記事。重複送信を防ぐ。
- `latestId`: 直近一覧の基準点。

旧 `posted:<game>` / `delivered:<game>` / `latest:<game>` は初回読込時に自動移行する。旧KVが部分的でも、一覧内の不足している過去記事は通知せず基準点へ取り込む。ロールバック互換のため旧キーも併記するが、未送信記事は `posted:<game>` に含めない。

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
