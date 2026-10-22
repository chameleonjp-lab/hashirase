# T06 入力・設定の契約

T02のInputFrame/SwipeFrame/ModeContextを変更しない。T06はplatform/ui/stylesと契約fixtureを持ち、appや相手modeをimportしない。

## 接続

1. pointer/hoverとmaxTouchPointsで`detectDeviceProfile`を使う。fine pointer + touchはhybrid、touchのみはtouch、それ以外はdesktop。手動overrideも可能で、幅だけでは決めない。
2. `createSettingsStore(storage)`のread(profile,mode)で設定を読む。キーは`hashirase:settings:v1:{profile}:{mode}`で、6区分が独立する。storageの取得自体が例外になる環境では呼出し元も取得を捕捉し、undefinedを渡す。
3. `createInputService(profile,{mode})`を作り、専用の走行領域へ`mountTouchControls(surface,{input,profile,mode,settings,toolbar,onCamera})`、`mountKeyboardControls(surface,{input,profile,mode,settings,onCamera,onLook})`を接続する。
4. hostの固定tickごとに`input.sample({dt,longitudinalSpeed})`を1回呼び、ModeSession.step(dt,frame)へ渡す。longitudinalSpeedは車首方向への符号付き水平速度(m/s)、前進が正。引数なしsample()は観測用で後退猶予を進めない。
5. `mountSettings(container,{store,profile,mode,input,onApply,onOpen,onClose,onProfileChange})`で設定を開く。onOpenでhostは走行を中断する。閉じてもhostの走行は自動再開しない。onApplyでtouch/keyboard.configureと画質/fps/音/視点/表示等のhost設定を適用する。
6. mode離脱/故障時はinput.clearとbinder/settings.dispose、session.disposeを呼ぶ。T03では必ずlegacyControls:falseを使い、旧キー/カメラドラッグを二重に登録しない。

InputServiceはsetSource/removeSource、setSwipe、clear、setEnabled、isEnabled、onClear、disposeを持つ。source名で保持状態を独立管理し、片方の通常解放が他方のキーを消さない。明示制動が駆動より優先し、前進と後退の競合は中立になる。シミュレーターではゲーム用3操作を常にfalseへ変換する。

## スワイプと停止後退

起点は最初のpointerIdだけが所有し、移動や2本目の指では変えない。2本目を自動昇格しない。
上/右を正とし、軸ごとに`sign(delta) × clamp((abs(delta)-deadZone)/(maxDistance-deadZone)×sensitivity,0,1)`。
初期値は10/88 CSS px、感度1。タップ・起点へ戻す・離すと0で、離した後は制動を維持しない。
下方向/後退キーは速度の絶対値0.15m/s以下が連続300msに達するまでbrakeだけを渡す。実時間のtimerではなく固定dtを使う。前進再開・解除・中断で猶予を消す。
画面端でも起点をずらさず、初期入力は0。端へ向かう移動可能距離は画面に制約されるため感度は実機で調整が必要。端のガイドは操作領域で切り取り、起点と表示位置を一致させる。

運転スワイプはtouch/penだけ、マウスは専用ドラッグ視点。対象は走行領域だけで、button/link/form/dialog/data-no-driveを除外する。ページ全体へtouch-action:noneを設定しない。
指離しはその指のsourceを解除し、pointercancel/lostcapture/blur/hidden/回転/resize/設定/終了は全解放する。各binderは所有listenerとcaptureを解放する。

## UIと保存

標準ペダル・自動アクセルは表示しない。任意の代替操作は前進・制動・後退・左右の明示ボタン。pointer/キーで保持し、読み上げ等のclickは押下状態の切替として扱う。blur等で必ず解除する。
特殊ボタンはdrivingのtouch/hybridだけ。desktopはキー割当/マウス、touchはスワイプ、hybridは両方の設定を出す。simulationへ特殊キーを出さない。
一般の操作対象は44px以上、主要ボタン56px、safe-areaとdvh、フォーカス表示、200%文字拡大とscroll可能なdialogを用意する。
保存は検証済みv1値だけ。不正JSON/版/範囲/大きさ/キー重複を拒否し対象設定に初期値を使う。API例外でもメモリで継続し、status.messageで保存不能を表示する。他モードや記録を削除しない。

T06単体のfixtureはInputFrameまでを検査する。実際のモード/ホームとの結合と画質/fps/音の適用はT05、iPhone/Safari/VoiceOverや長時間応答測定はT17で確認する。
