# discord-bot

個人用Discord Bot。
ARKのサーバー案内、LoL / OWの戦績確認、FF14 / LoL / OWの募集作成に対応する。

## コマンド

### 募集

#### `/act-ff14`

FF14の募集を作成する。

```text
/act-ff14 mode:FULL PARTY
```

- `mode`: `LIGHT PARTY` / `FULL PARTY`
- コマンド実行後のWeb画面でコンテンツ名・開始日時・募集内容を入力する
- `LIGHT PARTY`: `THDD`
- `FULL PARTY`: `TTHHDDDD`
- タンク / ヒーラー / DPSは第1希望と第2希望それぞれでジョブ指定もできる

#### `/act-lol`

LoLの募集を作成する。

```text
/act-lol mode:Flex
```

- `mode`: `Normal` / `Flex` / `ARAM`
- コマンド実行後のWeb画面で開始日時・募集内容を入力する
- 表示名: `Normal` は `ノーマル（ドラフト）`、`Flex` は `ランク（フレックス）`、`ARAM` は `ランダムミッド`
- `ARAM` 以外は希望レーンから自動編成する

#### `/act-ow`

OWの募集を作成する。

```text
/act-ow mode:Rival
```

- `mode`: `Quick` / `Rival` / `Stadium`
- コマンド実行後のWeb画面で開始日時・募集内容を入力する
- 表示名: `Quick` は `クイック・プレイ`、`Rival` は `ライバル・プレイ`、`Stadium` は `スタジアム`
- `タンク` / `ダメージ` / `サポート` / `すべて` の希望から自動編成する

#### 募集の操作

- Discord投稿の `参加・編集` から本人用のWeb画面を開く
- 第1希望を `第1希望必須` にすると第2希望を使わず、その枠へ固定する
- 固定しない場合は第2希望を登録でき、参加者の増減に合わせて自動で再編成される
- 作成者だけがWeb画面で日時・募集内容を修正できる。FF14はコンテンツ名も修正できる
- `mode` は募集枠に関わるため編集できない
- Web画面の開始日時は日時ピッカーで選択し、初期値は約30分後になる
- 募集の表示上は `5月10日 22時` のように整形される
- 開始30分前に参加者へリマインドを送信する
- 開始時刻を過ぎた募集は自動で締め切る
- `締め切る`: 作成者だけが募集を締め切れる
- 締切後10分間だけ `締め切り解除` を表示する

### ARK

#### `/ark-join`

ARKサーバーの参加方法を表示する。
サーバー名とパスワードはNitrado上の設定ファイル、マップと接続情報はNitradoのサーバー情報から取得する。
取得できない場合はエラーを表示する。

```text
/ark-join
```

#### `/ark-status`

ARKサーバーの状態を表示する。
Nitradoから現在の状態を取得する。

```text
/ark-status
```

#### `/ark-settings`

ARKサーバーの倍率や設定を表示する。
倍率と自動保存間隔はNitrado上の設定ファイルから読み取る。
自動再起動時刻はNitradoの自動タスクから読み取る。
Bot稼働中に検知した直近の設定変更も表示する。
取得できない場合はエラーを表示する。

```text
/ark-settings
```

Nitrado連携がある場合、`ARK_NOTIFY_CHANNEL_ID` のチャンネルへサーバー状態の変化を通知する。
稼働状態はARKサーバーへの接続可否で確認し、オンラインになった時とオフラインになった時だけ投稿する。

### 戦績確認

#### `/lol-stats`

指定したRiot IDの直近戦績を表示する。

```text
/lol-stats riot-id:名前#タグ
/lol-stats riot-id:名前#タグ count:20
```

#### `/lol-stats-champion`

指定したチャンピオンに絞って直近戦績を表示する。

```text
/lol-stats-champion riot-id:名前#タグ champion:チャンピオン名
/lol-stats-champion riot-id:名前#タグ champion:チャンピオン名 count:10
```

#### `/ow-stats`

指定したBattleTagのOverwatch戦績を表示する。

```text
/ow-stats battletag:名前#タグ
/ow-stats battletag:名前#タグ role:Tank
```

#### `/ow-stats-hero`

指定したヒーローに絞って戦績を表示する。

```text
/ow-stats-hero battletag:名前#タグ hero:ヒーロー名
```

## セットアップ

```bash
npm install
cp .env.example .env
npm run deploy
npm start
```

`.env` に必要な値を設定する。
環境変数の一覧は `.env.example` を参照。
募集Web画面を使用する場合は `ACT_WEB_BASE_URL` に外部から開けるURL、`ACT_WEB_SIGNING_SECRET` にランダムな秘密値を設定する。

## Cloudflare Workers

パッチノート・メンテナンス情報の通知Workerは `workers/discord-bot` に配置する。
LoL / TFT / OW / PoE2 / FF14 / 原神の更新情報を定期確認し、更新時のみDiscord Webhookへ投稿する。

CloudflareのGit連携設定。

```text
Worker名: discord-bot
Root directory: workers/discord-bot
Deploy command: npx wrangler deploy
```

`PATCHNOTE_KV` は投稿済み履歴と多重実行防止に利用するため、既存のKV Namespaceを [wrangler.jsonc](./workers/discord-bot/wrangler.jsonc) に割り当てている。
Discord Webhook URLはCloudflare上のSecretとして管理し、リポジトリには記載しない。

## Oracle Cloud での運用

配置先ディレクトリとPM2プロセス名は `discord-bot` で統一する。

初回配置。

```bash
git clone https://github.com/Bump-N1/discord-bot.git ~/discord-bot
cd ~/discord-bot
npm install
cp .env.example .env
# .env を設定してから実行
npm run deploy
pm2 start src/index.js --name discord-bot --update-env
pm2 save
```

更新反映。

```bash
cd ~/discord-bot
git pull --ff-only
npm install
npm run deploy
pm2 restart discord-bot --update-env
pm2 status
```

よく使うコマンド。

```bash
pm2 logs discord-bot
pm2 stop discord-bot
pm2 restart discord-bot --update-env
```

## 補足

- Overwatchのプロフィールが非公開の場合、戦績を取得できないことがある
- カスタム絵文字名は `.env.example` の `*_EMOJI_*` を参照
