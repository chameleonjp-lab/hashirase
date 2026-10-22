# GitHub Pagesへの公開と更新

公開先は https://chameleonjp-lab.github.io/hashirase/ です。第1段階のプレビュー公開であり、T07〜T18、実機確認、A01〜A60の正式合格を意味しません。シミュレーターは実車未検証の推定モデルです。

## 通常の更新

ユーザーがPRをmainへマージすると `Verify source layout` が起動します。固定依存の導入、`npm run check`、分割ビルド、全Playwright回帰検査を通過した後、アプリを再ビルドして `.pages-site/` に公開用ファイルだけを集めます。PRの検査では公開しません。手動実行もmainを指定した場合だけ公開します。

`source-check` が成功した後、`release-target` が最新mainとの一致を確認してから `deploy-pages` の待機列へ入れます。古い再実行が最新の検査や待機中の配備を取り消さないよう、検査全体にはconcurrencyを設定しません。配備だけを直列化し、実行中の配備を取り消しません。待機後にもmainとの一致を再確認します。

書込み権限は配備ジョブの `pages: write` と `id-token: write` に限定し、リポジトリへの書込み権限は付けません。GitHub PagesのSourceは **GitHub Actions**、`github-pages` environmentの許可ブランチは **mainのみ** にします。ビルド・配備前の失敗では前の公開版が残ります。配備成功後の照合に失敗した場合は新しい版が公開済みなので、実際の版を確認し、修正PRまたは後述のrevert PRを使います。自動ロールバックは行いません。

mainへの直接コミット、PRの自動マージ、課金設定変更は行いません。公開ワークフローを導入するPRもユーザー本人がマージします。そのマージから自動更新が有効になります。

## 公開するファイル

`node scripts/stage-pages.mjs` は `index.html`、入口で使うCSS、分割ビルドmanifestに記録された出力、manifest自身、`404.html`、`.nojekyll` だけを収集します。各ビルド出力のSHA-256を照合し、不足や変更があれば中止します。ソース、テスト、node_modules、環境ファイル、内部ビルドmetafileは配信しません。

`build-info.json` に公開ソースのコミットSHAと全配信ファイルのハッシュを記録し、同じ内容を別のCI artifact `pages-expected-manifest` に保存します。配備後はその正本と公開版のファイル集合・ハッシュを照合するため、公開サイトの自己申告だけを信用しません。ページが更新されない場合はActionsの完了と、このURLの `sourceSha` を確認してください。GitHub Pagesやブラウザのキャッシュにより表示が遅れる場合は再読み込みします。

## 確認

```sh
npm ci
npm run check
npm run build
npx playwright test
npm run build
node scripts/stage-pages.mjs
node scripts/verify-deployment.mjs --url https://chameleonjp-lab.github.io/hashirase/ --expected-sha <公開するmainの40桁SHA> --manifest <その実行のpages-expected-manifest内のbuild-info.json>
```

配備後の自動検査はSHA、全配信ファイルのハッシュ、リポジトリ配下のパス、存在しないURLのHTTP 404を確認します。ブラウザの公開成果物検査では、ソースを参照できないサーバーから `/hashirase/` でホーム、ゲーム、シミュレーター、ホームへの復帰を確認します。公開サイトでも同じ往復と画像の実見を行い、URL・SHA・Actions・画像・未検証事項を `docs/evidence/pages.md` へ記録します。

## 初回公開

mainへワークフローを直接追加せず、`ops/bootstrap-pages-20261022` の一度限りのワークフローから **mainを明示的にcheckout** して公開します。配備用スクリプトはこの公開PRと同じものを使い、アプリは未マージのブランチから取得しません。mainの既存106 Node / 59ブラウザ回帰検査を再実行します。

初回だけ `github-pages` environmentへこのブランチを追加し、配備終了後に削除してmainのみへ戻します。この補助ワークフローをmainへ取り込まず、以後の自動更新は公開PRの通常ワークフローを使います。

## 前版へ戻す

既知の正常版の `build-info.json` のSHAとActions URLを保存します。問題を導入した変更をrevertする専用ブランチ・PRを作成し、回帰検査後にユーザーがマージします。通常の公開ワークフローが、正常版と同じアプリを新しいrevertコミットとして配信します。`build-info.json` はrevertコミットを示すため、以前のSHAそのものへの一致とは区別します。配信する全ファイルのハッシュと両モードを再確認します。

過去のActions再実行による旧SHAの配信は、mainより古いアプリの上書きと戻し履歴の不一致を生むため使用しません。初回は前版が存在しないので、以前の公開成果物へ戻す試験は未実施です。T18の正式なロールバック合格とは扱いません。
