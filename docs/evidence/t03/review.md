# T03 独立最終レビュー

2026-10-22、独立担当t03_final_review（gpt-6-astra/high）がf44bb23..7b052eaの全差分を確認した。
Critical0件、Important2件、Minor1件。全件を実害に応じて受け入れ、1回の検査先行の修正工程で対応した。追加レビューは行っていない。

| ID / 判定 | 再現 | 修正と検証 |
|---|---|---|
| T03-R1 Important | 後退17.441m/sから1秒のブレーキ後14.447m/s、惰性では8.815m/s。空中静止中のブレーキが逆推力を生む | 共通InputFrameでは前後両方向の運動に逆らう制動、0越えを抑止。空中の逆推力はreverseThrottleへ限定。旧キーは明示互換hook下で維持。後退制動・空中静止・空中後退/制動の検査追加。旧版比較4件も維持 |
| T03-R2 Important | pause→reset→render後、数値速度0に対してHUD124km/hが残る | 物理更新とは別に既存の描画反映関数を呼べるwrapperを作り、生成adapterの初期化/リセット時にdt0で適用。tickを進めずHUD速度0と高さ23.0ftを検査・画像確認 |
| T03-R3 Minor | resetの指定y7mをadapterだけが0へ落とす | 作成時と同じく指定yを適用。停止中のresetでxyzと高さHUDを検査。R2と同じ数行の境界修正なので今回対応 |

[ブレーキRED](logs/red-review-brake.log)、[高さRED](logs/red-review-reset.log)、[HUD RED](logs/red-review-reset-HUD.log)を保存。
Chromiumパス未指定の初回環境エラーは別ログに保存し、機能REDには数えていない。
最初の修正後の-0/0不一致は[観測ログ](logs/review-fix-signed-zero.log)へ保存し、共通制動の静止値を0に正規化した。
[修正対象GREEN](logs/review-fix-target.log)、[全Node46件](logs/regression.log)、[全ブラウザ10件](logs/browser-regression.log)が成功。
停止中リセットの[画像](images/driving-paused-reset.png)では速度0km/h、高度23.0ft、車両が表示されていることを目視確認。

## 判断と持越し

- 1つの生成legacy adapterによる段階移行を許容する。世界/交通/結果/追跡/描画性能の完成はT07/T08/T09/T12/T15の責務で、T03へ混ぜない。
- 共通InputFrameのbrake契約を優先し、旧キーの後退動作を互換hookへ限定する。T05/T06ではlegacyControls:falseが必要。
- 今回の未修正Minorは0件。T01由来TEST-T01-01（load fault検査のtimer競合）、既存検査用Tailwindのaudit7件は引き継ぐ。
- 詳細な判断5項目と代償は[t03.md](../t03.md)へ記載。実機とA01〜A60、全入力での乱数衝突の完全一致は未検証。
