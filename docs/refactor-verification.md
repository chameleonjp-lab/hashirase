# 初回フォルダ分割：照合記録

元の `index.html` に対してスタイル・スクリプトを切り出し、展開し直した内容の照合を実施。

- 元HTML: 7,017行・287,639バイト
- Git blob SHA: `ff9858af40bad7ca5f891ad2626509698630ab1f`
- 元HTML SHA-256: `b7a4778c23eb31c1bcdaad99b0268d4ff6760d4b63c4156b8d77e390a7eb0a14`
- スタイル1本・インラインスクリプト4本を元の位置に戻すと元HTMLと完全一致
- ゲーム用11ソースの結合結果は元のゲームスクリプトと完全一致
- ローカルのJavaScript構文と画面要素参照検査は成功
- ブラウザ試験は環境のローカルURL遮断で未実施

## 旧index.htmlの対応行

| 編集用ソース | 元ファイルの行 |
|---|---|
| `src/runtime/00-boot-audio.part.js` | 1067–1304 |
| `src/runtime/10-renderer-track.part.js` | 1305–1676 |
| `src/runtime/20-nyc-traffic.part.js` | 1677–2256 |
| `src/runtime/30-utility-poles.part.js` | 2257–2569 |
| `src/runtime/40-time-attack.part.js` | 2570–2977 |
| `src/runtime/50-police-scoring.part.js` | 2978–3457 |
| `src/runtime/60-collisions-damage.part.js` | 3458–4441 |
| `src/runtime/70-vehicle-model.part.js` | 4442–4921 |
| `src/runtime/80-interface-input.part.js` | 4922–5433 |
| `src/runtime/90-world-effects.part.js` | 5434–6304 |
| `src/runtime/99-physics-loop.part.js` | 6305–7014 |

今後の変更ではソースの追加・更新が必要です。元のSHA-256はこの分割作業に限定した基準値であり、将来の機能変更時に一致する必要はありません。
