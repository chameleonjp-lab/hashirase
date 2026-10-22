# T06 独立最終レビュー

2026-10-22、t06_final_review（gpt-6-astra/high）が48508af..ebe98deの全差分を独立レビューした。
Critical0、Important6、Minor3。全件を先に整理し、再現された実害に応じて判定を受け入れた。
1回の検査先行修正工程で全9件に対応し、追加レビューは行っていない。

| ID / 判定 | 再現 | 修正と検査 |
|---|---|---|
| T06-R1 Important | 代替前進ボタンでSpace保持→Tab→Space解除後も前進。pointerとSpaceの片方解除が同じボタンの他方も消す | pointerId/キーcode/読み上げtoggleを別sourceにし、keyupはwindowで押下元を解放。Tab後の解除、pointer保持中のSpace解除を検査 |
| T06-R2 Important | 後退が300ms待機済みの後、sample間で解除→再押下すると待機を再利用する | source/swipeの変更時点で実効後退要求が切れたら猶予を即時破棄。通常sourceと、スワイプ中立/前進経由を検査。別の操舵sourceは保持 |
| T06-R3 Important | W保持+mouse pointercancel、または加速swipe+追加ボタンlostcaptureで他の入力が残る | 異常cancel/lostcaptureは全解放。通常pointerupでは先に所有記録を消し、正常なcapture解除は他入力を消さない。両異常経路と既存混在入力検査で確認 |
| T06-R4 Important | 実mousecaptureがclear/dispose後も残る | 忘れる前に所有captureを解放。実Chromiummouse down/moveでhasPointerCaptureを確認し、clear/dispose後falseを検査 |
| T06-R5 Important | 2本目の視点操作が主swipeを全解除 | カメラclickから全解除を外し、入力と独立させる。主指を動かし続けられることを検査 |
| T06-R6 Important | 保存例外の警告を更新した直後にdialogを閉じ、警告が見えない | メモリへ適用し、保存不能時はdialogを開いたまま通知。利用者が閉じるまで警告が見えることとmemory値を検査・画像確認 |
| T06-R7 Minor | localStorage取得自体がSecurityErrorだとreference fixtureが起動しない | 契約どおり取得を捕捉してundefinedを渡す。APIを失敗させてもUI起動/通知が成立する検査 |
| T06-R8 Minor | formの空白や通常の子要素でswipeが始まる | 除外selectorにform祖先を追加。formの本文/余白からの入力0を検査 |
| T06-R9 Minor | キーをQに変更しても案内がWのまま | inputHelpを現設定から生成し、適用後に更新。Q案内とQからの実入力を検査 |

[単体RED](logs/red-review-unit.log)は2件、[ブラウザRED](logs/red-review-browser.log)は8件の意図した失敗。環境エラーではない。
修正後は[対象23 Node](logs/target-unit.log)、[対象25browser](logs/review-fix-browser.log)、[通常69 Node](logs/regression.log)、[全35browser](logs/browser-regression.log)が成功。
9件とも修正し、新しいMinor持越しは0件。T01由来TEST-T01-01と既存audit7件は引継ぐ。

## 判断と代償

- 入力の所有者をpointer/キー/toggleへ分ける。管理Mapは増えるが、片方の解除が他方へ影響せず、再設定/終了でlistener0とcapture解除を検査する。
- 後退の連続性は描画やsampleの間隔に依存させない。入力変更時にも状態を確認する小さな処理が加わる。
- 保存不能時はメモリ設定を適用しつつ、警告を開いたdialogへ残す。利用者が閉じる操作は必要だが、保存できたように見せない。
- 軽微3件は同じ呼出し/selector/案内境界の数行で対応できるため、今回まとめて修正した。実機やT05完成を完了条件へ追加していない。
- その他の初期値・端の移動距離・共通設定callbackの責務・実機未検証は[t06.md](../t06.md)と[接続契約](../../contracts/device-input.md)に記載。
