# HASHIRASE（走らせ）

ブラウザで動くドライビングゲームと、独立した車両シミュレーターの基礎です。ホームから選んだモードだけを読み込みます。ゲームの既存演出を残し、シミュレーターは推定パラメーターによる直線の最小モデルとして区別します。

公開先: https://chameleonjp-lab.github.io/hashirase/ 。公開とmainマージ後の自動更新、配備SHAの確認、戻し方は [公開手順](docs/release-runbook.md) に記載しています。

## 構成

| ファイル・フォルダ | 内容 |
|---|---|
| `index.html` / `src/app/` | ホームの2択、遅延ロード、状態遷移、唯一のRAFと終了処理 |
| `legacy.html` | 原本保護と旧ゲームの回帰検査用入口 |
| `assets/css/simulator.css` | 画面のデザインとタッチ操作 |
| `assets/js/bootstrap/` | 読み込み画面とThree.jsの予備読み込み |
| `assets/js/engine/software-fallback.js` | WebGLが使えないときの描画処理 |
| `src/runtime/` | ゲームの各分野を11ファイルに分けた編集用ソース |
| `assets/js/simulator.js` | 公開用の結合済みゲーム処理（直接編集しない） |
| `tools/build.mjs` | 編集用ソースから公開用JSを生成 |
| `tests/smoke.mjs` | ファイル構成と重要な画面部品の検証 |
| `src/contracts/` | モード・車両・入力・イベントの型注釈と実行時検証 |
| `src/platform/clock.js` / `random.js` | 固定時計とシード付き乱数。実行系に明示的に渡す |
| `scripts/build.mjs` / `check-boundaries.mjs` | ESM分割出力、入力一覧、依存と共通出力の境界検査 |
| `dist/` | `npm run build` が生成する分割ESMと必要時取得する素材。ローカル配信にはビルドが必要 |
| `src/modes/simulation/` | 質量・駆動・抵抗・加速度・速度・位置を扱う独立モデルと直線試験場 |
| `src/ui/` / `styles/` | タップ起点スワイプ、PC操作、端末/モード別設定、ホーム表示 |
| `src/modes/driving/` | ゲームの所有状態、数値計算、ルール、実行単位と移行用adapter |
| `src/rendering/` / `src/platform/audio.js` | 描画資源、カメラ、音の所有と終了処理 |

## 変更方法

Node.js 22以降で `npm ci` を実行します。`src/runtime/` 内の該当するファイルを編集して、`npm run build` で公開用ファイルと新基盤のESMを生成します。`npm run check` はJavaScript構文、読み込み順、生成漏れ、原本保護、契約・時計・依存境界を検査します。PRにはGitHub Actionsの検査が付いています。利用者の端末にNode.jsは不要です。

ブラウザ回帰検査は `npx playwright install --with-deps chromium` の後、`npm run test:baseline` で実行します。全ブラウザ検査は `npm run build && npx playwright test` で実行します。単体検査には個別モードのビルド検査もあるため、ブラウザ検査の直前にアプリをビルドします。Playwright・Three.js r128・Tailwind・esbuild・Acornは固定した開発依存です。Three.jsと必要なゲーム用CSSはビルド時にローカル出力し、本入口からCDNを取得しません。
新しい部品の呼び出し方と移行中の制約は [基盤契約](docs/contracts/foundation.md) を参照してください。
ゲーム単体の開始・停止・リセット・終了と、T05/T06への接続は [ゲーム実行契約](docs/contracts/driving-session.md) に記載しています。

**重要**：`src/runtime/` の11ファイルは、まだ独立したJavaScriptモジュールではありません。元コードが変数と関数を広く共有しているため、最初の段階では同じ順序で連結する方式を採用しています。機能単位の独立化は次の段階で実施します。

## 対応範囲

T01〜T06で、回帰検査・部品契約・独立した2つの実行系・ホームでの選択読み込み・端末別入力/設定を接続しています。ゲームの抽出関数は旧入口と同じソースを使います。起動方法、所有と中断の責務は [ホーム契約](docs/contracts/home-session.md)、各作業の結果と未検証範囲は `docs/evidence/` を参照してください。

ゲーム全機能や実車物理の完全再現は未完成です。共通の道路/交通、ゲームルールの完成、四輪・接地・旋回、追跡5台、性能最適化、実機/Safari/読み上げ/正式な公開受入検査はT07以降で実施します。シミュレーターの数値は実車で未検証の推定値です。正式な受入検査A01〜A60と100点判定は、この基礎の検査とは別に管理します。
