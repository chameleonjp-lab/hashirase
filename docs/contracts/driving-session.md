# T03 ドライビングゲーム実行契約

`src/modes/driving/index.js` は `createMode(context, options)` と `loadScreenAssets()` をexportする。
importでは画面、3D、音、タイマー、描画ループ、グローバルな実行状態を作らない。
T02のcontextの名前とInputFrame/VehicleSnapshotは変更しない。

## 生成と操作

context.worldとrendererはサービス、またはそれを返す遅延factory。サービスはこのsessionに所有権を渡す。
optionsはcourse（PROVING_GROUND/NYC）、trim（ROCKET/THRUST/PERF）、initial.position（m）、
seed（uint32）、legacyControls（既定true）を使う。createMode完了時はREADYで、物理を進めない。

| 操作 | 動作 |
|---|---|
| start | READYからRUNNINGへ。同じ開始を繰返しても二重起動しない |
| pause(reason) | RUNNINGからPAUSEDへ。入力・旧操作・音を止める |
| resume | PAUSEDからRUNNINGへ。経過時間の補填はしない |
| step(dt,input) | RUNNINGだけを計算。dtは秒、InputFrameはT02契約。worldのstep/query、ゲーム計算、ルールを順に呼ぶ |
| reset(initial?) | 指定位置、未指定なら現在コースの原点（試験場z=36、都市z=0）へ戻す。停止中に呼んでも勝手に再開しない |
| snapshot | status/course/trim/score/pursuit/timeAttack/vehicle等の独立した読み取り専用データ |
| dispose | 何度呼んでも安全。入力、adapter、描画、world、音、event channelを解放。他のsessionへ影響しない |

ホストだけが固定時計とRAFを持つ。sessionはcontext.clockを勝手に進めない。
ホストは `renderer.render(session.snapshot(), alpha)` を呼ぶ。終了後はstep/startを拒否し、最後のsnapshotは読める。
同期の解放エラーはcleanupErrorsに記録し、残りのサービスの解放を続ける。非同期disposeの拒否も未処理例外にしない。
VehicleSnapshotのwheelはnullで、旧ホイールの視覚的回転を四輪荷重モデルの完成と取り違えない。

InputFrameを渡した場合、brakeは制動、reverseThrottleが後退駆動となる。
legacyControls=trueかつInputFrame未指定の互換経路では、旧キー/ボタン・自動デモを維持する。
**T05でT06のInputServiceを接続するときはlegacyControls=falseにする。**
旧キー、運転パッド、旧カメラドラッグ、自動アクセルのイベントを無効にし、InputFrameとの二重処理を防ぐ。
明示した旧画面のコース・視点・車種・天候・スタント等の機能ボタンは互換経路に残る。

## 描画と一時adapter

`createRendererHost(container, quality)` はThree r128とDOM/GPU資源を所有し、独自RAFを持たない。
quality.markupへ選んだ画面のHTMLを渡す。各sessionのroot配下だけからIDを探し、windowには実行状態を追加しない。
リスナー、タイマー、constructor/cloneから得たdispose対象を追跡し、終了時にcanvasとroot内容を外す。
diagnosticsのliveResources等は追跡した所有資源の数で、実GPUメモリの完全測定値ではない。

RendererHostの追加能力 `legacySurface` と `attachLegacy/setEnabled` はT03だけの移行用bridge。
coreのstate/physics/rulesはDOMやThreeを必要とせず、rendererが通常のT02 portだけなら数値sessionとして動く。
legacySurfaceがある場合、残る都市・交通・追跡・損傷の表示・演出・操作を**1つの生成adapter**へ収める。
内部の旧接触callbackはこの互換経路にだけ限定し、通常のVehicleModelにはDOM/描画を渡さない。
世界/接触の独立化はT07、ゲームルール完成はT08/T09、都市生成削減はT12、旧経路撤去はT15で行う。
このbridgeを共通サービスの任意状態置場へ広げない。

`src/runtime/*.part.js` は残る旧処理の正本。`scripts/build-driving-adapter.mjs` がモード用factoryを生成し、
`tools/build.mjs` が抽出済みESMをローカルclosureへ結合して従来の公開JSも生成する。
生成物 `assets/js/simulator.js` と `src/modes/driving/legacy-adapter.js` は手編集しない。
移行した数値関数・初期状態・得点/損傷式・描画反映・カメラ・音の実装はそれぞれ1か所だけで、旧断片には呼出しwrapperを残す。

## 必要時の素材取得と音

loadScreenAssetsはモード所有のURL moduleを動的importし、screenURL/styleURLを返す。
URLを得ただけではHTML/CSSを取得・マウントしない。ホストが選択後に取得し、終了時にstyleとDOMを外す。
ゲームHTMLはsrc/assets/driving/screen.htmlへ保存し、T05でindex.htmlをホームに変更しても失わない。
CSSは既存assets/css/simulator.cssを正本として同じ内容を出力する。CSS内url()/@importのT02制限は継続する。

`createAudioService({createContext,random})` はinit/toggle/update/crash/siren/screech/horn/pause/resume/dispose/diagnosticsを持つ。
生成/import時にはAudioContextを作らない。明示した音操作で初期化し、sessionごとに音源を所有する。
継続音と短い音を終了時に停止・切断し、context.closeを呼ぶ。AudioContextを作れない環境でも数値計算を止めない。

新adapterはphysics/visualの乱数系列を分け、煙・テクスチャ・破片・雨が物理乱数を消費しない。
未分類の新しい乱数利用を追加すると生成時に失敗する。旧演出のperformance.now参照はsessionの積算dtへ置換する。
旧公開経路の描画時計とMath.randomはT03では維持するため、ランダムな衝突後の転がり・演出は旧版と同一列とは限らない。
