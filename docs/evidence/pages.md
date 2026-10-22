# P01｜第1段階の公開とmainマージ後の自動更新

2026-10-22のユーザー依頼による公開作業。T18の前提未充足を変更せず、第1段階をプレビュー公開する。T07〜T18と正式受入A01〜A60は未完了のまま。

- 公開先: https://chameleonjp-lab.github.io/hashirase/
- 開始時main: `1306887074e37ad08d66edab1ea4aac875071e37`。PR #10のユーザーマージをGitHubで確認。
- 開始時Pages: `build_type: workflow`、HTTPS有効、environment許可mainのみ。公開ワークフローなし、公開URL HTTP 404。
- 変更: 公開ファイルの限定収集、ビルドSHA/配信ハッシュ記録、配備照合、既存CI成功後だけmainを配信するジョブ、専用404、公開/戻し手順。
- main直接変更・PR自動マージ・課金変更なし。初回補助案はmainを明示checkoutする設計だが、権限不足により未実行。

## 検査

実装前: 公開収集・照合がないため3対象検査が期待どおり失敗。実装後: 3/3成功。古い/欠落出力、逸脱パス、基礎だけの不完全ビルド、誤SHA、配信改変、HTTP 200の偽404を拒否する。

全回帰: `npm run check` 109 Node（単体72・統合27・物理10）成功、`npm run build` 成功、Playwright 62/62成功（skip/flaky/retry 0）。公開成果物のみのサーバーを使う追加ブラウザ3件も成功。25配信ファイルを収集。

初回ブラウザ実行は61成功/1失敗。新規のホーム検査が共通ESM chunkまで誤って禁止したため、実manifestの依存グラフからモード/素材/Three/音だけを禁止する検査へ修正した。禁止対象の取得0と初期化0は保持。初回ログを削除せず保存した。

`images/published-home.png`、`published-driving.png`、`published-simulation.png` を実見し、2択、既存ゲーム画面、推定・実車未検証のSIM表示、ホーム操作を確認した。画像と全ログは `docs/evidence/pages/`。

独立レビュー後に1回の修正パスを実施。古い再実行による待機取消と、偽manifestの自己照合をREDで再現後に修正した。最終 `npm run check` 110 Node（単体73・統合27・物理10）、Playwright 62/62、build、stage 25ファイル成功。詳細は `pages/review.md`。

GitHub Actionsも実装head `b2f16de096dcc61cba03a417c189fa64a9b5582d` で成功を確認し、checkoutのhead一致と全文ログを保存。

- 全体: https://github.com/chameleonjp-lab/hashirase/actions/runs/39817024918/job/119958065998 — 110 Node / 62 browser / build / stage 25 / artifacts 成功。PRなので公開とpreflightは意図どおり未実行。
- SIM: https://github.com/chameleonjp-lab/hashirase/actions/runs/39817024874/job/119958066213 — 16 Node / 1 browser 成功。

公開後の照合はマージ待ちで未実施。未実施の検査は完了扱いにしない。

## 公開を止めている条件

`github-pages` environmentの許可はmainだけ。初回補助ブランチ `ops/bootstrap-pages-20261022` の追加をGitHub APIで試みたが、`Resource not accessible by integration (HTTP 403)` で拒否された。これはGitHub Appの権限による拒否であり、自動承認レビューの拒否ではない。変更前後に許可がmainの1件だけであることを確認し、追加権限は残っていない。補助ブランチはローカルのコミットに保存したが、リモートへpushしていない。

公開と自動更新の導入PR: https://github.com/chameleonjp-lab/hashirase/pull/11 。ユーザーマージ後のmain CIから公開できるよう、すべて準備済み。マージと公開完了はまだ確認していない。公開URLは開始時404で、公開版のSHA・全ハッシュ照合と公開ブラウザ3画面は **NOT_RUN**。ローカル成果物の3画像を公開サイトの画像とは呼ばない。`public-smoke.mjs` は公開後の確認用に保存した未実行スクリプト。

Chromiumからの初回HTTPS疎通はセッションCAを信頼せず `ERR_CERT_AUTHORITY_INVALID` になった。TLS検証を無効にせず、公開後はNodeのTLS検証付きfetchで実公開レスポンスを取得し、同じURLのChromiumへ渡す手順を用意した。これは実機検証ではない。

## 判断

- 最新の公開依頼を、第1段階のプレビューを公開する明示許可として扱う。T18の100点判定・実機・正式受入を前倒しして合格にしない。誤った場合の影響は、未完成範囲を含むプレビューが利用者に見えることなので、README/手順/証拠に範囲を記す。
- 自動更新は既存CIへ接続し、別の未検査ビルドやPRを公開しない。導入PRのマージはユーザー本人が行い、初回公開と自動更新の有効化を区別する。

## 未検証

iPhone/Safari等の実機、性能、全機能、実車、素材の正式審査、A01〜A60、前版がない初回のロールバック試験は未実施。
