# T02 基盤契約 v1

正本は計画書02・03・06。T03/T04/T06は以下の公開名と単位を利用し、契約を独自に改名しない。
新しいAPIは副作用のないESMとしてimportできる。型注釈は各 `.js` にあり、検証関数はNodeでも実行できる。
モード実装・ホーム画面・端末入力の接続はT03以降。旧ゲームの時計・乱数・走行ルールはT02では移行しない。

## 入力と車両

`src/contracts/vehicle.js`：

| 公開API | 約束 |
|---|---|
| `createInputFrame(partial={})` / `assertInputFrame(frame)` | throttle/brake/reverseThrottleは0..1、steerは-1..1、boost/hover/kickflipはboolean。欠損reverseThrottleは0として既存の入力形式とも接続できる |
| `createSwipeFrame(partial={})` / `assertSwipeFrame(frame)` | horizontalは右正、verticalは上正、各-1..1。active時は非負整数pointerId。非active時は両軸0とpointerId=null |
| `createVehicleSnapshot(state)` / `assertVehicleSnapshot(state)` | position/velocity/angularVelocity、単位quaternionのrotation、wheels[4]、damage、telemetry。NaN/Infinity・循環・Three.jsオブジェクト等を拒否 |
| `WHEEL_IDS` | FL、FR、RL、RRの順 |

constructorは入力を変更せず、独立した読み取り専用結果を返す。
`createInputFrame` はブレーキ入力を優先して両駆動を0にし、前進と後退の同時要求は両方0へ解決する。
`assertInputFrame` は競合したサンプルを拒否する。停止0.15m/s・300ms猶予の後退切替と各入力源の合成はT06の責務。
スワイプの画面座標変換・起点計算はT06で実装するため、T02の軸検証を完成した操作UIと扱わない。

Snapshotの位置はm、速度m/s、角速度rad/s。SI以外への変換は画面側で行う。
wheelは `{id,position,angularVelocity,contact,normalForce,rotation?}`。接地していない輪のnormalForceは0。
未モデル化の輪は `null` を使い、T04の直線モデルで四輪完成を装わない。
damage/telemetryはモードが定義する有限値のplain dataで、UIや描画へ内部状態を渡さない。

## モードと部品

`src/contracts/session.js` の `assertModeSession` は start/pause(reason)/resume/step(dt,input)/snapshot/dispose を固定する。
stepは同期処理、時計も描画ループもホストが所有する。disposeは何度呼んでも安全にする。
T03/T04が必要とするreset(initial?)は追加のモード固有入口として許可する。
各モードは `createMode(context,options): Promise<ModeSession>` をexportし、import時には起動しない。

`assertModeContext` はclock/input/settings/world/renderer/audio/events/abortSignal/sessionIdだけを受け取る。
world/rendererはサービスか遅延factory。worldのstep/query/reset/dispose、描画のrender/resize/dispose、
入力のsample/clear/dispose、設定のread(profile,mode)/write(profile,mode,value)を型注釈と検証で固定した。
audioの実装はT03、追跡step/snapshot/resetの実装はT09。contextに任意の共有状態を追加しない。

## 時計・乱数・イベント

```js
const clock = createFixedClock({ step: 1 / 120, maxSteps: 8 });
clock.advance(activeElapsedSeconds, (dt, tickIndex, simTime) => {
  // tickIndexは0から。入力列は描画フレームではなくtickIndexに対応させる。
  session.step(dt, inputForTick(tickIndex));
});
const state = clock.snapshot();
```

`src/platform/clock.js`：advance/pause/resume/reset/snapshot。自分でRAF・Date・performanceを読まない。
snapshotはstep/maxSteps/ticks/simTime/activeTime/backlog/alpha/paused/pauseReason/valid。
1呼び出し最大8tick。100msを超えて滞留したらoverloadで中断しvalid=false、未処理時間はbacklogに残す。
短い滞留は次のadvanceで追いつける。float比較の許容はstep×1e-9秒で、時間を上限へ丸めて捨てない。
経過時間は補償加算で積算し、30/60/120fps相当の10分間でも同じ72,000tickを維持する。
非表示・blur時はホストがpauseして入力を消し、復帰時は明示再開を求める。pause中の経過秒は加算しない。
無効化した走行はresetまで再開できない。競争記録の無効通知はT05/T08のホスト・ルールへ接続する。
同期stepの例外・Promise返却はstep-errorとして中断・無効化する。

`src/platform/random.js`：`createRandom(uint32Seed)` → next/fork(label)/reset(seed?)/snapshot。
Mulberry32 v1。physicsとvisualを別々にforkし、表示側の乱数消費で走行を変えない。
forkは最初のseedとlabelから決め、親の消費順に依存しない。暗号用途には使わない。

`src/contracts/events.js`：`createEvent` / `assertEvent` / `createEventChannel(sessionId)`。
イベントはeventId/sessionId/type/simTime/payload。channelのemit/subscribe/disposeで所有する。
他sessionを拒否し、同eventIdの再送はfalseを返して再配信しない。payloadは独立した読み取り専用値。
ID集合はsession終了で解放する。イベントを再利用して得点を二重加算しない。

## ビルドと境界

`npm run build` は既存結合ファイルを照合可能な形で生成した後、esbuild 0.28.2で
format=esm/splitting=trueを使い、dist/build-manifest.json（入力SHA-256・出力・入口）とmetafile.jsonを出す。
src/app/main.jsがない現在は5つの基盤入口だけをビルドし、phase=foundationと明記する。
ホームや動く2モードの代わりのダミー画面は作らない。distは生成物で手編集・Git登録しない。

CSS・画像・音は明示的なURL importにする。bare CSS importを禁止し、共通CSSに両モードが結合されることを防ぐ。
asset module内の `new URL(path, import.meta.url)` で絶対URLへ解決する。chunk移動や `/hashirase/` 配下でもページ位置に依存しない。
現段階のCSSは自己完結したものだけを許可する。`url()`・`@import`（data/外部URL・エスケープ表記を含む）は
esbuildのCSS解析で検出してビルドを失敗させる。file loaderで依存先を黙って欠落させないための制限である。
画像や音はJavaScriptから明示importし、必要なら取得したURLを選択モードの要素へ設定する。
CSS内依存を使う場合は、先に依存の解決・出力・URL書換え・境界検査を追加する必要がある。
T05が選択したモードだけをマウントし、終了時に取り外す。
T02のfixtureはJS/CSS/SVGを分割して検査するが、実際のネットワーク取得0件と終了処理の合格はT05で検査する。

`npm run check:boundaries` はAcorn 8.19.0でstatic import/re-export/literal dynamic importを解析し、
モード間・共通→モード・ホームのstaticモード参照・循環・global書込み・計算からの描画依存を失敗にする。
物理のDOM/音/保存/非seed乱数、モード独自RAFは共有helperを経由しても検査する。
computed importとCommonJSを拒否。出力metafileも検査し、共有chunkにモードを混入する変更を失敗にする。
旧src/runtimeの11断片は明示的な除外で、npm run checkの従来検査とT01ブラウザ検査を続ける。A11全体合格とはしない。
