# HASHIRASE（走らせ）

Tesla Roadsterを題材にしたブラウザ向け3Dゲームです。従来の約7,000行の`index.html`を、画面・見た目・起動処理・ゲーム処理に分けて管理します。

## 構成

| ファイル・フォルダ | 内容 |
|---|---|
| `index.html` | プレイ画面のHTML。ゲーム起動時に外部ファイルを読み込む |
| `assets/css/simulator.css` | 画面のデザインとタッチ操作 |
| `assets/js/bootstrap/` | 読み込み画面とThree.jsの予備読み込み |
| `assets/js/engine/software-fallback.js` | WebGLが使えないときの描画処理 |
| `src/runtime/` | ゲームの各分野を11ファイルに分けた編集用ソース |
| `assets/js/simulator.js` | 公開用の結合済みゲーム処理（直接編集しない） |
| `tools/build.mjs` | 編集用ソースから公開用JSを生成 |
| `tests/smoke.mjs` | ファイル構成と重要な画面部品の検証 |
| `src/contracts/` | モード・車両・入力・イベントの型注釈と実行時検証 |
| `src/platform/clock.js` / `random.js` | 固定時計とシード付き乱数。既存ゲームへの接続は後続作業 |
| `scripts/build.mjs` / `check-boundaries.mjs` | ESM分割出力、入力一覧、依存と共通出力の境界検査 |
| `dist/` | 新基盤の生成物。T05まではホーム画面を含まない |
| `src/modes/driving/` | ゲームの所有状態、数値計算、ルール、実行単位と移行用adapter |
| `src/rendering/` / `src/platform/audio.js` | 描画資源、カメラ、音の所有と終了処理 |

## 変更方法

Node.js 22以降で `npm ci` を実行します。`src/runtime/` 内の該当するファイルを編集して、`npm run build` で公開用ファイルと新基盤のESMを生成します。`npm run check` はJavaScript構文、読み込み順、生成漏れ、原本保護、契約・時計・依存境界を検査します。PRにはGitHub Actionsの検査が付いています。利用者の端末にNode.jsは不要です。

ブラウザ回帰検査は `npx playwright install --with-deps chromium` の後、`npm run test:baseline` で実行します。Playwright・Three.js r128・Tailwindは検査用、esbuild・Acornはビルドと解析用の固定した開発依存です。
新しい部品の呼び出し方と移行中の制約は [基盤契約](docs/contracts/foundation.md) を参照してください。
ゲーム単体の開始・停止・リセット・終了と、T05/T06への接続は [ゲーム実行契約](docs/contracts/driving-session.md) に記載しています。

**重要**：`src/runtime/` の11ファイルは、まだ独立したJavaScriptモジュールではありません。元コードが変数と関数を広く共有しているため、最初の段階では同じ順序で連結する方式を採用しています。機能単位の独立化は次の段階で実施します。

## 対応範囲

PR #2で分割し、T01で起動・都市切替・一般車部品のリセットを検査・最小修正しました。T02は契約・時計・ビルドの基盤、T03はゲーム単体の状態と実行・終了処理です。既存公開入口は引き続き旧画面を使い、抽出した関数は新旧で同じソースを使います。実機でのプレイと性能検証は別途必要です。

ホーム画面での二つのモード選択、右側通行の整備、追跡パトカー最大5台への変更は現在の`main`にまだありません。これらは分割後に別の機能PRで進めます。
