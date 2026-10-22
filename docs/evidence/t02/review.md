# T02 最終レビュー

2026-10-22、独立したレビュー担当 `t02_final_review`（gpt-6-astra/high）が、
main `24cc8d11842b4dd36a70b30eb41339fc3604f75c` から実装コミット `4fe93d3` までの全差分を確認した。
計画書のT02に限定し、T03以降の画面・モード接続を完了条件へ追加していない。
Critical 0件、Important 2件、Minor 0件。2件とも実害に基づきImportantとして受け入れ、1回の修正工程で対応した。

| ID | 独立レビューでの再現 | 対応・再検査 |
|---|---|---|
| T02-R1 | activeTimeの通常加算が累積誤差を生み、300秒で120fpsは35,999tick、600秒で60/120fpsは71,999tickになる。他は36,000/72,000tickで、描画頻度により状態が変わる | 先に300秒・600秒の30/60/120fps検査を書き、600秒60fpsで期待72,000に対して71,999となるREDを確認。補償加算に変更して全スケジュールで同じtick/物理状態になった。100ms過負荷閾値・8tick上限・滞留保持は緩めていない |
| T02-R2 | file loaderのCSSはurl(./car.svg)と別モードの@importをそのまま出力し、参照先は出力/入力一覧にも含まれず、壊れたURLと境界検査漏れになる | 先にURL依存とモード間@importの2検査を書き、拒否されないREDを確認。CSSをesbuildで解析し、依存参照は明示エラーにした。エスケープ表記も拒否し、コメント/文字列は許可。自己完結CSSのみという制限を契約書へ記載 |

追加REDのコマンド（Nodeの子プロセス制限を避け、テスト本体を実行）：

```sh
node --test --test-isolation=none --test-name-pattern='ten_minutes|CSS_URL_dependencies|CSS_imports_including' tests/unit/clock.test.mjs tests/integration/import-boundaries.test.mjs
```

[RED省略前ログ](logs/red-final-review.log)は3件の期待したassertion失敗、
[GREEN省略前ログ](logs/green-final-review.log)は同じ3件の成功。
その後、計画書に指定された通常の分離実行による対象29件/buildとnpm run checkを再実行した。
レビュー担当が報告したgitのEPERMはsandboxによる環境エラーで、検査の削除や成功扱いにはしていない。

検証の最終結果は[対象ログ](logs/target.log)・[回帰ログ](logs/regression.log)・
[ブラウザログ](logs/browser-regression.log)に保存する。修正後の追加レビューループは行わず、検査で修正を検証した。

## 実行上の判断と持越し

- 旧公開経路の時計/乱数と生成物はT02で置換しない。新契約へ移すのはT03以降で、移行まで2経路が共存する負担を受け入れる。
- CSSは明示URLとしてマウントする。依存を黙って落とすよりもビルドを失敗させる方針とし、CSS内参照の利用には後続のビルド拡張が必要になる。
- 今回のMinor持越しはなし。T01由来のTEST-T01-01（load fault検査のtimerとの競合）はT01のレビュー記録のまま残す。
- 既存の検査用Tailwind依存7件のaudit指摘はT14/T15へ引き継ぎ、今回の新規依存への指摘や実行版の変更とは区別する。
