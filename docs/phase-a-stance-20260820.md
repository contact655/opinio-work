# フェーズA 調査：「転職の希望」→「声をかけられてもよいか」（2026-08-20）

**調査のみ。実装・DB書き込みはしていない（SELECT と grep だけ）。**
実ユーザーの集計は `is_test` / `is_system` / `@seed.internal` を除いた値。

---

## 要旨（先に4行）

1. **相手軸の列（`can_talk_to_candidates` / `can_talk_to_hr`）は2本とも完全に死んでいる。**
   書く経路も読む経路も無く、実ユーザー15人全員が `false`。
   **「ズレているのは画面だけ」ではなく、列の側も動いていない。**
2. **実際にスカウトの可否を決めているのは `ow_profiles.scout_enabled` 1本だけ**
   （`can_send_scout()` が見ているのはこれ）。相手軸の2列は一切見ていない。
3. ⚠️ **右サイドバーは、いま何も描画されていない。** `rightColumn` を渡す画面が0件
   （フェーズ5で外したまま）。指示書の「現在3ブロック」は**過去の状態**。
4. ⚠️ **「既定オンで畳む」は、いまの列では表現できない。**
   `can_talk_to_*` は `NOT NULL DEFAULT false` で「未選択」を持てない。
   3状態が要るなら nullable にする migration が要る（詳細は調査4）。

---

## 調査1：いまの列の実態

### 1-1. 定義と分布（実ユーザー15人 / うち `ow_profiles` の行があるのは13人）

| 列 | 型 | NULL | 既定 | CHECK | 分布（実ユーザー） |
|---|---|---|---|---|---|
| `ow_profiles.scout_enabled` | boolean | **可** | `true` | — | **true 11 / false 0 / null 2**（＋行が無い人が2） |
| `ow_users.can_talk_to_candidates` | boolean | 不可 | `false` | — | **true 0 / false 15** |
| `ow_users.can_talk_to_hr` | boolean | 不可 | `false` | — | **true 0 / false 15** |
| `ow_users.can_casual_meeting` | boolean | 不可 | `false` | — | true **1** / false 14 |
| `ow_users.is_open_to_work` | boolean | 不可 | `false` | — | true **3** / false 12 |
| `ow_users.is_mentor` | boolean | 不可 | `false` | — | **true 0** |
| `ow_users.is_active_mentor` | boolean | 不可 | `false` | — | **true 0** |
| `ow_users.visibility` | text | 不可 | `'login_only'` | public / login_only / private | **login_only 15**（public 0 / private 0） |

⚠️ **`ow_profiles` の全50行では `scout_enabled` の null が36件。**
   指示書の「null 36人」はこの数字で、**実ユーザーに限れば2人**
   （残りは検証用アカウントと、`ow_users` に対応の無い孤児20件）。

### 1-2. 「転職検討」に相当する列は**2本に割れている**

| 列 | 置き場 | 中身 | 分布 |
|---|---|---|---|
| `ow_users.is_open_to_work` | ow_users | 転職検討中かどうかの**真偽** | true 3 |
| `ow_profiles.transfer_timing` | ow_profiles | **時期**（text。CHECK は無く、許容値はコード側の `VALID_TRANSFER_TIMINGS`） | 値あり2（`1〜3ヶ月以内` / `1年以内`） |

現在の選択肢5つ（`TRANSFER_TIMINGS`。**値そのものが日本語**）:

| value | label |
|---|---|
| `即時` | すぐにでも（即時） |
| `1〜3ヶ月以内` | 1〜3ヶ月以内 |
| `半年以内` | 半年以内 |
| `1年以内` | 1年以内 |
| `情報収集中` | まだ情報収集段階 |

⚠️ **`ow_profiles` には CHECK が1本も無い**（実測0件）。`transfer_timing` も
`desired_phase` も `desired_work_styles` も、DB 側のガードが無い。
⚠️ 値が日本語なので、**新しい3択に移すなら値の書き換え（データ移行）が要る**。
   英字スラッグに変えるかどうかも同時に決めること（`careerReasons` は英字に統一している）。

⚠️ **CHECK が無い。** 許容値は `src/lib/constants/careerPreferences.ts` だけが持っている
（CLAUDE.md「UI / API / DB の CHECK を3つ揃える」の対象。**DB 側が欠けている**）。

### 1-3. ★重複している列

| 重複 | 判定 |
|---|---|
| `can_talk_to_hr` と `scout_enabled` | **意味が重なる**（企業から声をかけられてよいか）。ただし**効いているのは `scout_enabled` だけ** |
| `can_casual_meeting` と `can_talk_to_candidates` | **重ならない。** 前者は**運営が設定する「この人は面談を受けてよい」**（本人は触れない）、後者は**本人の意思表示**（ただし死んでいる） |
| `is_mentor` / `is_active_mentor` | 実データ0。メンター機能自体が無い（CLAUDE.md にも「`ow_mentors` は DROP 済み」） |

**意見（重複をどう寄せるか）は末尾の「意見1」に書いた。**

---

## 調査2：それぞれの列が「効いている」か

| 列 | 書く経路 | 読む経路 | 効いているか |
|---|---|---|---|
| `scout_enabled` | 本人 `PUT /api/jobseeker/scout-settings`（＋オンボ時の trigger 既定） | **`can_send_scout()`**（RPC）/ `/biz/candidates`（候補者の抽出条件）/ `/mypage` の表示 | ✅ **挙動を決めている** |
| `can_talk_to_candidates` | **無い**（運営トグルは 2026-08-05 に削除） | **無い**（`/admin/candidates` のコメントに名前が出るだけ） | ❌ **死んでいる** |
| `can_talk_to_hr` | **無い** | **無い**（`admin/candidates/actions.ts` のコメントのみ） | ❌ **死んでいる** |
| `can_casual_meeting` | **運営のみ**（`/admin/candidates` の `CanCasualMeetingToggle`） | `/u/[id]`・企業ページの社員・`/people`（directory） | ⚠️ 効くが**本人が触れない** |
| `is_open_to_work` | 本人 `PUT /api/jobseeker/profile` | `/u/[id]` のバッジ / `/biz/candidates` のカード | ⚠️ **表示のみ**（絞り込みに使っていない） |
| `visibility` | 本人 | RLS・middleware・DM の可否・各一覧 | ✅ **強く効く** |
| `transfer_timing` | 本人 `PUT /api/jobseeker/career-preferences` | `/biz/candidates` に**表示のみ**（コメントに「絞り込みには使わず表示だけ」と明記） | ⚠️ 表示のみ |

### `can_send_scout()` が見ているもの（実測・関数定義から）

```
1. coalesce(ow_profiles.scout_enabled, false)   ← ★同意はここだけ
2. その企業に在籍したことがない（company_id / 正規化社名の両方で判定）
3. ow_scout_blocks に無い
4. is_solicitation_blocked() でない（転職勧奨の禁止期間）
```

⚠️ **`can_talk_to_hr` も `can_talk_to_candidates` も見ていない。**

### ★DM とカジュアル面談のゲート（相手軸のはずが、相手軸で見ていない）

| 導線 | 実際の条件 |
|---|---|
| `POST /api/dm/start`（個人から声をかける） | **`ow_users.visibility` だけ**（private / 未ログインの login_only を弾く）。`can_talk_to_candidates` は見ていない |
| カジュアル面談の申込 | **企業側の設定**（`ow_companies.accepting_casual_meetings` ＋ 通知の宛先が居ること）。`ow_users.can_casual_meeting` は**申込可否ではなく導線の表示**にしか効かない |

**→「入力させているのに誰も読んでいない」列は `can_talk_to_candidates` と `can_talk_to_hr`。**
ただし**入力させてもいない**（書く経路が無い）ので、正確には「用意しただけの列」。

---

## 調査1-b：意思表示の「更新時期」を持てるか

### 1-b-1. 既存の `updated_at` は代用できない（実測）

⚠️ **`ow_profiles` にも `ow_users` にも trigger は1本も無い**（`pg_trigger` 実測 0件）。
`updated_at` は**アプリが明示的に書いたときだけ**動く。そして書く経路が複数ある。

| 経路 | `ow_profiles.updated_at` を触るか |
|---|---|
| `PUT /api/jobseeker/scout-settings` | ✅ 触る |
| `PUT /api/jobseeker/career-preferences` | ✅ 触る |
| `PUT /api/jobseeker/email-settings` | ✅ 触る |

**→ メール通知を切り替えただけでも動く。「意思表示をいつ更新したか」には使えない。**

### 1-b-2. ★同じ形の列が**既にあり、動いている**

**`ow_profiles.transfer_timing_updated_at`**（2026-08-07 追加）。

| | |
|---|---|
| 書き方 | `career-preferences` の中で、**保存前の値と比べて実際に変わったときだけ** `now()` を入れる（同じ値を選び直しても更新しない） |
| 読み方 | `src/lib/profile/freshness.ts` の `describeFreshness()` / `STALE_AFTER_MONTHS = 3` |
| 出る場所 | `/biz/candidates` のカード（「転職時期: 1年以内（3ヶ月前に更新）」＋しきい値超過で淡色＋注記） |
| 実データ | **0件**（2026-08-07 以降に `transfer_timing` を**変更した人がいない**ため。バグではない） |

**→ `stance_updated_at` は、この列の作り方をそのまま写せばよい。**

### 1-b-3. 時期での絞り込みは**まだ無い**

- `/biz/candidates` … `transfer_timing_updated_at` は**表示のみ**（コード内コメントに明記）。
  絞り込みは職種 / 希望条件 / 社会人年数 / 居住地 / 雇用形態などで、**時期の条件は無い**。
- 求職者側 … `describeFreshness` を使っている画面は**`/biz` 側だけ**。
  **「最後に答えてから半年経っています」に相当する表示は求職者側に無い。**

### 1-b-4. 実装方針（意見）

**アプリ側で明示的にセットする。トリガーにしない。**

- 既に `transfer_timing_updated_at` が**アプリ側の比較で動いており**、同じ場所に足せる。
  **同じ意味の列で作り方が2通りになるほうが害が大きい。**
- トリガーでも「対象列だけを見る」形は書ける（`IS DISTINCT FROM` で OLD/NEW を比較）。
  ただし **`ow_profiles` / `ow_users` には現在 trigger が1本も無い**ので、
  ここで1本目を作ると「この表は trigger が無い」という前提が崩れる。
  ⚠️ しかも**主スイッチの列がまだ決まっていない**（調査4）。
  **列が決まってから、その保存 API に1行足すのが最小**。

**→ フェーズBで列が確定してから実装する、で問題ない。**

⚠️ **ただし「早いほうがいい」列であることは強調しておく。**
この列は**新しく保存した人からしか埋まらない**。既存の人はいつ答えたか記録が無く、
**遡って埋められない**（`transfer_timing_updated_at` が0件のまま1年が経つのと同じ形になる）。

---

## 調査3：いまのUIの構造

### 3-1. 「転職の希望」カード

**`src/components/profile/editor/CareerIntentBox.tsx`**（`/mypage` 本文・ヘッダーの直下）。

要約行は3つ。

| 行 | 出している値 | 元の列 |
|---|---|---|
| 公開範囲 | `PROFILE_VISIBILITY_OPTIONS` のラベル（「ログインユーザーのみ（初期設定）」など） | `ow_users.visibility` |
| スカウト | 「スカウトを受け取る」/「受け取らない」/ 未選択 | `ow_profiles.scout_enabled` |
| 転職検討 | **「転職検討中」/「いまは考えていない」** | `ow_users.is_open_to_work` |

✎ を押すと7項目のモーダル（畳んだ行を含む）。保存は**3系統のAPIを個別に叩き**、
失敗した系統だけを名指ししてモーダルを開いたままにする作り。

### 3-2. ⚠️ 右サイドバーは**いま存在しない**

`MypageLayout` は `rightColumn` prop と CSS（`.mypage-right-aside`）を持っているが、
**渡している画面が0件**（`grep` 実測）。フェーズ5で中身を外したまま prop だけが残っている。

**→ 指示書の「現在3ブロック：公開促進・スカウト設定・企業向け導線」は過去の状態。**
   フェーズBで右カラムに移すなら、**カラムごと作り直す**ことになる（差し替えではない）。

### 3-3. 767px 以下の扱い（CSS は生きている）

```
@media (max-width: 767px) {
  .mypage-desktop-grid { display: flex; flex-direction: column; }
  .mypage-left-aside   { display: none; }
  .mypage-right-aside  { order: -1; ... }   ← 本文の上に出る
}
```

⚠️ CSS のコメントに「**控えを本文側に作らない。同じ要素を order で動かす**」と明記されている
（同じ内容を2箇所に持つと片方だけ直る不具合になる、という過去の失敗から）。
**フェーズBでもこの原則を守れる。**

### 3-4. 「設定」の現在地 ── 公開範囲の移設先として妥当か

| 画面 | 中身 |
|---|---|
| **`/mypage/settings`** | ログイン情報 / メール通知 / アカウント削除 の**3つだけ**。冒頭コメントに「⚠️ **公開範囲・スカウト設定・転職検討状況はここに置かない**」と明記 |
| `/profile/edit` の「設定」タブ | **2026-08-17 に削除済み**（`SettingsTab.tsx` はファイルとして残っているが、描画されていない。`SettingsState` 型だけが `ProfileTab` から参照されている） |

⚠️ **移設先として妥当だが、コメントを書き換えることになる。**
   いま「置かない」と明記されているのは、**同じ列を触る画面が2つに割れた過去**があるため。
   移すなら「**ここが唯一の置き場**」に書き換え、`CareerIntentBox` 側からは消すこと。
   **両方に残すのが最悪。**

---

## 調査4：移行の影響 ★ここが本題

### 4-1. いま「受け取る」が成立している人の内訳（実ユーザー15人）

| 状態 | 人数 | `can_send_scout()` の結果 |
|---|---|---|
| `scout_enabled = true` | **11** | 受け取る（他の条件を満たせば） |
| `scout_enabled = null` | **2** | **受け取らない**（`coalesce(...,false)`） |
| `ow_profiles` の行が無い | **2** | **受け取らない**（副問い合わせが null → false） |
| `scout_enabled = false` | 0 | — |

### 4-2. 写像表（新UIに載せたときに何が書かれるか）

| 新UIの要素 | 読む列（案） | 現状の値 | 表示 | ⚠️ 危険 |
|---|---|---|---|---|
| 主スイッチ「声をかけられてもよいか」 | **派生**（下の内訳のOR） | — | はい11 / 未選択4 / いいえ0 | 列を新設すると `scout_enabled` と二重管理になる |
| 内訳「企業の採用担当から」 | **`ow_profiles.scout_enabled`** | true 11 / null 2 / 行なし2 | そのまま | **`can_talk_to_hr` に載せ替えないこと**（下） |
| 内訳「求職者・個人から」 | `ow_users.can_talk_to_candidates` | **全員 false** | 全員オフ | **「既定オン」と食い違う**（下） |
| 転職について（3択） | `is_open_to_work` ＋ `transfer_timing` | true 3 / 時期あり 2 | — | 2列に割れているので統合の判断が要る |

### 4-3. ★事故になる経路（2つ）

#### ① 「企業の採用担当から」を `can_talk_to_hr` に載せると、表示と実態がずれる

`can_send_scout()` は `scout_enabled` しか見ない（調査2）。
`can_talk_to_hr` は全員 false なので、

- 画面に「企業の採用担当から：オフ」と出す → **実際にはスカウトが届く**（11人）
- 逆に `can_talk_to_hr` を主にして `can_send_scout()` も差し替える →
  **指示書の「判定ロジックを変えない」に反する**うえ、`false` 11人が一斉に受け取り不可になる

**→ 内訳「企業の採用担当から」は `scout_enabled` をそのまま出す。列を増やさない。**

#### ② 「内訳は既定オン」を素直に実装すると、**未選択が「はい」に化ける**

`can_talk_to_candidates` は **`NOT NULL DEFAULT false`** で、**「未選択」を持てない**。
「既定オンで畳む」を画面の初期表示として実装すると、

- 画面: チェック済み（オン）
- 列: `false`
- **保存ボタンを押した瞬間に `true` が書かれる** ← **本人が意識せず「受け取る」に化ける**

これは `visibility` で警戒しているのと同じ性質の事故。
**回避するには次のどちらかが要る。**

| 案 | 中身 |
|---|---|
| **A** | `can_talk_to_candidates` を **nullable** にする migration を先に入れ、`null = 未選択` を表現できるようにする |
| **B** | 内訳の既定を**オフ**にする（「既定オンで畳む」をやめる） |

⚠️ **どちらを採っても、`scout_enabled = null` の人（実2人 / 全体36人）を
   `true` に写す経路は作らないこと。** 既存方針（遡ってONにしない）は
   **主スイッチを派生にすれば自動的に守られる**（null は「はい」にならない）。

### 4-4. `can_send_scout()` が変わらないことの担保

**変えない条件は1つだけ: `ow_profiles.scout_enabled` の値を、移行で書き換えないこと。**
新UIが `scout_enabled` を**そのまま読み書きする**設計にすれば、関数は無改修で済む。

⚠️ フェーズBで**必ず実測すること**（フェーズ3で使った形）:
1. 移行前に `select scout_enabled, count(*) from ow_profiles group by 1` を控える
2. UI を触らずにデプロイし、**同じクエリで分布が1件も動いていないこと**を確認
3. is_test で「はい」→「いいえ」→「はい」を往復し、**null の人が null のままであること**を確認

---

## 意見

### 意見1：重複している列はどれに寄せるか

**`ow_profiles.scout_enabled` に寄せる。`can_talk_to_hr` は使わない。**

理由: 効いているのが `scout_enabled` だけで、実データも11件そこに乗っている。
`can_talk_to_hr` に寄せると、**移行のたびに `can_send_scout()` を書き換える**ことになる。

- `can_talk_to_hr` … **列を消さずに放置しない。** 使わないと決めたら
  `docs/todo.md` に「死列。使うなら `can_send_scout` の改修とセット」と書く
- `can_talk_to_candidates` … **使うなら読み手を同時に作る。**
  いま DM は `visibility` しか見ていないので、この列を出すと
  「オフにしたのに DM が届く」が起きる。**列を出す前に `/api/dm/start` に条件を足すこと**
- `can_casual_meeting` … **本人の意思表示ではない**（運営が設定）。
  「声をかけられてもよいか」の内訳に混ぜない

### 意見2：主スイッチ1つ＋内訳2つは、既存の列にきれいに載るか

**半分載る。**

| 要素 | 載るか |
|---|---|
| 主スイッチ | ✅ **列を作らず派生**にすれば載る（内訳のOR）。null は「未選択」として表現できる |
| 内訳「企業の採用担当から」 | ✅ `scout_enabled` にそのまま載る（3状態も表現できる） |
| 内訳「求職者・個人から」 | ⚠️ **載らない。** `can_talk_to_candidates` は NOT NULL で未選択を持てず、**読み手も無い** |
| 転職について（3択） | ⚠️ **載らない。** いま `is_open_to_work`(bool) と `transfer_timing`(text) の**2列に割れている** |

### 意見3：載らないならどういう形なら載るか

**フェーズBで migration を1本入れる前提にするのが素直。**

1. `can_talk_to_candidates` を **nullable** にする（`null = 未選択`）
   → 「既定オンで畳む」を、化けさせずに実装できる
2. 「転職について」を**1列に統合する**。
   `ow_profiles.transfer_timing` に3択（`active` / `passive` / `research`）を持たせ、
   **DB の CHECK を張る**（いまは CHECK が無い）。
   `is_open_to_work` は**表示専用のまま残す**か、`transfer_timing` から導出に変える
   ⚠️ 既存の2件（`1〜3ヶ月以内` / `1年以内`）の写し先を決めること。
      **勝手に `active` へ倒さない**（本人が選んだのは「時期」であって「意欲」ではない）
3. `ow_profiles.stance_updated_at` を足し、**上の2つを保存したときだけ**アプリ側で更新
   （`transfer_timing_updated_at` と同じ書き方）

⚠️ **1と2は同じ migration にしない。** 1は「未選択を表せるようにする」、
   2は「選択肢の意味を変える」で、**戻すときの単位が違う**。

---

## CLAUDE.md との差分

| # | 記述 | 実測（2026-08-20） |
|---|---|---|
| ① | 「`ow_users.visibility` が全員 `login_only`」 | 一致（実ユーザー15人すべて login_only）。ただし**実ユーザーは14→15人に増えている** |
| ② | 「`scout_enabled` は 39人中 true が3人（残り36人は null）」 | **`ow_profiles` は50行に増え、null は36件のまま。実ユーザーに限れば true 11 / null 2** |
| ③ | 「スカウトは受信側を実装済み。送信フラグだけ未設定」 | 一致（`SCOUT_SENDING_ENABLED` は未設定のまま） |
| ④ | — | **`can_talk_to_candidates` / `can_talk_to_hr` が死列であることは CLAUDE.md に記載が無い** |
| ⑤ | — | **`/mypage` の右サイドバーは現在どの画面からも描画されていない**（`rightColumn` の渡し手0件）ことの記載が無い |
| ⑥ | 「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」 | **`ow_profiles.transfer_timing` に CHECK が無い**（許容値はコード側だけ） |
