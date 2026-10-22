# T04 数値モデルと接続

`src/modes/simulation/index.js` は `createMode(context, options)` と `createTrackRenderer(root)` をexportする。
import時にはDOM・音・タイマー・描画ループを作らない。T02のModeContextをそのまま使い、hostだけがclockと描画を進める。

VehicleModelはゲームと別の実装。snapshotはT02のSI値・単位quaternion・不変コピーで、damageは空、四輪slotはnull。
最小3自由度は並進x/y/zの質点として実装する。標準条件は平坦路で重力と垂直抗力が釣り合い、外力を指定すれば3軸のF=maを検査できる。
姿勢は初期quaternionを保ち、角速度は0。旋回・タイヤ・四輪接地・上下ばね運動・衝突はT10以降で追加する。
`steer`、`boost`、`hover`、`kickflip`はこの段階では運動に影響しない。T06/T05の画面は対応しない操作を表示しない。

## 計算と根拠

駆動力は `maxDriveForce × (throttle - reverseThrottle)`。ブレーキは前後どちらの移動にも逆らう。
空気抵抗は `-0.5 × ρ × Cd × A × |v| × v`、転がり抵抗は水平移動に対して `-m × g × Crr × normalize(vXZ)`。
静止時の抵抗は0。1tickで抵抗が速度を反転させないよう、実際の抵抗を停止に必要な範囲へ制限し、telemetryにも制限後の力を返す。
加速度は合力/質量、速度はv+aΔt、位置はp+vΔt+0.5aΔt²。抵抗はtick開始速度で評価するため、速度依存抵抗の厳密解ではない。
全ての次状態を検証してから置換し、無効入力/overflowで途中まで状態を書き換えない。

デモ値は1500kg、4500N、9000N、Cd0.30、面積2.2m²、Crr0.012、密度1.225kg/m³。
全て`origin:estimated`で実車未検証。重力だけ`reference`（BIPM SI Brochureの標準重力9.80665m/s²）。
各値にunit/min/max/source/versionを持たせ、上下限と単位・出典区分を検証する。外部から設定を変更しても作成済みモデルは変わらない。
ゲームのTRIMS、HP倍率、燃料回復、ロケット、警察・得点・ゲームルールは参照しない。

## 所有権

sessionはREADYで返り、start/pause/resume/reset/disposeを持つ。固定stepはRUNNING時だけ進む。
world/rendererはserviceまたは遅延factory。Abort中に返った資源も解放し、disposeは冪等。解放例外はcleanupErrorsへ記録して他の解放を続ける。
rendererは小さなCanvas2Dの直線試験場であり、ループを持たない。数値snapshotから位置目盛・速度・質量・力・加速度を描く。
T05はモード選択後だけrendererを作り、T06の共通InputFrameを渡す。検査fixtureの「1秒加速」は固定tick検査用で、製品の端末入力の代用とはしない。

最終シミュレーターや実車の再現を完了したという表示は行わない。
