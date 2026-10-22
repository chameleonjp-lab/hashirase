# T01：既存機能・起動不具合の検査

基準 main: `bac1f30f8af5cea9c5f6dbbb19e3999f63618e53`。
PR #2 は 2026-10-22 10:33:45 UTC にマージ済み。
PR #3 の計画も統合済み。開始時に open PR はなく、main と作業領域の祖先に AGENTS.md 等の追加指示はない。
計画が基準にした分割ソースと main の実行コードは同じで、T01〜T06 は全件 NOT_STARTED だった。

## 修正前の証拠

検査・依存設定のみを先に追加し、実行コードを変えずに実施した。
`npm run check` は既存の構文・生成照合・117要素の検査を通った。
OriginalManifest は元HTML、分割ソースの Git blob / SHA-256、画面ID、コース、車種、定数、機能一覧を保存する。
元ソースのハッシュ照合と、変更後の画面・定数・機能マーカーの保護を区別して検査する。

| 検査 | 修正前の結果 | 原因 |
|---|---|---|
| startup_nyc_has_no_unbound_radius | FAIL（都市更新3回で同じ ReferenceError） | B02: ACTIVE_RENDER_RADIUS_SQ は都市生成関数の内部、利用先は外部 |
| startup_failure_shows_error (timer) | FAIL（ERROR の代わりに READY/100%） | B03: catch が起動成功と同じ表示・非表示処理を呼ぶ |
| startup_failure_shows_error (load) | FAIL（エラー表示なし、未処理 rejection） | B03追加経路: load イベント経由は catch がない |
| vehicle_reset_restores_part_positions | FAIL（セダン・トラックの配置が原点へ戻る） | B11: tagVehiclePart が配置より前に初期変換を保存する |

正式な省略前ログ: [既存検査](t01/logs/baseline-check.log)、[RED](t01/logs/red-browser.log)、[原本保護](t01/logs/original-manifest.log)。
環境エラー（最初のネットワーク未許可・npmキャッシュの書込不可・制限付き子プロセスの起動失敗）は RED に含めず、ネットワーク許可・`/tmp/hashirase-npm` で解消した。

## 再現方法と環境

```sh
npm ci
npx playwright install --with-deps chromium
node --test tests/baseline/original.test.mjs
npx playwright test tests/baseline/startup.spec.mjs
npm run check
```

ローカルは管理Linux x86_64 / Node 24.19.0 / Chromium 154.0.8037.57、1280×720、DPR 1。
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` をローカルだけに指定。
CI は Node 22 と lockfile の Playwright Chromium を使う。
利用可能なPCは仮想CPU/GPUの管理コンテナだけで、実PCの型番・実GPUは提供されていない。iPhone と PC 実機性能は未検証。

seed は `0x48415348`。晴天・既定 ROCKET・補助既定値、一般車85台。
Three.js r128、Tailwind 3.4.17 の実ライブラリを開発依存で固定してブラウザの外部リクエストへ返す。
CDN到達性・転送量・実機fpsの試験ではない。r128 の更新はしない。
テスト時のみ配信JSへ読み取り用probeと損傷fixtureを挿入し、既存の実物理・描画・クリック処理を実行する。
ソフトウェアGPU負荷を抑えるため RAF は1回ずつ進める。製品JSにテスト用APIは追加しない。
故意の Scene 生成失敗は、タイマー経路と load 経路を別々に実行する。

## 既存機能の棚卸しと未検証

以下はコード・画面の存在を確認したもので、全機能合格を示さない。

| 既存機能 | T01での扱い |
|---|---|
| 試験場・壁ランプ、都市・交通・信号 | 起動→都市→リセット→試験場の短い実行検査。交通全方向・信号整合はT07 |
| ROCKET / THRUST / PERF、ロケット・吸着・浮上・Kickflip | コードと操作部品を保持。実走行の全遷移はT08 |
| タイムアタック・得点・結果・再挑戦 | 保持。公平性・終了時凍結・完全リセットはT08/T14 |
| 警察・検問・ヘリ | 保持。最大5台と最後尾入替はT09で未実装 |
| HP・機能損傷、セダン/トラックの各40破損パターン | 既存損傷処理を呼び、全一般車部品のposition/rotation/scale復元を検査。自車の部位機能・全接触方向は未検証 |
| カメラ・運転席・別カメラ、天候・煙・雨・跡 | 保持。全演出・全天候・全視点の評価は未検証 |
| 音・振動、キーボード・タッチ・自動アクセル・ヘルプ | 保持。入力解放・端末別設定はT06、実機操作はT17 |
| 簡易描画の機能不足（B04） | 根本対応はT14。起動例外を成功に変換しないことだけをT01で保護 |

A27 は一般車復元の部分検査、A51 は起動例外の部分検査、A55/A56 は基礎整備に留まる。
60件の受入検査は全条件をまだ満たさないため NOT_RUN のまま。第1段階全体・ゲーム全機能・実車物理・6軸100点の完成とは扱わない。
