# 理由入力フロー — フェーズ1 調査（2026-09-12）

対象は 2026-09-12 の `7a37dc0e` で作った `ExperienceReasonModal`。
**ソースを読んで確認した事実**と、**本番DBの実測値**だけを書く。推測には「推測」と明記する。
コミット: 調査時点の HEAD は `cb745ed6`（本番に反映済み）。

---

## 1-1. `ExperienceReasonModal.tsx` の現状

ファイル: [src/components/profile/editor/ExperienceReasonModal.tsx](../src/components/profile/editor/ExperienceReasonModal.tsx)（479行）

### ステップの分母

| 何が | どこ | 実装 |
|---|---|---|
| ステップの状態 | **176行** | `const [step, setStep] = useState<1 \| 2>(1)` |
| 1枚目の表記 | **264行** | `<div style={stepLabelStyle}>ステップ 1 / 2</div>` |
| 2枚目の表記 | **370行** | `<div style={stepLabelStyle}>ステップ 2 / 2</div>` |

**どちらも文字列のハードコード。`showLeave`（現職判定）を一切見ていない。**

### 現職（`ended_at` が無い）で開いたとき

- `showLeave === false` なので **331行の「この会社を離れた理由」ブロックだけが消える**。
- 1枚目は「入社理由」と「いちばんの決め手」だけになるが、**表記は「ステップ 1 / 2」のまま**。
- 「次へ」で **2枚目（入社前後のギャップ）に正常に進む**。エラーにも空画面にもならない。

⚠️★**ここがフェーズ2-1の前提と食い違う。** 現職でも**画面は2枚ある**（理由 → ギャップ）。
   現職で消えるのは「離れた理由」のブロックだけで、**ステップ数は減らない。**
   「ステップ表記を出さない」は**表記だけを消す**指示として実行できるが、
   その結果「次へ」を押した先にもう1枚あることが画面から読めなくなる。

### ボタンの活性条件

| | 実装 |
|---|---|
| 主ボタンのラベル | **228行** `saveLabel={step === 1 ? "次へ" : "保存"}` |
| 活性 | **231行** `primaryEnabled`（`ProfileEditModal` の `saveLocked = (!dirty && !primaryEnabled) \|\| saving \|\| justSaved`）|

**選択0件でも押せる。** これは意図的で、231行に
「答えないまま『次へ』が押せないと、**ギャップだけ答えたい人が進めない**」とコメントがある。

**0件のまま「保存」を押した場合に送られるもの**（`CareerHistoryEditor` 1675〜1705行）:
`buildPutCoreBody(d)` ＋ `buildReasonAnswerBody(answers, showLeave)` で、
`join_reasons: []` / `join_reason_primary: ""` / `leave_reasons: []` / `gaps: []` が **キーとして送られる**。
サーバー（`parseSlugArray`）は空配列を **`null`** に畳むので、**既存の回答があれば消える**。
＝「0件で保存」は**全消し**として正しく働く。

### 「あとで答える」

**234〜235行** `secondaryLabel="あとで答える"` / `onSecondary={onClose}`。
`onClose` は `CareerHistoryEditor` 1973行で `setReasonId(null)` するだけ。
**何も保存しない。スキップを記録する列もテーブルも無い。**
（× と背景クリックは `dirty` のとき破棄確認が出る。「あとで答える」は確認なしで閉じる。）

### 上部の緑バッジと説明文

**241〜258行**。`marginBottom: 18` の `<div>` の中に

1. `display:flex` の行（253行）にバッジ「この内容は公開されません」（`--success-ink` / `--success-soft` / `borderRadius:100`）
2. その**下の行**に `<p>`（257行）「あなた以外には表示されません。企業ごとの傾向を集計するために使います。」

＝ **いまは2行**。バッジと本文は別の行にある。

### 「いちばんの決め手」

**304〜327行**。`answers.joinReasons.length > 0` のときだけ節ごと出し、
**311行で `JOIN_REASONS.filter((o) => answers.joinReasons.includes(o.value))`** ——
**すでに選択済みのものだけを再提示している。12個全部から選ぶ形ではない。**
入社理由を外したときの連動も **191〜207行の `toggleReason`** にあり、
外した値が `joinReasonPrimary` と一致していれば `""` に落とす。

⚠️★**フェーズ2-4はすでに実装済み。** 仕様は「12個全部から選ぶ形になっていた場合」という
   条件付きなので、**変更不要**。

### `hasLeftCompany`

実装は **`CareerHistoryEditor.tsx` 349行の1箇所だけ**（`!d.isCurrent && !!draftEndedAt(d)`）。
モーダルは自前の判定を持たず、`showLeave` prop で受ける。

| 用途 | 呼び出し |
|---|---|
| 画面の出し分け | `CareerHistoryEditor.tsx` **1966行** `showLeave={hasLeftCompany(draftFromStint(reasonStint))}` |
| 保存 body | 同 **1678行** `const showLeave = hasLeftCompany(d)` → `buildReasonAnswerBody(answers, showLeave)` |

**二重実装にはなっていない。** 画面と保存が同じ関数を見ている。

---

## 1-2. `/mypage` 側の未回答導線

### アイコンと未回答ドット

| 何が | どこ |
|---|---|
| ボタン本体 | `ExperienceReasonModal.tsx` **420〜478行** `ReasonEntryButton`（未回答は右上に7pxの点。**数字にしない**） |
| 置き場所 | `ProfileTab.tsx` **1474〜1484行**（`MergedTimeline` の `renderCareerAside`。鉛筆の左隣） |
| 未回答の判定 | `ExperienceReasonModal.tsx` **79〜86行** `hasReasonAnswers` |

判定は `join_reasons` **だけではない**。**`leave_reasons` と `gaps` のどれか1つでも入っていれば回答済み**。
「決め手」だけでは回答済みにしない（DB の CHECK により決め手だけの行は存在し得ないため）。

### 未回答の件数

**いまはどこでも数えていない。** ただし **追加のフェッチは不要**。
`/mypage/page.tsx` 368〜385行が `ow_experience_gaps` を admin で引いて `rowsToStints` に渡しており、
`ProfileTab` の `careerStints`（**738行**）には `joinReasons` / `leaveReasons` / `gaps` が
**すべて載った状態でクライアントに来ている**。
＝ `careerStints.filter((s) => !hasReasonAnswers(s)).length` でその場で出せる。

### バナーの置き場所

`ProfileTab.tsx` の職歴セクションは `ProfileTimelineSection`（**1428行**）の中に
① 社会人経験の1行（1441〜1449行）② 0件のときの文（1448行）③ `MergedTimeline`（1462行）
④ もっと見る（1489行）⑤「＋ 職歴を追加」（1497行）の順で並ぶ。
**① の直後・③ の前に1行足せる。** 幅は `PROFILE_CONTENT_MAX` の中なので、
1行のバナーを入れても他のカードのレイアウトには影響しない（同じ `div` の中の縦積み）。

---

## 1-3. 実データの実測（本番 / read only / 2026-09-12）

### 全体

| 項目 | 実測 |
|---|---|
| `ow_experiences` 全行 | **34** |
| `company_id` あり / `company_text` のみ / 匿名 | **29 / 5 / 0** |
| `join_reasons` が入っている行 | **5** |
| `join_reason_primary` が入っている行 | **0** |
| `leave_reasons` が入っている行 | **0** |
| `ow_experience_gaps` の行 / 対象の職歴 | **1 / 1件** |
| `ended_at IS NULL` の行 | **20**（`is_current = true` も 20。**食い違いは0**） |
| `is_current = false` かつ `ended_at IS NULL` | **0** |
| 自由記述の `join_reason`（旧・別物）が入っている行 | 4 |

⚠️★**`join_reasons` の5行はすべて `is_test` アカウント**（相川 隆二2件・山田 空次郎・テスト二郎・鈴木 太郎）で、
   検証で入れたもの。**実ユーザーの回答は0件。**
   それでも **0件ではない**ので、CLAUDE.md と `careerReasons.ts` の規約どおり
   **スラッグは追加も削除も改名もしない。**

### 実ユーザー（`is_test=false` / `is_system=false` / `auth_id` あり）の分布

| 利用者 | 職歴 | 回答済み | 退職済み（`ended_at` あり） |
|---|---|---|---|
| 木村雅樹 | 4 | 0 | 3 |
| 大塚悠貴 | 3 | 0 | 2 |
| 長谷川陽希 | 3 | 0 | 2 |
| 関西 南 / 鈴木 五郎 / 福永陽貴 / 九実 金近 | 各 1 | 0 | 0 |

実ユーザーで職歴を持つのは **7人・14行**。
⚠️ ほかに `auth_id IS NULL` の行（生藤 弘樹・5件）があるが、
   `isRegisteredUser()` の対象外なので**画面には出ない**（CLAUDE.md 2026-09-10）。

**まとめ入口が相手にする件数は最大4件・中央値1件。**

---

## 1-4. 保存直後の「見返り」の材料

### 既存の経路

**`GET /api/jobseeker/companies/[id]/employees`** が
`totalCurrentCount` / `totalAlumniCount`（および `hiddenCurrentCount` / `hiddenAlumniCount`）を返す。
ログイン中なら**そのまま叩ける**（`dynamic = "force-dynamic"`。認証は `supabase.auth.getUser()`）。

### 権限

数を作っているのは `getCompanyEmployeesCached` → `getCompanyEmployees`（`queries.ts` 1768〜1801行）で、
**admin クライアント**。`ow_experiences` の該当列は `authenticated` にも SELECT があるが、
**RLS が他人の行を落とす**ので、ブラウザから直接数えても自分の1行しか見えない。
＝ **admin が必要。ただし既存のこのルートがその役目をすでに果たしている。新設は不要。**

### 自由入力企業（`company_id` が NULL）

**5行が該当**（全34行中）。この場合は数えられない。候補:

| 案 | 中身 | 評価 |
|---|---|---|
| **A（採用）** | **その行を出さない**（保存の完了だけ出す） | 「値が無いことを、ある値に置き換えない」に沿う。実装も最小 |
| B | 「この会社はまだ OPINIO に登録されていません」 | 本人の入力が不完全だと責めている読み方になりうる |
| C | 全社の平均などで代替 | ★**やらない**。仕様が禁じている（集計値・推定値は出さない） |

### 実測（`company_id` がある企業の現役 / 元在籍。実ユーザーのみで数えた値）

セールスフォース 3/2 ／ 海光電業 1/2 ／ 日本HP 1/0 ／ Archi Village 1/0 ／
伊藤忠テクノソリューションズ 1/0 ／ プルデンシャル生命 0/1 ／ ニトリ 0/1 ／ みずほ証券 0/1。

⚠️ API が返す数は**これと一致しない**。`getCompanyEmployees` は `is_test` を落としておらず、
   ログイン中の閲覧者には検証用アカウントも「現役社員」として数えられる
   （CLAUDE.md「`getCompanyEmployees` の is_test 例外」2026-09-12 に記録済み）。
   **見返りに出す数は企業ページの数と同じになる** ——食い違わせないこと。

⚠️ この数には**本人自身が含まれる**（企業ページと同じ数え方）。

---

## 1-5. 制約の確認

### 選択肢（`src/lib/constants/careerReasons.ts`）

入社理由 **12**（`job_content` `skills` `autonomy` `position` `people` `culture` `salary` `evaluation` `work_style` `growth` `stability` `personal`）／
退職理由 **13**（上の11個共通 ＋ `management` `restructure`。`stability` は無い）／
ギャップ軸 **6**・評価 **3**。上限は `REASON_MAX = 3`。

### DB の CHECK（本番実測）

| 制約 | 定義 |
|---|---|
| `ow_experiences_join_reasons_check` | `join_reasons IS NULL OR (join_reasons <@ ARRAY[12値] AND array_length(join_reasons,1) <= 3)` |
| `ow_experiences_leave_reasons_check` | `leave_reasons IS NULL OR (leave_reasons <@ ARRAY[13値] AND array_length(leave_reasons,1) <= 3)` |
| `ow_experiences_join_reason_primary_check` | `join_reason_primary IS NULL OR (join_reasons IS NOT NULL AND join_reason_primary = ANY(join_reasons))` |
| `ow_experience_gaps_axis_check` / `_rating_check` | 6軸 / 3評価 |

**UI・API・DB の3層が一致している。** 上限3も3層とも同じ。

### `parseReasonFields` の「キーが無い＝触らない」

`careerReasons.ts` の `parseReasonFields`（`ReasonFieldsPatch` の各フィールドが `?`）で、
`"prefecture" in body` / `hasJoin = "join_reasons" in body` / `"leave_reasons" in body` を見て
**キーが無ければ `undefined` を返す**。`JSON.stringify` が `undefined` のキーを落とすので
PostgREST にも送られない。`gaps` も `body.gaps !== undefined` のときだけ触る。
`join_reason`（自由記述・別物）も `[id]/route.ts` で `"join_reason" in body ? … : undefined`。

**いまも効いている。** ＝ 職歴の編集モーダル（理由を送らない PUT）で理由が消えることはない。

---

## フェーズ2に進んでよいか（判断）

**進んでよい。** ただし前提と実装が食い違う点が3つあるので、次のように読み替えて進める。

| # | 仕様 | 実際 | どうするか |
|---|---|---|---|
| ① | 2-4「12個全部から選ぶ形になっていた場合」 | **すでに選択済みの中からしか選べない**（311行） | **変更しない**（条件が成立しない） |
| ② | 2-1「現職はステップ表記を出さない」 | 現職でも**画面は2枚**（理由 → ギャップ）。減るのは「離れた理由」ブロックだけ | **指示どおり表記を消す**。モーダルの題も現職では「この会社を選んだ理由」にする。⚠️ 枚数が読めなくなる点は記録に残す |
| ③ | 2-2「選択0件では保存ボタンを出さない」 | 主ボタンは1枚目では「次へ」。0件で押せるのは**ギャップだけ答えたい人のため**と明記されている（231行） | **「保存」にだけ適用する**（1枚目の「次へ」は残す）。全ステップ通して選択が1つも無いときだけ「保存」を出さない |

スラッグは触らない（1-3のとおり**実データが5行ある**）。API と DB の CHECK も変更しない。

---

# フェーズ2 実装と検証（2026-09-12）

フェーズ1の報告に対する柴さんの指示で、**2-1 は縮小**（ステップ表記は触らず題だけ出し分け）、
**2-4 は変更なし**（実装済み）、**2-2 は「保存」だけに適用**に確定した。

## 変更したファイル

| ファイル | 何を |
|---|---|
| `components/profile/editor/ExperienceReasonModal.tsx` | 題の出し分け（2-1）／「保存」の出し分け（2-2）／ヘッダー1行化（2-3）／保存後の「見返り」（2-6） |
| `components/profile/editor/ProfileEditModal.tsx` | `hidePrimary` を足した（主ボタンごと出さない。既定は今までどおり出す） |
| `components/profile/CareerHistoryEditor.tsx` | `saveReasons` が `boolean` を返す／保存しても閉じない／未回答の並び（古い順）とまとめ入口の受け口 |
| `components/profile/editor/ProfileTab.tsx` | 未回答の件数（追加取得なし）とバナー（2-5） |

⚠️ **ステップ表記（264行・370行）・`careerReasons.ts`・API・DB の CHECK は1文字も変えていない。**

## 決めたこと（次に読む人へ）

- **題だけを出し分ける。** 現職でも画面は2枚（理由 → ギャップ）なので「1 / 2」は正しい。
  **分母を消さないこと。** 判定は `hasLeftCompany`（`CareerHistoryEditor.tsx:349`）の1つだけ。
- **0件で「次へ」は通す。**「保存」だけを出さない。前者はギャップだけ答えたい人の経路で、
  231行のコメントに両方の意図を書いた。**片方だけ変えないこと。**
- **保存しても閉じない。** 保存後は「見返り」の画面に切り替わり、
  閉じるか次の職歴へ進むかを本人が選ぶ。`justSaved`（「✓ 保存しました」）は使わない
  ——立てるとそのボタンが押せなくなる。
- **並び順はエディタ側が持つ。** バナー（`ProfileTab`）は件数だけを数える。
- **在籍者数は企業ページと同じ数**（`GET /api/jobseeker/companies/[id]/employees`）。
  ⚠️ `is_test` を落としていない経路なので、**検証用アカウントも数に入る**（CLAUDE.md の例外）。

## 検証（2026-09-12 / dev サーバー ＋ 本番 Supabase / `contact+26@opinio.co.jp`）

検証用に職歴を4件作った（自由入力1・マスタ3。うち1件が現職）。

| 確認したこと | 結果 |
|---|---|
| 現職の題 | **「この会社を選んだ理由」** ／ 退職済みは「この会社を選んだ理由と、離れた理由」 |
| 現職でステップ2へ進めるか | **「ステップ 1 / 2」が出て、ギャップの画面に進めた**（デグレなし） |
| 現職に「この会社を離れた理由」が出ないか | **出ない** |
| 選択0件で「次へ」 | **通る**（ステップ2に進む） |
| 全ステップ0件のときのフッター | **「あとで答える」だけ**（保存ボタン無し） |
| 1件選んだとき | **「保存」が現れる** |
| 「いちばんの決め手」 | **選んだ2件だけが出た**／入社理由を外すと決め手も外れた |
| 保存 → 開き直し | 入社理由・決め手・ギャップとも**全復元** |
| 他項目だけ更新（役職を入れて保存） | `join_reasons` / `join_reason_primary` / ギャップとも**残った**（巻き込み消しの回帰なし） |
| まとめ入口 | 4件を古い順に提示。**1→2件目を保存し、3件目で閉じても1〜2件目は残った**（バナーが 4 → 2件に） |
| 見返り（マスタ企業） | 「株式会社セールスフォース・ジャパン には、いま在籍している人が10人、過去に在籍していた人が3人います。」 |
| 見返り（自由入力企業） | **行ごと出ない**（代替文も無し） |
| 横はみ出し | **0件**（1280px / 375px とも。`position: fixed` の重なりを除いた実測） |

### モーダルの高さ（同じ職歴・同じ画面で前後比較）

`body` は内部スクロールの箱なので、**中身の高さ（`scrollHeight`）**で比べる。

| | 変更前 | 変更後 |
|---|---|---|
| 1280px / ステップ1 | 1,360 px | **1,336 px** |
| 1280px / ステップ2 | 674 px | **649 px** |
| 375px / ステップ1 | 1,540 px | **1,523 px** |
| 375px / ステップ2 | 1,031 px | **1,015 px** |

モーダル全体は 1280px で 828 / 814 px → **828 / 789 px**、375px は **747 px のまま**（上限に当たっている）。
**減ったぶんはヘッダーを2行から1行にしたぶん。**

### 後始末

検証で作った4件は `DELETE /api/jobseeker/experiences/[id]` で消し、
**`ow_experiences` 34行 ／ `ow_experience_gaps` 1行**（作業前と一致）を SQL で確認した。
ゲートを通すために入れた `ow_profiles.career_stance` も **NULL に戻した**（元の値）。
