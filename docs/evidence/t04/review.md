# T04 独立最終レビュー

2026-10-22、独立担当t04_final_review（gpt-6-astra/high）がf44bb23..c7219c0の全差分を確認した。
Critical0、Important2、Minor0。全指摘を先に整理し、実害に応じImportantとして受け入れた。1回の検査先行修正工程で両方を対応し、追加レビューは行っていない。

| ID | 再現 | 修正・検査 |
|---|---|---|
| T04-R1 Important | world factoryの待機中にabortしても事前renderer/input/audioが残る。worldが遅れて成功/失敗した後もrendererが解放されない。不正configはcleanup範囲より前で失敗する | supplied serviceの所有権とabort listenerを先に確立。abortで即時全解放し、遅れて返るserviceも1回だけ解放。config検証もcleanup範囲内へ移す。待機中abort、遅延成功、factory失敗、不正configの検査を追加 |
| T04-R2 Important | 各速度成分1.1e308が有限でも合成速度Infinityを状態へ確定できる。snapshot失敗がdisposeも止める | reset/stepの派生速度と全snapshotを変更前に検証。cleanupはsnapshot例外を捕捉し、必ず他serviceの解放を続ける。reset/stepのoverflow拒否と状態不変、sessionの解放を検査 |

3件の[RED](logs/red-review.log)は意図したassertion失敗。[全対象16件](logs/target.log)、[通常回帰48件](logs/regression.log)、[全5browser](logs/browser-regression.log)が成功。
ソースSHA256と画像/数値を更新し、直線試験場の表示内容に変更はない。

判断：作成呼出し時に渡されたserviceを引き受け、初期化の成否によらず解放する。遅延factory完了まで解放済IDを保持するため、未完了Promiseが残る間は小さな追跡集合が残るが、実行中資源は残さない。モード自身はloopを作らない。
今回のMinor持越しは0件。3軸並進、推定値、抵抗の有限tick近似、Canvas2Dという判断と代償は[t04.md](../t04.md)に記載。
T01由来TEST-T01-01と既存検査依存audit7件は引継ぐ。T05統合、実機・実車・最終受入A01〜A60は未検証。
