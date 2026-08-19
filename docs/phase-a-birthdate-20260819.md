# フェーズA 調査：生年月日と年齢（2026-08-19）

**調査のみ。実装・DB書き込みはしていない（SELECT と grep だけ）。**
数値はすべて本番実測。実ユーザーの集計は `is_test` / `is_system` / `@seed.internal` を除いた値。
⚠️ **生年月日の実値はこの報告書に書かない**（件数と型だけ）。

---

## 要旨（先に4行）

1. **入力UIも表示経路も既にある。** 生年月日は `/profile/edit` の「生年月日」で入力でき、
   `/u/[id]` の詳細に年齢が出ている。方針どおりの部分は既に動いている。
2. **「一覧には出さない」は現時点で3画面が違反している。**
   `/companies/[id]` の社員カード / `/biz/candidates` の候補者カード / `/biz/meetings` の面談カード。
3. **`/biz/candidates` には既に「年齢レンジ」の絞り込みがある**（`ageMin` / `ageMax`）。
   今回の方針でいちばん先に外すべきものがここ。
4. **生年情報が2箇所にあり、しかも食い違っている。**
   `ow_users.birth_date` と `ow_career_profiles.birth_year` の両方を持つ実ユーザーが1人いて、
   **年が一致していない**。

---

## 調査1：現状の実態

### 1-1. `ow_users.birth_date`

| 項目 | 値 |
|---|---|
| 型 | `date` |
| NULL | 可（NOT NULL ではない） |
| デフォルト | 無し |
| CHECK | **無し**（`birth_date` を含む CHECK は0本） |
| 列コメント | 「生年月日。NULL の場合は年齢非公開扱い。サーバ側で年齢計算に使用、公開ページには直接渡さない（プライバシー保護）。」 |

### 1-2. 実データ（件数のみ）

| | 件数 |
|---|---|
| 実ユーザー | **14** |
| うち `birth_date` あり | **4** |
| `ow_users` 全行 | 35 |
| 全行のうち `birth_date` あり | 5（うち `is_test` が1） |

### 1-3. ★生年・年齢に相当する列が他にもある

public スキーマ全体を走査した結果（`ow_companies.avg_age` のような**企業属性**は個人データではないので除外）。

| テーブル.列 | 型 | 行数 | 値あり | 位置づけ |
|---|---|---|---|---|
| `ow_users.birth_date` | date | 35 | **5** | **正**（アプリが使う） |
| **`ow_career_profiles.birth_year`** | integer | 1 | **1** | **重複**。下の⚠️ |
| `candidates.age` | integer | 13 | 1 | 旧テーブル系。`ow_users` と email で突き合わせて**一致0件**＝別系統 |
| `crm_candidates.date_of_birth` | date | **0** | 0 | 未使用 |

⚠️ **同一人物の生年が二重に存在し、食い違っている。**

| | 件数 |
|---|---|
| `ow_career_profiles.birth_year` と `ow_users.birth_date` の**両方**を持つ人 | **1** |
| そのうち**年が一致しない**人 | **1**（＝1件中1件が不一致） |
| `ow_career_profiles` にだけある人 | 0 |

該当は `is_test = false` の実ユーザーで、その `ow_career_profiles` は `is_published = true`。
**どちらが本人の申告か、この調査では判定できない。**

⚠️ 表示側は既に `birth_date` へ寄せてある（`lib/people/directory.ts` のコメント:
「2026-08-08 まで `ow_career_profiles.birth_year` を見ていたが、対象5人中1人にしか入っていなかった」）。
**列とデータだけが残っている状態。**

---

## 調査2：入力経路 → **ある**

| 層 | 実体 |
|---|---|
| UI | `/profile/edit`（[ProfileTab.tsx](../src/components/profile/editor/ProfileTab.tsx) の `FormGroup label="生年月日"`）。**年 / 月 / 日 の3セレクト**（年は今年から101年分） |
| 組み立て | `${birthYear}-${birthMonth.padStart(2,"0")}-${birthDay.padStart(2,"0")}` |
| 保存 | `PUT /api/jobseeker/profile`。`BIRTH_RE` で書式検証。空文字・null は **null に落とす**（消せる） |
| オンボーディング | **聞いていない**（`onboarding/OnboardingClient.tsx` に `birth` の語が0件） |

### ⚠️ 入力欄のヒント文が実態と合っていない

```
生年月日を入力すると年齢が自動で計算され、プロフィールページと
登録ユーザー一覧に表示されます。入力しない場合は年齢非公開となります。
```

**「登録ユーザー一覧に表示されます」は、2026-08-18 に `/people` のカードから年齢を外した時点で
事実ではなくなっている。** 同意の範囲を**狭める**方向のズレなので実害は無いが、
**文言と実態が食い違っている**ことは記録しておく（フェーズBで直す候補）。

---

## 調査3：表示経路

### 3-1. `birth_date` / 年齢を読んでいる全箇所

| # | 画面 | 一覧 / 詳細 | 認証 | 読み方 | 年齢の出方 | 方針との関係 |
|---|---|---|---|---|---|---|
| ① | `/u/[id]` | **詳細** | ログイン必須（middleware） | `createAdminClient` で `birth_date` を単独取得 | `getUserAge()` | ✅ **方針どおり** |
| ② | `/mypage`・`/mypage/details/*` | 本人のみ | ログイン必須 | admin | 経歴タイムラインの年マーカーに「その年の年齢」 | ✅ 本人向け |
| ③ | `/people` | **一覧** | ログイン必須 | admin（`directory.ts`） | **カードには出さない**（2026-08-18 に削除）。ただし **「年齢」フィルタが `card.age` を使っている** | ⚠️ 表示は無いが**絞り込みが残っている** |
| ④ | `/companies/[id]` 現役社員・OB/OG | **一覧** | 公開ページ（未ログインには本人カードを出さず「ログインすると N名…」） | admin（`getCompanyEmployees`） | **`{age}歳` を表示** | ❌ **違反** |
| ⑤ | `/biz/candidates` | **一覧** | 企業 | admin | **`{age}歳` を表示 ＋ 年齢レンジで絞り込み** | ❌ **違反（最優先）** |
| ⑥ | `/biz/meetings` | **一覧カード**＋詳細 | 企業 | admin | `applicantAge`（`MeetingCard` と `MeetingDetailPanel` の両方） | ❌ 一覧側が違反 |
| ⑦ | `/admin/candidates` | 一覧 | 運営 | admin | `getUserAge()` で「N歳」 | 対象外（運営の作業管理） |

### 3-2. 「一覧には出さない」を守るために外すべき場所

1. **`/biz/candidates` の年齢レンジ絞り込み**（`ageMin` / `ageMax` の select と filter）… **法令上いちばん重い**
2. `/biz/candidates` のカードの `{age}歳`
3. `/companies/[id]` の社員カードの `{age}歳`
4. `/biz/meetings` の `MeetingCard` の `applicantAge`（詳細パネルは残す判断もありうる）
5. `/people` の「年齢」フィルタ（表示は既に無い）

### 3-3. ★年齢の計算が5つに割れている

| # | 場所 | 計算方法 | 誕生日到来の判定 |
|---|---|---|---|
| ① | [lib/age.ts](../src/lib/age.ts) `getUserAge` | 年差 − （誕生日未到来なら1） | **している**（月・日を見る） |
| ② | `CompanyEmployeeSections.tsx` `calcAge` | `今年 − birthYear` | していない |
| ③ | `biz/candidates/CandidatesClient.tsx` 表示 | **`2026 - c.birthYear`** | していない・**年がハードコード** |
| ④ | 同 フィルタ | `new Date().getFullYear() - c.birthYear` | していない |
| ⑤ | `MergedTimeline.tsx` `calcAgeAtYear` | `対象年 − 生年` | していない（**仕様上これでよい**。「その年の年齢」なので） |

⚠️ **③は 2027 年になった瞬間、全員の年齢が1歳若く出る。** 年が定数で埋まっている。
⚠️ ②③④は誕生日前の人を**1歳上に**表示する。①だけが正しい。
   **年齢を出す場所を減らすなら、残す場所は `getUserAge()` に統一すべき。**

---

## 調査4：企業側の検索・絞り込み

### 4-1. 年齢の絞り込みは**既にある**

[src/app/biz/candidates/CandidatesClient.tsx](../src/app/biz/candidates/CandidatesClient.tsx)

- `ageMin` / `ageMax` の state（172-173行）
- 「N歳」の `<option>` を並べた select が2つ（555-572行）
- 絞り込み本体（287-295行）。**`birthYear` が無い候補者は問答無用で除外される**
  （`if (!c.birthYear) return false;`）＝ 生年月日を入れていない10人は**絞り込むと消える**

⚠️ **絞り込みは `ow_users.birth_date` を admin で読んで実現している。**
   `biz/candidates/page.tsx` は `createAdminClient()` で
   `select("id, name, location, is_mentor, is_open_to_work, birth_date, created_at, auth_id")`。
   authenticated には `birth_date` の SELECT 権限が無いので、**admin でしか成立しない作り**。

### 4-2. 社会人年数で絞る仕組みは実装できるか → **できる。計算関数も既にある**

| | 実体 |
|---|---|
| 計算 | [lib/profile/tenure.ts](../src/lib/profile/tenure.ts) の **`calcTotalExperience(startedAts)`** |
| 仕様 | 最も古い `started_at` から現在まで。**職歴0件なら `null` を返す**（「0年」と出さない） |
| 利用中 | `/mypage` の「社会人経験」の行（`ProfileTab.tsx`）。`ow_profiles.experience_years`（死列）は読んでいない |

**母数（実ユーザー14人）**

| | 件数 |
|---|---|
| 職歴が1件以上ある | **9** |
| そのうち `started_at` が入っている | **9**（`ow_experiences` 全体で `started_at` が NULL の行は**0件**） |
| `birth_date` がある | 4 |
| **両方ある** | 3 |

**意見：職歴が無い5人の扱いは「絞り込むと出てこない」でよい。ただし表示は変えない。**

- 年齢絞り込みは「生年月日が無い人を落とす」形で既に同じ問題を抱えている（10人が消える）。
  社会人年数に移すと**落ちる人が10人 → 5人に減る**ので、母数の観点でも改善になる。
- ⚠️ **「0年」で埋めない。** 職歴が無いことを「社会人0年」と表すと、新卒と未入力が同じになる
  （CLAUDE.md「値が無いことを、ある値に置き換えない」）。`calcTotalExperience` が
  `null` を返す設計はそのまま活かす。
- ⚠️ ただし **「未入力の人が検索から消える」ことを企業側の画面に明示する**こと
  （「社会人年数で絞ると、職歴が未登録の N 名は表示されません」）。
  黙って減ると「候補者が少ない」と誤読される。

### 4-3. 既存検索のクライアント

**`createAdminClient`（service role）。** `biz/candidates/page.tsx:79` でセッションから
企業の所属を確認し、データ取得は 83 行目の `createAdminClient()` で行っている。
候補者データが authenticated の RLS を通っていないので、**何を返すかはコード側の責任**。

---

## 調査5：権限まわり

### 5-1. `birth_date` の GRANT（2026-08-19 実測）

| ロール | SELECT | UPDATE |
|---|---|---|
| `anon` | **false** | — |
| `authenticated` | **false** | **true** |
| `service_role` | true | true |

⚠️ **`authenticated` は「書けるが読めない」。** CLAUDE.md の
「UPDATE はテーブルレベルなので書けはする」がそのまま出ている状態。
本人が自分の生年月日を保存できるのはこのため（保存は API 経由でセッションクライアント、
読み出しは admin）。

### 5-2. 実測（is_test の第三者セッションで PostgREST を直接叩いた）

| 試したこと | 結果 |
|---|---|
| 他人の行の `birth_date` を明示 select | **403** `42501 permission denied for table ow_users` |
| **自分の行**の `birth_date` を select | **403**（同上。列単位 GRANT が無いので自分の行でも読めない） |
| `birth_date` を含めずに他人を select | 200（名前などは読める） |
| `ow_career_profiles.birth_year` を select | **403** |

**→ 他人の生年月日が authenticated から読める状態にはなっていない。**

### 5-3. ⚠️ ただし `ow_career_profiles.birth_year` は **anon に開いている**

| ロール | `ow_career_profiles.birth_year` の SELECT |
|---|---|
| `anon` | **true**（テーブルレベル GRANT のまま） |
| `authenticated` | false（列単位 GRANT 7/9 から外れている） |

実測: anon で `select=birth_year` → **200 `[]`**（403 ではない）。
0件なのは RLS（`career_profiles_public_read` = `is_published` かつ `visibility='public'`）を
満たす行が今は無いから。**`visibility='public'` の人が1人現れた瞬間に、その人の生年が
未ログインから読める。**

⚠️ **2026-08-19 に `ow_users.birth_date` で塞いだのと同じ形の穴が、別テーブルに残っている。**
   `ow_users` 側だけ塞いで安心しない。

---

## 意見（求められた3点）

### ① 年齢を詳細ページに出す経路 → **いまの「admin で読んで、年齢だけ返す」を維持する**

3案の比較:

| 案 | 評価 |
|---|---|
| **admin で読み、サーバ側で年齢に変換して返す（現行の `/u/[id]`）** | ✅ **これでよい。** 生年月日そのものはクライアントに渡らず、`getUserAge()` が1箇所に集まる |
| authenticated に `birth_date` の列 GRANT を開ける | ❌ **やらない。** 開けた瞬間に PostgREST から**全員の生年月日**が取れる。RLS は行を絞るだけで、列の粒度（年齢だけ返す）は表現できない |
| 派生列（`age` を DB に持つ）を作る | ❌ **やらない。** 誕生日で毎日変わる値を保存すると、更新の主体が要る（cron か trigger）。**計算で出せるものを保存しない** |

⚠️ 現行を維持するうえでの条件を1つ足す。**年齢を出す場所はすべて `lib/age.ts` の
`getUserAge()` を通すこと。** 3-3 のとおり、いま4つの独自計算があり、うち1つは年がハードコードで
2027年に壊れます。

### ② 「一覧には出さない」を仕組みで担保できるか → **できる。型で落とすのが一番安い**

規約（コメントで「一覧に出すな」と書く）は守られません。過去に同じ形の事故があります。
**推奨は「一覧用の型に年齢の場所を作らない」こと。**

- `/people` は既に近い形になっている（`directory.ts` が `age` を返すが、カードは使っていない）。
  ここを**さらに一歩進めて `age` を返さない**——年齢フィルタも外すなら、`age` を型から消せる。
- `/biz/candidates` は `birthYear` を**カードの型に持たせている**（`CandidatesClient.tsx` の
  `birthYear: number | null`）。これを消せば、表示も絞り込みも**書けなくなる**。
- `getCompanyEmployees` の `CompanyEmployee.birthYear` も同じ。

**「返さない層」を作るより、一覧用の型から `birthYear` / `age` を消すほうが確実**です。
新しく書く人が「無いものは出せない」ので、コメントを読まなくても守れます。

⚠️ 詳細ページ（`/u/[id]`）だけが年齢を受け取る型を持つ、という形にします。

### ③ 社会人年数を都度計算するか、テーブルに持たせるか → **都度計算する**

- 計算関数は既にある（`calcTotalExperience`）。入力は `started_at` だけで、**全件 NOT NULL**。
- 職歴を1件足した瞬間に値が変わるので、**保存すると必ず古くなる**。
  `ow_profiles.experience_years` を「職歴から自動計算」に置き換えた 2026-08-07 の判断と同じ理由。
- 候補者検索の絞り込みも、いまは admin が候補者を全件読んでメモリで絞っているので、
  **その場で計算しても追加のクエリは要らない**（`ow_experiences` の `started_at` を
  ユーザーごとに最小値で1回引くだけ）。

⚠️ 件数が増えて重くなったら、そのとき**ビュー**（`ow_user_tenure`）にする。
   **列に持たせて trigger で更新する形は採らない**（更新漏れが静かに古い値を返す）。

---

## ついでの調査：自由記述「なぜこの会社を選んだか」

### 現状

| 項目 | 値 |
|---|---|
| ラベル | **「なぜこの会社を選んだか（任意）」** ＋ 紫バッジ **「公開プロフィールに表示」** |
| プレースホルダ | 「例: 〇〇な課題を解決したくて。前職でできなかった〇〇に挑戦するため」 |
| 保存先 | **`ow_experiences.join_reason`**（text）。公開トグルは `visibility_reason`（boolean NOT NULL DEFAULT true） |
| 文字数 | UI は300字で警告、API は `slice(0, 5000)`（POST）/ `s(body.join_reason, 2000)`（PUT）と**上限が3つとも違う** |
| 位置 | 職歴モーダルの**最下部**（理由チップの下、業務内容の後ろ） |
| 実データ | **4件**（実ユーザー） |

### 検索・集計に使われていないか → **使われていない**

`join_reason` を読んでいるのは **表示（`/u/[id]`・`/mypage`）と編集フォームだけ**。
`ilike` / 全文検索 / 集計クエリでの利用は**0件**（grep 実測）。
公開制御は `/u/[id]` で `visibility_reason=false` のとき `join_reason` を落とす1箇所だけ。

### 意見：**提案どおりでよい。ただしラベルは「補足」より一段はっきり書く**

理由チップの直下へ移し、従属関係を出す案に賛成です。そのうえで2点。

1. **ラベル案：「選んだ理由を、自分の言葉で（任意）」**
   「補足」だと何の補足か分からず、結局チップと同じことを書く人が出ます。
   **チップでは表せないこと（具体的な経緯）を書く欄だ**と分かる言い方にします。
   プレースホルダも「例:」から**チップと重ならない例**に変えるべきです
   （現行の例は「〇〇な課題を解決したくて」＝ `job_content` のチップとほぼ同義）。
2. ⚠️ **紫バッジ「公開プロフィールに表示」は残すこと。**
   直上のチップは緑バッジ「この内容は公開されません」なので、
   **隣り合わせると公開範囲が正反対のものが並ぶ**ことになります。
   移設するなら、**2つのバッジが同時に目に入る配置**にして、
   どちらがどちらか取り違えないようにする必要があります。ここは実装時に画面で確認します。

⚠️ 文字数の上限が UI 300 / PUT 2000 / POST 5000 と**3つとも違う**のは、
   移設のついでに揃えたほうがよいです（CLAUDE.md「UI / API / DB を揃える」の同型）。

---

## CLAUDE.md との差分

| # | CLAUDE.md の記述 | 実測（2026-08-19） |
|---|---|---|
| ① | `ow_users` の列単位 GRANT の表に **anon 23列 / authenticated 30列** と追記済み | 一致。**`ow_career_profiles` は「anon はテーブルレベル」と書いてあるが、そこに `birth_year`（個人の生年）が含まれることは書かれていない** |
| ② | 「`birth_year` は存在しないカラム」（queries.ts の事故として記載） | **`ow_users` には無いが `ow_career_profiles.birth_year` は実在する**（1行に値あり）。当時の事故は「`ow_users` に対して `birth_year` を select した」ことで、列そのものが存在しないわけではない |
| ③ | — | `/biz/candidates` に**年齢レンジの絞り込み**があることは CLAUDE.md に記載が無い |
| ④ | — | 年齢計算が**5箇所**に分かれており、`biz/candidates` の表示は **`2026` がハードコード**。CLAUDE.md に記載が無い |
