# T05 独立最終レビュー

2026-10-22、t05_final_review（gpt-6-astra/high）がd351d143..010f24b4の全差分を独立レビューした。Critical0 / Important3 / Minor0。全件を先に整理し、再現を伴うT05導入の不具合として3件とも判定を受け入れた。以下の1回の検査先行修正工程で対応し、再レビューは行わない。

| ID / 判定 | 再現と判断 | 修正方針・代償 |
|---|---|---|
| T05-R1 Important | 非同期dispose待ちのA→B→Cやleave→leaveで前の解放を追い越す。実セッション/音が残るのに診断は先に0へ戻る | host全体の解放barrierを全遷移で待つ。診断は解放完了後に減らす。取消不能importは待たないが、実資源の終了は待つためHOME移行が解放完了まで遅れる |
| T05-R2 Important | 旧ゲームの結果内容と再挑戦が別の入力面/パネルに隠れ、キーボードで旧retryだけ実行してもhostがRESULTのまま | 既存の理由/得点/タイムを残して結果面を最前面へ。再挑戦/自由走行はmode専用の結果操作をhostの時計・入力・再開と協調させる。移行adapterの明示portが1つ増える |
| T05-R3 Important | SIMの低画質を保存しても起動時/resizeで生のdevicePixelRatioへ上書き | resizeのたびに保存画質と端末DPRから有効解像度を導出。low=.75、balanced=min(DPR,1)、high=min(DPR,2)。高DPRの画素数に上限を設ける |

候補010f24bの104Node・52browserと両Actionsは成功していたが、これらの競合・結果・画質の追加条件は検査に不足していた。新しいRED、修正後の全回帰、最終CIは本ファイルとt05.mdへ追記する。既存TEST-T01-01とaudit7件以外の持越しは最終検査後に確定する。
