# HASHIRASE 2モード化・品質100点 Implementation Plan

> 実行担当へ：1作業ずつ `superpowers:executing-plans`、独立した担当を使える場合だけ `superpowers:subagent-driven-development` を使用する。進捗はチェックボックスとtracker.jsonへ記録する。今回の資料作成は機能実装の開始を意味しない。

**Goal:** ホームで選ぶ2モードを独立して動かし、6つの評価軸を根拠付きで各100点にする。

**Architecture:** 共通の入力・描画・道路データを契約で接続し、ゲームとシミュレーターは別の状態・物理・ルールを所有する。必要なモードだけを取得し、停止・破棄・再開をapp側で管理する。旧結合方式は段階的に撤去する。

**Tech Stack:** 既存JavaScript/Three.js、標準モジュール、Node.js 22系列を出発点とする。esbuildとPlaywrightは開発依存として版を固定する案。ブラウザ利用者に開発環境を要求しない。

**Spec:** [02 完成仕様](02-architecture-and-mode-spec.md)。要求の対応は01、合格値は04を参照。

## Global Constraints

ホーム2択・選択側だけ読込・スマホ/PC・端末別設定・**タップ位置を起点にしたスワイプ運転をスマホ標準とすること**・右側通行・追跡最大5台/最後尾入替を維持する。数値計算はSI単位、固定時間刻み案1/120秒、増援案30秒。PRはユーザーがマージする。課金設定・秘密情報・main直接変更は禁止。完成を装う未実装画面、根拠のない実車性能表示、未検査の合格扱いは禁止。

## Review Focus

| 見落としやすい条件 | 期待する動作 | 担当 |
|---|---|---|
| 遅い通信中の連打・戻る・別モード選択 | 古いロード結果で意図しないモードを起動しない | T05 |
| タップだけ・斜め・端でのスワイプ・2本指・タッチPC・電話等による非表示 | 操作起点と2軸の入力が正しく、入力源が干渉せず、戻っても加速が残らない | T02/T06/T14/T17 |
| 停止・後退・急旋回・全追跡車が前方 | 最後尾の選択が毎回同じ規則に従い5台を守る | T09 |
| 保存破損・古い形式・容量拒否 | 起動でき、無関係の記録を消さない | T14 |
| 低描画速度・遅い物理・ゲーム終了と衝突の同時発生 | 時間を捨てて好記録にせず、結果確定後に値が変わらない | T02/T08/T16 |

## 作業の前提

T01の前にPR #2のマージを確認し、最新mainのSHAを記録する。未マージなら、文書PRは提出できるが機能実装は着手しない。PR #2の更新・追加実装があれば、この計画の旧ファイル対応を更新する。過去の未登録ローカルファイルを最新実装として混ぜない。

下記のファイル名とコマンドは**これから作る対象**であり、今すでに存在するという意味ではない。追加テストは、対象機能が無い状態で期待通りに失敗することを先に確認する。テストの構文エラーや環境不足による失敗を、適切な失敗確認とは数えない。

## 依存関係・並行開発

```text
PR #2 merge → T01 → T02
                     ├─ T03（ゲーム） ─┐
                     ├─ T04（最小物理）├→ T05（ホーム・終了）
                     └─ T06（端末） ──┘
T03 + T04 + T06 → T07（交通・世界）
T05 + T06 + T07 → T08（ゲーム完成） → T09（追跡）
T04 + T07       → T10（四輪物理）   → T11（試験UI、T05/T06も必要）
T05 + T07       → T12（描画）
T08 + T09 + T11 + T12 → T13（表現・案内）
T05 + T06 + T08 + T11 → T14（復旧・保存）
T13 + T14 → T15 → T16 → T17 → T18
```

T03/T04/T06は契約確定後に並行可能です。T06のホームへの接続はT05完成後に統合します。T08/T10/T12もT07完成後に並行可能ですが、衝突共通処理はT07で固定し、T08/T10は変更せず利用します。追加変更は共有担当の別PRを先に統合します。T13/T14はUIと保存の境界を固定して進めます。

同時担当は最大3つを目安とし、進行停止の多い細分化は避けます。`contracts`、`package.json`、lockfile、build、CIを変更する担当は各時点で1人にします。依存先が未完了なら先の実装へ進まず、その作業の検査や資料整理までに留めます。

## 段階の終了条件

段階1はT01〜T06を統合し、2つの最小モードが別々に読み込まれ、入力・終了を検査できれば終了です。機能完成とは呼びません。

段階2はT07〜T12を統合し、両モードの主要機能・5台追跡・物理基準・都市再訪が成立すれば終了です。実機性能未確認のまま100点としません。

段階3はT13〜T18を通し、正式候補の自動・実機・公開証拠を揃えて終了です。途中の改善率や平均点で未達項目を隠しません。

## T01｜現状を検査で固定し、起動を妨げる問題を分離する

**段階:** 1　**前提:** PR #2マージ・最新main確認　**対応要求:** R26, R28

**読む場所:** PR #2のindex.html、src/runtime/20-nyc-traffic.part.js、30-utility-poles.part.js、99-physics-loop.part.js、tests/smoke.mjs

**作成:** tests/baseline/original.test.mjs、tests/baseline/startup.spec.mjs、tests/fixtures/original-manifest.json、docs/evidence/baseline.md

**変更:** package.json、.github/workflows/verify.yml。起動不能の最小修正が必要なら該当part.jsと生成ファイルを同じPRで更新

**入出力の約束:** 元の画面要素・モード・定数・ソース識別値をOriginalManifestとして記録。後続はmanifestを比較基準にする

- [x] 先に検査を書く：startup_nyc_has_no_unbound_radius、startup_failure_shows_error、vehicle_reset_restores_part_positions。市街地へ切替して例外0件、故意の起動失敗で成功表示0件、部品位置が初期値へ戻ることをassertする。
- [x] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [x] 実装する：現行の構文検査だけでは検出できない起動・切替の検査を追加。B02/B03/B11の再現を保存し、起動を通す最小修正は整理変更と別コミットにする。既存全機能の実装済み/未確認を棚卸しする。
- [x] `node --test tests/baseline/original.test.mjs && npx playwright test tests/baseline/startup.spec.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [x] 変更を `feat/t01` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 試験場→都市→リセットを自動操作できる。元不具合と新規不具合の区別が記録され、ゲーム全体合格と取り違えない。

## T02｜部品の契約・固定時計・分割ビルドを作る

**段階:** 1　**前提:** T01　**対応要求:** R02, R06, R28

**読む場所:** tools/build.mjs、src/runtime/00-boot-audio.part.js、99-physics-loop.part.js

**作成:** src/contracts/session.js、vehicle.js、events.js、src/platform/clock.js、src/platform/random.js、scripts/build.mjs、scripts/check-boundaries.mjs、tests/unit/contracts.test.mjs、clock.test.mjs、tests/integration/import-boundaries.test.mjs

**変更:** package.json、package-lock.json、.github/workflows/verify.yml

**追加の契約テスト:** `InputFrame.reverseThrottle`の許可範囲、`SwipeFrame`の軸方向と-1..1、許可しない型・NaNの拒否を固定。T06はこの契約を改名しない。

**入出力の約束:** 02と06のInputFrame（reverseThrottle含む）、SwipeFrame、VehicleSnapshot、ModeSession。createFixedClock({step:1/120,maxSteps:8})とcreateRandom(seed)を提供し、ビルドはdistと入力ファイル一覧を生成

- [x] 先に検査を書く：clock_is_render_rate_independent、clock_marks_overload、events_reject_invalid_session、imports_do_not_cross_modes。同一入力1200tickを30/60/120描画スケジュールで与え、物理snapshot差≤1e-6、異常値を拒否する。
- [x] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [x] 実装する：JavaScriptの標準モジュールへ移行する土台を追加。esbuildは開発依存で版を固定し、format=esm・splittingを有効にする。物理の乱数はseed管理、見た目の乱数と分離。境界検査は循環と禁止importを失敗にする。
- [x] `node --test tests/unit/contracts.test.mjs tests/unit/clock.test.mjs tests/integration/import-boundaries.test.mjs && npm run build` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t02` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** T03/T04/T06が同じ契約で独立作業できる。未使用モードが共通出力へ混入する変更を検査で検出できる。

## T03｜既存ゲームを所有状態のある実行単位にする

**段階:** 1　**前提:** T02　**対応要求:** R06, R14

**読む場所:** src/runtime/00〜99の各part.js。特にcarState、policePursuitState、timeAttackState、resetVehicle、stepPhysics

**作成:** src/modes/driving/index.js、session.js、state.js、physics.js、rules.js、src/rendering/vehicle-view.js、tests/unit/driving-session.test.mjs、tests/integration/driving-lifecycle.spec.mjs、src/rendering/renderer-host.js、camera.js、src/platform/audio.js

**変更:** 移行対象のsrc/runtime/*.part.js、scripts/build.mjs。移行済み関数の二重定義は禁止

**入出力の約束:** createMode(context, options)をexportし、import時は起動しない。stateはsession内だけに保持し、物理結果をsnapshotで返す

- [ ] 先に検査を書く：driving_import_has_no_side_effect、two_driving_sessions_do_not_share_state、driving_dispose_is_idempotent。一方のHP変更・リセットが他方に影響しない。dispose2回で例外0件。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：ゲーム状態、ルール、数値更新、描画反映を分ける。途中のlegacy adapterは1か所に閉じ込め、移行対象と撤去条件を記録する。window経由の実行状態を増やさない。
- [ ] `node --test tests/unit/driving-session.test.mjs && npx playwright test tests/integration/driving-lifecycle.spec.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t03` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** ゲーム単体の開始・停止・リセットが呼べる。旧挙動との比較差を説明し、整理の名目で既存機能を削らない。

## T04｜現実寄りの最小車両モデルを独立して作る

**段階:** 1　**前提:** T02　**対応要求:** R06, R12, R15

**読む場所:** TRIMS、carState.mass、GROUND計算。数値は転用根拠を確認し、ゲーム式は流用しない

**作成:** src/modes/simulation/index.js、session.js、physics/vehicle-model.js、physics/forces.js、config/demo-car.js、tests/physics/straight-line.test.mjs、tests/unit/simulation-isolation.test.mjs

**変更:** src/contracts/vehicle.jsはT02担当と合意した拡張だけ。相手モードのファイル変更は禁止

**入出力の約束:** createVehicleModel(config)。直線の入力→駆動力/抵抗→加速度→速度/位置を数値だけで返す。質量等はorigin: estimated/reference/measuredを持つ

- [ ] 先に検査を書く：force_over_mass_accelerates、drag_does_not_accelerate_rest、zero_input_remains_finite、simulation_has_no_game_rules。1000kgへ1000Nを10秒与え速度10m/s、位置50mを許容差内で検証。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：独立した最小3自由度モデルから始める。四輪を作り込む前に単位・符号・時間積分を証明する。ロケット・HP倍率・無制限ガス回復・警察を読み込まない。未実装の四輪機能は完成表示しない。
- [ ] `node --test tests/physics/straight-line.test.mjs tests/unit/simulation-isolation.test.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t04` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 別の物理モデルとして数値検査でき、最小試験場で走行可能。現実車の再現済みという表示はない。

## T05｜ホームの2択と選択読み込み・終了処理を実装する

**段階:** 1　**前提:** T03, T04　**対応要求:** R01, R02, R07, R24, R25, R26

**読む場所:** index.html、assets/js/bootstrap/loading.js、three-loader.js、旧起動監視処理、06のタップ操作対象外領域

**作成:** src/app/main.js、home.js、mode-loader.js、session-host.js、src/platform/resource-scope.js、styles/home.css、tests/e2e/mode-loading.spec.mjs、tests/integration/session-races.test.mjs

**変更:** index.html、scripts/build.mjs。旧simulator.jsをホームから読み込まない。ホーム・設定・結果のイベントを運転スワイプとして捕捉しない

**入出力の約束:** selectMode(modeId): Promise<void>、leaveMode(): Promise<void>。hostだけが描画ループを所有し、世代番号・AbortSignal・資源一覧を持つ

- [ ] 先に検査を書く：home_requests_no_3d、driving_does_not_fetch_simulation、simulation_does_not_fetch_driving、latest_selection_wins、leave_during_load_disposes_late_result。両方向のネットワーク記録とcanvas数をassert。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：2つの実際に動く最小モードを接続する。READMEの説明だけを2モード化と呼ばない。未選択のCSS・画像・音も遅延化。中断・エラー・戻ると資源解放を状態遷移で管理する。
- [ ] `node --test tests/integration/session-races.test.mjs && npx playwright test tests/e2e/mode-loading.spec.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t05` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** ホーム→どちらかのモード→ホームを繰り返せる。選択していないモードの取得・初期化0件、activeSession≤1、canvas≤1。

## T06｜端末別の操作・設定・アクセシビリティを作る

**段階:** 1　**前提:** T02　**対応要求:** R16, R17, R18, R19, R20, R27

**読む場所:** src/runtime/80-interface-input.part.js、assets/css/simulator.css、入力ボタンHTML、06-touch-swipe-control.md

**作成:** src/platform/device-profile.js、input-service.js、settings-store.js、swipe-control.js、src/ui/settings.js、touch-controls.js、swipe-guide.js、keyboard-controls.js、styles/controls.css、tests/unit/input-settings.test.mjs、tests/unit/swipe-control.test.mjs、tests/e2e/device-layout.spec.mjs

**変更:** src/app/home.jsとsession-host.jsへの接続はT05完了後に担当者が統合する。並行中は契約fixtureだけを使う

**入出力の約束:** createInputService(profile)、createSwipeController(settings)、createSettingsStore(storage)。タップした場所をpointerIdごとの起点にして、SwipeFrameのhorizontal/verticalをInputFrameへ変換する。入力源別に保持し合成する。profileはtouch/desktop/hybrid。下スワイプの後退は前進停止後に切替える（06参照）

- [ ] 先に検査を書く：touch_tap_is_zero、swipe_up_accelerates、swipe_down_brakes_then_reverses_only_after_stop、swipe_left_right_steers、diagonal_swipe_combines_axes、swipe_returns_to_origin_is_zero、pointer_cancel_clears、primary_pointer_is_not_stolen、second_finger_action_works、touch_and_keyboard_do_not_overwrite、blur_clears_all、settings_separate_by_profile_and_mode、corrupt_storage_uses_defaults。上下左右・斜め・画面端・戻す・離す・前進中の逆噴射防止をfixtureで再現し、設定UIで別端末の不要項目が出ないことを確認する。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：06の**タップした場所を起点にした2軸スワイプ操作**を標準にする。固定のアクセル・ブレーキ・左右ボタンを主操作から外し、アクセル/制動/後退/操舵を指の移動量に応じて入力する。指を離したら全入力0で惰性走行。後退は停止条件を満たすまで禁止。複数指・追加操作ボタン・画面端・中断・指の捕捉解除を処理。特殊ボタン等は44px以上。PCのキー操作と保存を維持し、初期感度とガイドの表示設定はtouch/desktop/hybrid × driving/simulationで独立させる。
- [ ] `node --test tests/unit/input-settings.test.mjs tests/unit/swipe-control.test.mjs && npx playwright test tests/e2e/device-layout.spec.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t06` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** スマホ・PC・タッチPCが同じ契約を利用でき、スマホでタップ起点の上下左右・斜め入力が成立する。標準画面に固定ペダルは不要。ホームや設定で誤発進せず、解放後は惰性走行となり、設定は混ざらない。T05との統合後に第1段階を判定。

## T07｜道路・信号・一般車を共通の世界モデルへ統合する

**段階:** 2　**前提:** T03, T04, T06　**対応要求:** R08, R21

**読む場所:** 20-nyc-traffic、60-collisions-damageのgetSignalPhaseForIntersection、一般車生成・再配置・回避処理

**作成:** src/world/roads.js、signals.js、traffic.js、state.js、spatial-index.js、tests/unit/traffic-signals.test.mjs、tests/integration/world-state.test.mjs、src/physics/shared/sweep.js、tests/physics/sweep.test.mjs

**変更:** 両モードのworld接続だけ。現実寄り側へ警察をimportしない

**入出力の約束:** createWorld(seed,config)。query(bounds)は道路ID・停止線・信号状態・接触候補を返し、描画と一般車は同じsignal snapshotを参照。sweep(shape,from,to,candidates)は接触時刻・法線・対象IDを返し、T08/T10は変更せず利用する

- [ ] 先に検査を書く：right_hand_all_four_directions、spawn_direction_is_not_id_parity、signal_visual_ai_hud_agree、turns_preserve_lane_side、world_revisit_keeps_damage。北南東西の走行と停止線を固定fixtureでassert、shared_sweep_detects_fast_rotated_body。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：不等間隔道路をID参照へ統一。全方向・右左折・車間・再配置を実装し、通常交通のパニック回避は道路中心からの側を使う。既存右側通行の正しい符号は維持する。
- [ ] `node --test tests/unit/traffic-signals.test.mjs tests/integration/world-state.test.mjs && node --test tests/physics/sweep.test.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t07` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 見た目、車の停止、画面信号が同じ状態を指す。都市を再訪しても壊れた物や車の状態が勝手に初期化されない。

## T08｜ゲームの走行・スタント・得点・終了を完成させる

**段階:** 2　**前提:** T05, T06, T07　**対応要求:** R04, R07, R10, R11, R13

**読む場所:** 40-time-attack、50-police-scoringの得点、99-physics-loopのGROUND/RAMP/AIR、resetVehicle

**作成:** src/modes/driving/score.js、time-attack.js、stunts.js、results.js、config/rules.js、tests/unit/driving-rules.test.mjs、tests/physics/arcade-transitions.test.mjs、tests/e2e/driving-roundtrip.spec.mjs

**変更:** driving/physics.js、session.js。運動と得点の関数を分ける。共有sweepはT07完成版を使い、直接変更しない

**入出力の約束:** applyRunEvent(state,event)はeventId単位で一度だけ得点を更新。finishRun(reason)は不変の結果を返す。sweepは接触時刻と法線を返す。スマホの運転入力は06のInputFrameで受け取り、操作補助とスワイプの計算を混同しない

- [ ] 先に検査を書く：no_score_from_repeated_segment、stunt_bonus_survives_finish、result_freezes_state、goal_sweep_detects_fast_pass、zero_fuel_no_free_jump、reset_clears_every_run_field。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：02の得点案と地上/壁/空中のルールを定数化。競争条件を記録キーへ含め、設定変更を練習扱いにする。HP0とゴールの同時判定順、結果後凍結、全状態の初期化を一元化する。
- [ ] `node --test tests/unit/driving-rules.test.mjs tests/physics/arcade-transitions.test.mjs && npx playwright test tests/e2e/driving-roundtrip.spec.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t08` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 既存の遊びを独立したルールで完走・失敗・再挑戦できる。遠回り稼ぎと結果後の値変動がない。

## T09｜追跡最大5台と最後尾入替を実装する

**段階:** 2　**前提:** T07, T08　**対応要求:** R04, R09

**読む場所:** spawnPoliceCruiser、selectPoliceForwardOrSideSpawnPoint、updatePolicePursuitSystem、resetPolicePursuitState、検問処理

**作成:** src/modes/driving/police/pursuit-manager.js、spawn-policy.js、roadblock.js、tests/unit/pursuit-cap.test.mjs、tests/integration/pursuit-soak.test.mjs

**変更:** driving/session.jsと追跡表示。車の破棄はrendererの所有APIを通す

**入出力の約束:** createPursuitManager({maxUnits:5,intervalSec:30})。selectRearMost(units,playerHeading)は02の投影値、距離、ID順で1台を返す

- [ ] 先に検査を書く：spawn_schedule_1_2_3_4_5_5、replacement_selects_rear_not_oldest、never_six_even_mid_step、stop_reverse_u_turn_ties、no_spawn_candidate_keeps_old_unit、pause_has_no_catchup_burst。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：30秒時計と再配置予約を一元管理。5台時は安全位置を予約してから最後尾を解放して新車生成。検問車が追跡に加わる場合も5台枠を使用する。
- [ ] `node --test tests/unit/pursuit-cap.test.mjs tests/integration/pursuit-soak.test.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t09` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 30分の加速試験で常に0〜5台、ID重複なし、退場車の資源0。150秒以降も最後尾が正しく入れ替わる。

## T10｜現実寄りモデルを四輪・車体回転・衝突へ拡張する

**段階:** 2　**前提:** T04, T07　**対応要求:** R12, R13, R14, R15

**読む場所:** 現行の単純な速度・姿勢式は比較用。T04の数値契約を継承する

**作成:** src/modes/simulation/physics/rigid-body.js、wheel-contact.js、tire.js、suspension.js、powertrain.js、damage.js、tests/physics/reference-model.test.mjs、collision.test.mjs、tests/fixtures/physics-reference.json

**変更:** simulation/physics/vehicle-model.js、config/demo-car.js。共通sweepはT07完成版を使用し、変更が必要なら共有担当の独立PRを先に入れる

**入出力の約束:** VehicleSnapshotの四輪接地・滑り・荷重・回転状態を埋める。ContactEventは位置・法線・相対速度・力積・対象IDを持つ。06の入力（後退意図を含む）はシミュレーターの運動計算に渡すが、指の動きを直接車体速度へ変換しない

- [ ] 先に検査を書く：gravity_reference、suspension_static_balance、combined_tire_force_is_bounded、wet_braking_is_longer、momentum_collision_reference、no_nan_on_rollover、render_rates_match。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：四輪の接地、荷重移動、合成摩擦、駆動/制動、抵抗、回転慣性、連続衝突を組み込む。実車未検証値は推定表示。数値許容差を04の基準へ固定してから調整する。
- [ ] `node --test tests/physics/reference-model.test.mjs tests/physics/collision.test.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t10` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 基準試験と異常入力を通り、ゲーム側の吸着・HP倍率・自動補給が混入しない。物理の限界を文書と画面へ出す。

## T11｜シミュレーターの試験・計測・比較を作る

**段階:** 2　**前提:** T05, T06, T10　**対応要求:** R05, R15

**読む場所:** 既存の速度・高度表示は参考。実車計測値として再利用しない

**作成:** src/modes/simulation/trials.js、telemetry.js、comparison.js、ui.js、export.js、styles/simulation.css、tests/unit/telemetry.test.mjs、tests/e2e/simulation-trials.spec.mjs

**変更:** simulation/session.jsと専用UI。ホームの説明文

**入出力の約束:** startTrial(trialId,config)、finishTrial()、exportTelemetry(format)。記録は設定・版・単位・入力履歴を含み、最大30分/20Hzの上限付き

- [ ] 先に検査を書く：five_trials_have_start_end_retry、same_setup_is_repeatable、changed_setup_is_labeled、csv_has_safe_cells、telemetry_buffer_is_bounded。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：加速・制動・円旋回・左右異摩擦・スラロームを測定。条件を揃えた比較を表示し、設定変更は比較条件の違いとして残す。CSV/JSON出力を端末から保存できるようにする。外部ファイルのimportは追加しない。
- [ ] `node --test tests/unit/telemetry.test.mjs && npx playwright test tests/e2e/simulation-trials.spec.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t11` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 5試験が両端末で開始・中断・再試行でき、測定値の単位・条件・推定値区分を読める。

## T12｜周辺読み込みと描画・メモリの最適化を行う

**段階:** 2　**前提:** T07, T05　**対応要求:** R21, R22, R23, R24, R25

**読む場所:** 都市・電柱全生成、700m非表示、Smoke/Debris/Skidmark、renderer設定、UI毎フレーム更新

**作成:** src/world/chunk-streamer.js、src/rendering/instance-batches.js、resource-cache.js、quality-controller.js、effects-pool.js、scripts/measure-performance.mjs、tests/integration/streaming.test.mjs、tests/performance/scenarios.json

**変更:** rendering/renderer-host.js、world/state.js、ui更新経路。物理ルールを軽量化の名目で変更しない

**入出力の約束:** ChunkHandleは生成/破棄/dirty状態を持つ。ResourceRegistryは所有者別の数と推定容量を返す。測定結果はbuild SHAとqualityを持つ

- [ ] 先に検査を書く：world_instances_are_not_all_created_at_boot、colliders_cover_three_seconds_ahead、destroyed_props_survive_revisit、resource_count_returns_after_twenty_switches、pool_count_is_bounded。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：200m区画、画質別半径、まとめ描画、遠景簡略化、上限付き再利用と資源解放を実装。画質調整は物理・信号・スコアを変えず、往復で品質が頻繁に振動しない。
- [ ] `node --test tests/integration/streaming.test.mjs && node scripts/measure-performance.mjs --suite smoke` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t12` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 計6,184本の電柱を一括生成しない。計測値を保存し、達成していない実機目標を合格と書かない。

## T13｜案内・車体・都市・音・結果画面を仕上げる

**段階:** 3　**前提:** T08, T09, T11, T12　**対応要求:** R01, R03, R14, R16, R20

**読む場所:** 車体モデル、カメラ、破損、ヘリ、煙、天候、既存ヘルプ

**作成:** src/ui/onboarding.js、results-view.js、src/assets/manifest.json、docs/visual-acceptance.md、tests/e2e/visual-scenarios.spec.mjs

**変更:** rendering/vehicle-view.js、camera.js、platform/audio.js、styles/*、両モードのUI

**入出力の約束:** 表示はsnapshotを読むだけ。素材manifestは出典・ライセンス・サイズ・用途を持つ

- [ ] 先に検査を書く：guide_can_skip_reopen、swipe_origin_guide_never_hides_hud、all_critical_controls_visible、damage_has_correct_side、camera_does_not_enter_wall、reduced_motion_disables_shake、audio_off_has_no_active_output。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：操作案内は06のタップ起点・上下左右・斜め・指を離すと惰性・停止後の後退を示す30〜60秒の短い練習を提案し、強制せず再表示可能にする。起点ガイドは視界を妨げず表示ON/OFF可能とし、代替操作は標準画面に大きなペダルを固定しない。運転席/追従の視認性、夜/昼/雨、衝突演出、音量別設定を確認。画質向上でT12の性能を超過したら修正する。
- [ ] `npx playwright test tests/e2e/visual-scenarios.spec.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t13` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 指定した画面・状態の画像を実見して承認。スクリーンショットを保存しただけで確認済みとしない。

## T14｜保存・故障復旧・外部入力の安全性を固める

**段階:** 3　**前提:** T05, T06, T08, T11　**対応要求:** R07, R10, R19, R24, R26, R27, R29

**読む場所:** 起動fallback、ベストタイムのメモリ変数、旧reset、入力・音のイベント

**作成:** src/platform/record-store.js、recovery.js、safe-params.js、tests/unit/storage-security.test.mjs、tests/e2e/fault-recovery.spec.mjs、docs/security-review.md

**変更:** mode-loader、settings-store、両モードの保存/結果/終了経路

**入出力の約束:** 保存スキーマはversion付き。parseAllowedMode(value)は許可値以外をHOMEへ戻す。recoveryは元sessionを廃棄してから新規起動する

- [ ] 先に検査を書く：storage_denied_still_runs、broken_version_migrates_or_resets、url_cannot_select_arbitrary_module、context_loss_pauses、load_timeout_shows_error、resume_does_not_hold_accelerator、swipe_pointer_clears_on_leave、swipe_release_on_orientation_change。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：15秒でロード停滞を案内し再試行/戻るを提供。設定・記録の破損と容量不足は対象だけ復旧し他の保存を消さない。文字列をHTMLとして挿入しない。不要な外部通信・秘密情報・ログ漏洩を検査する。
- [ ] `node --test tests/unit/storage-security.test.mjs && npx playwright test tests/e2e/fault-recovery.spec.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t14` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 壊れた保存、通信断、描画消失でもホームまで戻れる。エラーを起動成功に変換しない。

## T15｜旧結合処理を撤去し、正式ビルドと検査経路を固定する

**段階:** 3　**前提:** T13, T14　**対応要求:** R02, R06, R28, R29

**読む場所:** src/runtime/*.part.js、assets/js/simulator.js、tools/build.mjs、旧CDN・Tailwind実行時読込

**作成:** scripts/check-bundle.mjs、scripts/check-plan-links.mjs、scripts/verify-deployment.mjs、.github/workflows/test.yml、docs/release-runbook.md

**変更:** package.json、lockfile、公開用index.html、CI。旧経路削除と必要な移行記録を含む

**入出力の約束:** npm run check/test:unit/test:integration/test:e2e/test:physics/test:perf/build の公開コマンドを固定。distが公開成果物の正本

- [ ] 先に検査を書く：no_legacy_in_production_graph、no_both_physics_in_mode_chunk、repository_prefix_paths_work、build_is_reproducible、tests_are_not_skipped_on_docs_or_shared_change。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：旧adapterを撤去し、必要なCSSをビルド済みにする。依存を固定し、出力のハッシュとbuild情報を残す。公開先設定の変更は行わず、検証用成果物を作る。main向け公開はT18とユーザー判断で行う。
- [ ] `npm ci && npm run check && npm run test:unit && npm run test:integration && npm run build && node scripts/check-bundle.mjs` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t15` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 新構成だけで両モードを動かせる。全ファイル連結や巨大なwindow状態への依存0。配備の戻し手順がある。

## T16｜全体を同じ候補コミットで自動受入検査する

**段階:** 3　**前提:** T15　**対応要求:** R23, R28, R30

**読む場所:** ここまでに追加した全検査。テスト名だけ存在する空検査は不可

**作成:** docs/evidence/acceptance-index.md、tests/e2e/acceptance.spec.mjs、tests/performance/soak.mjs

**変更:** CIの正式検査ジョブと証拠manifest。対象範囲を理由なく縮めない

**入出力の約束:** RunManifest: commit/build/browser/device/seed/settings/testIds/start/end/artifactUrls。全検査結果をA01〜A60へ紐付ける

- [ ] 先に検査を書く：all_automated_acceptance_pass、sixty_cases_have_status、pursuit_30min_never_exceeds_five、twenty_mode_switches_do_not_leak。既知失敗をskipして成功にしない。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：Chromium/Firefox/WebKitで機能を検査し、スマホ/PCの寸法を切り替える。06のスワイプ運転はA06/A31〜A40/A46へ固定入力と画面実見を加え、指を離した後の入力0、後退への誤切替なし、未選択モードの画面との干渉なしを検証する。ネットワーク遮断・遅延・保存破損・低フレーム化を加える。長時間検査は正式候補でまとめ、通常PRには関連短縮検査を使う。
- [ ] `npm run test:e2e && npm run test:physics && npm run test:perf -- --suite release` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t16` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 全自動検査が同じ候補で合格し、未実施の手動検査だけが明示される。ログ・画像・通信一覧が残る。

## T17｜iPhoneとPCで操作・持続性能・遊びを評価して修正する

**段階:** 3　**前提:** T16　**対応要求:** R16, R17, R20, R23, R30

**読む場所:** T16で検査した成果物と04の実機手順

**作成:** docs/evidence/device-matrix.md、playtest.md、remaining-issues.md

**変更:** 不具合の担当ファイルだけ。修正後は影響する自動試験と正式候補の必要な再試験を実施

**入出力の約束:** 端末型番/OS/ブラウザ/画面実測/画質/温度影響/測定区間を記録。人による遊びやすさの評価を自動性能値と分ける

- [ ] 先に検査を書く：iphone_portrait_landscape_usable、pc_all_actions_reachable、sustained_30min_budget、first_user_understands_two_modes、swipe_start_any_play_area、diagonal_swipe_is_usable、release_coasts_without_input。入力見落としや無理な同時押しがないことを録画・チェック票で確認。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：iPhone 17 Pro Safariの縦横で06のタップ起点スワイプを実際に操作し、画面端・2本指・小刻みな指移動・斜め入力・後退・指の解放を記録する。PCは従来のキー/マウス操作を維持する。ユーザーにPC購入を要求せず、用意できないPC性能項目は未検証として残す。模擬WebKitをiPhone実機と呼ばない。レビュー指摘は担当作業へ戻して修正する。
- [ ] `04の実機プロトコルを実行しRunManifestへ保存。コード修正があればnpm run checkと該当テストを再実行` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t17` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 両端末の操作性が説明でき、実機の性能値が測定される。未検証が残る場合は100点判定へ進まない。

## T18｜6軸を採点し、公開確認と戻し手順で引き渡す

**段階:** 3　**前提:** T17　**対応要求:** R29, R30

**読む場所:** tracker.json、全PR・受入記録・候補build・公開手順

**作成:** docs/evidence/final-scorecard.md、release-verification.md

**変更:** README、進捗索引、公開説明。ユーザー承認後だけ公開処理を実行

**入出力の約束:** 採点は要求R01〜R30の各20点。各軸100点かつ重大問題0件。公開SHAと候補SHAの一致を記録

- [ ] 先に検査を書く：all_six_axes_are_100_with_evidence、no_blocked_or_not_run_case、deployed_build_matches_candidate、rollback_returns_previous_build。
- [ ] 対象機能がない状態で検査を実行し、期待した条件の失敗を記録する。環境エラーは別に解消する。
- [ ] 実装する：機能・実機・画像・性能・安全性を同じ最終候補に揃える。PRマージはユーザーが行う。公開後にURLパス、モード選択、404、保存、版表示を再検査する。ロールバックは以前の成果物へ戻す。
- [ ] `node scripts/verify-deployment.mjs --expected-sha <承認済み候補SHA>。公開前はローカル成果物の検査のみ` を実行し、対象検査が成功することを確認する。さらに既存の `npm run check` と影響する回帰検査を実行し、省略前の結果を保存する。
- [ ] 変更を `feat/t18` 等の専用ブランチへコミットし、進捗・証拠・未検証を更新してDraft PRを提出する。mainへ直接反映しない。

**完了条件:** 採点根拠と公開版が一致する。公開できない、実機未検査、重大不具合ありの場合は完了と書かない。

## 変更の規模と戻し方

1回のWork依頼は原則1作業です。内部で大きくなったら、契約・純粋計算・画面接続のレビュー可能なまとまりに分け、枝番T10a等をtrackerへ追加します。未達の受入条件は元のT10にも残し、小さいPRをマージしたことをT10全体の完了としません。

性能改善・挙動変更・ライブラリ更新を一緒に混ぜません。分離前後の同一入力比較が意図せず変わったら、該当の差分を戻します。生成済みファイルだけ直す、失敗したテストを削る、スキップして緑にする、未実装を同名のダミー関数で通す対応は禁止します。
