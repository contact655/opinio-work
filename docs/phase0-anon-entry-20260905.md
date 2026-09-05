# 学校ページ・企業ページの未ログイン公開 — 実現可能性調査

- 調査日: **2026-09-05**
- 対象: 本番 Supabase（GRANT / RLS は service_role で読み、**実挙動は anon キーで PostgREST を直接叩いて実測**）
  ／ 本番 `https://opinio.jp`（未ログインの GET のみ）
- **調査のみ。コード変更・migration・データ更新・公開設定の変更は一切行っていない。**
- 数字はすべて上記日付時点の実測値。取得できなかったものは §7 に明記した。

---

## 1. いま anon で何が読めるか

### 1-1. 一覧（GRANT・RLS・実測を1表に）

`anon 実測` は anon キーで `GET /rest/v1/<table>?select=id` を叩き、
`Prefer: count=exact` の `content-range` で件数を取った値。

| テーブル | anon GRANT | 列 (anon/全) | RLS | 読み取りポリシー | **anon 実測** |
|---|---|---|---|---|---|
| `ow_companies` | **テーブル単位** | 153 / 153 | 有効 | `ow_companies_published_read` ほか3本 | **200 / 90行** |
| `ow_roles` | **テーブル単位** | 12 / 12 | 有効 | `ow_roles_public_read` `USING(true)` | **200 / 154行** |
| `ow_users` | **列単位** | **22 / 32** | 有効 | `ow_users_public_read`（`visibility='public'`）ほか2本 | **200 / 0行** |
| `ow_profiles` | テーブル単位 | 26 / 26 | 有効 | admin / 本人 の2本のみ | **200 / 0行** |
| `ow_experiences` | **列単位** | **21 / 35** | 有効 | `ow_experiences_public_read`（`visibility='public'`）ほか2本 | **200 / 0行** |
| `ow_schools` | **テーブル単位** | 10 / 10 | 有効 | `ow_schools_authenticated_select` **1本のみ** | **200 / 0行** |
| `ow_user_educations` | **無し** | **0 / 11** | 有効 | admin / 本人 の2本 | **401 `42501`** |
| `ow_school_requests` | テーブル単位 | 9 / 9 | 有効 | 本人（`authenticated` ロール限定） | 200 / 0行 |

**anon が実際に行を取得できるのは `ow_companies`（90行）と `ow_roles`（154行）の2つだけ。**
残りは 200 かつ 0件、`ow_user_educations` だけが 401。

### 1-2. ★`ow_schools` は「GRANT はあるがポリシーが anon に効かない」

`ow_schools` は anon にテーブル単位の SELECT GRANT があり、10列すべて読める。
にもかかわらず **0件**が返る。読み取りポリシーが1本しか無く、その1本が

```
polname : ow_schools_authenticated_select
roles   : {authenticated}          ← ★ここ
qual    : true
```

と **`authenticated` ロールに限定**されているため。
`USING(true)` だけを見ると開いているように見えるが、`polroles` が anon を含まない。

⚠️ **GRANT の有無だけでは判定できない。** `ow_profiles` も同型で、
テーブル単位 GRANT が26列すべてにあるが、ポリシーが admin / 本人の2本しか無いので 0件。

### 1-3. 列単位 GRANT の壁は実際に効いている（401 で確認）

RLS で弾かれると 200 + 0件だが、**GRANT で弾かれると 401** になる。
anon に配っていない列を select に混ぜて確かめた。

| リクエスト | 実測 |
|---|---|
| `ow_users?select=id` | 200 / 0行 |
| `ow_users?select=id,birth_date` | **401 `{"code":"42501"}`** |
| `ow_experiences?select=id` | 200 / 0行 |
| `ow_experiences?select=id,exit_reason` | **401 `{"code":"42501"}`** |

### 1-4. anon から落ちている列（全数）

| テーブル | anon が読めない列 |
|---|---|
| `ow_users`（10列） | `email` `mentor_registered_at` `created_at` `updated_at` **`birth_date`** `profile_setup_at` `statistics_opt_out` `is_system` `auth_linked_at` `welcome_sent_at` |
| `ow_experiences`（14列） | **`salary_man` `salary_base` `salary_bonus` `salary_stock`** `turning_point` **`exit_reason`** `rank` `department` `department_id` `learnings` `visibility_company_profile` `join_reasons` `join_reason_primary` **`leave_reasons`** |
| `ow_user_educations`（11列＝全列） | `id` `user_id` `school` `faculty` `degree` `enrolled_at` `graduated_at` `is_current` `sort_order` `created_at` `school_id` |

### 1-5. anon が読める列（全数）

| テーブル | anon が読める列 |
|---|---|
| `ow_users`（22列） | `id` **`auth_id`** `name` `avatar_color` `cover_color` `about_me` `location` `social_links` `is_mentor` `is_active_mentor` `visibility` `future_aspirations` `cover_photo_url` `avatar_url` `is_open_to_work` `can_casual_meeting` `catchphrase` `can_talk_to_candidates` `can_talk_to_hr` `username` `is_test` `headline` |
| `ow_experiences`（21列） | `id` `user_id` `company_id` `company_text` `company_anonymized` `role_category_id` `role_title` `started_at` `ended_at` `is_current` **`description`** `display_order` `created_at` `updated_at` **`join_reason`** `employment_type` `visibility_company` `visibility_salary` `visibility_reason` `prefecture` `remote_work_status` |
| `ow_career_profiles`（5 / 9列） | `id` `user_id` `headline` `years_of_experience` `is_published`（落ちているのは `birth_year` `gender` `created_at` `updated_at`） |

⚠️ **`join_reason`（単数）は anon に配られている。** 落ちているのは `join_reasons`（複数）と
`join_reason_primary`。名前が似ているが別の列。

---

## 2. `visibility` の実態

### 2-1. 取りうる値と件数

CHECK 制約: `CHECK (visibility = ANY (ARRAY['public','login_only','private']))`

| 値 | 件数 |
|---|---|
| `login_only` | **40** |
| `private` | **1** |
| **`public`** | **0** |

`ow_users` 総数 41。**`public` は0人。**

### 2-2. 既定値がどこで決まっているか → **DB default**

| 層 | 実体 |
|---|---|
| **DB** | `ow_users.visibility` の `column_default` = **`'login_only'::text`** |
| API | `PUT /api/jobseeker/profile` — キーが無ければ触らない。不正値は **400 `INVALID_VISIBILITY`**（`VALID_VISIBILITY` で検証）。**既定値は入れない** |
| UI | `/mypage/settings` の `PrivacySettings.tsx`。選択肢は [lib/constants/profileVisibility.ts](src/lib/constants/profileVisibility.ts) の `PROFILE_VISIBILITY_OPTIONS`（3値とも提示。`public` も選べる） |

既定値を決めているのは **DB default 1箇所のみ**。API も UI も既定を注入していない。

### 2-3. `visibility` を参照している箇所

**RLS ポリシー（6本）**

| テーブル | ポリシー | 条件の要点 |
|---|---|---|
| `ow_users` | `ow_users_public_read` | `visibility = 'public'` |
| `ow_users` | `ow_users_login_only_read` | `visibility = 'login_only' AND auth.uid() IS NOT NULL` |
| `ow_experiences` | `ow_experiences_public_read` | `visibility_company <> 'hidden'` かつ 本人の `visibility = 'public'` |
| `ow_experiences` | `ow_experiences_login_only_read` | 上に `auth.uid() IS NOT NULL` と `login_only` を足したもの |
| `ow_career_profiles` | `career_profiles_public_read` | `is_published` かつ 本人の `visibility = 'public'` |
| `ow_career_profiles` | `career_profiles_login_read` | 同上 ＋ `auth.uid() IS NOT NULL` ＋ `login_only` |

**DB 関数（1本）**

`get_public_career_steps(p_user_id uuid)` — `SECURITY DEFINER`。
**anon に EXECUTE 権限がある（実測 true）。**
非本人・非admin の経路では `ow_career_profiles.is_published = true` と
`u.visibility = 'public' OR (auth.uid() IS NOT NULL AND u.visibility = 'login_only')` と
`visibility_company <> 'hidden'` の3つを要求する。
**anon で実際に叩いたところ `200 / []`**（`public` が0人のため）。バイパス経路にはなっていない。

**アプリコード（`ow_users.visibility` を読む主な箇所）**

| ファイル | 使い方 |
|---|---|
| `src/app/(jobseeker)/schools/[id]/page.tsx:81` | `if (u.visibility === "login_only" && !isLoggedIn) return false;` — **学校ページで anon に出すかを決める唯一の判定** |
| `src/app/(jobseeker)/u/[id]/page.tsx:125,148,149` | RLS 経由で取得し、null なら 404 |
| `src/app/(jobseeker)/page.tsx:89,230` | トップの学校集計。`private` を除外 |
| `src/app/(jobseeker)/mypage/page.tsx:52,407,416` | 本人の値の読み出し・学校集計 |
| `src/app/(jobseeker)/mypage/settings/page.tsx:33,41` | 設定画面の初期値（admin クライアントで読む） |
| `src/app/(jobseeker)/mypage/follows/page.tsx:78,82` | `private` を除外 |
| `src/app/(jobseeker)/feed/(list)/page.tsx:151,358,367` | `lib/feed/visibility` に集約された判定 |
| `src/app/api/jobseeker/posts/**` | 投稿の可視判定（`ow_posts.visibility` と混在。**別の列**） |
| `src/app/biz/candidates/page.tsx:226` | `.neq("visibility","private")` |
| `src/types/genre.ts:65,67` | 集計の定義コメント |

⚠️ `ow_posts.visibility` / `ow_experiences.visibility_company` / `visibility_salary` /
`visibility_reason` は**別の列**。grep すると混ざる。

### 2-4. `public` に変えたとき、anon から読めるようになるもの

ある1人が `visibility = 'public'` になった場合に開くのは以下。**その人の行だけ**が対象。

| テーブル | 開くか | anon に出る列 |
|---|---|---|
| `ow_users` | **開く**（`ow_users_public_read`） | §1-5 の **22列** |
| `ow_experiences` | **開く**（`visibility_company <> 'hidden'` の行のみ） | §1-5 の **21列** |
| `ow_career_profiles` | **開く**（`is_published = true` の場合のみ。本番の該当は1行） | `id` `user_id` `headline` `years_of_experience` `is_published` の **5列** |
| `get_public_career_steps` | **開く** | 18列を返す（`company_id`/`company_text` は `visibility_company='real'` のときだけ、`join_reason` は `visibility_reason` のときだけ） |
| **`ow_profiles`** | **開かない** | ポリシーが admin / 本人のみで **`visibility` を参照していない** |
| `ow_user_educations` | **開かない** | anon の列 GRANT が0列。ポリシーも `visibility` を参照しない |
| `ow_schools` | **開かない** | ポリシーが `authenticated` ロール限定 |

### 2-5. 機微列が巻き込まれるか（列単位で確認した結果）

**依頼書が名指しした4つは、いずれも `public` にしても anon に出ない。**

| 機微項目 | 実体の列 | anon に出るか | 理由 |
|---|---|---|---|
| **生年月日** | `ow_users.birth_date` | **出ない** | anon の列 GRANT から除外（401 で実測） |
| | `ow_career_profiles.birth_year` | **出ない** | anon の列 GRANT から除外 |
| **連絡先** | `ow_users.email` | **出ない** | anon の列 GRANT から除外 |
| **希望条件** | `ow_profiles` 全26列 | **出ない** | ポリシーが `visibility` を参照しないため、`public` にしても 0件のまま |
| **退職理由** | `ow_experiences.exit_reason` / `leave_reasons` | **出ない** | anon の列 GRANT から除外（401 で実測） |
| （年収） | `salary_man` / `salary_base` / `salary_bonus` / `salary_stock` | **出ない** | anon の列 GRANT から除外 |

**一方で、`public` にすると anon に出る「一行」以外のもの:**

| 出るもの | 列 |
|---|---|
| 職歴の自由記述 | `ow_experiences.description` |
| **入社理由（単数）** | `ow_experiences.join_reason` |
| 匿名化した社名 | `ow_experiences.company_anonymized` |
| 勤務地の都道府県 | `ow_experiences.prefecture` / `remote_work_status` |
| 在籍期間の全履歴 | `started_at` / `ended_at` / `is_current` / `employment_type`（**全職歴分**。現職1行だけではない） |
| 自己紹介・志向 | `ow_users.about_me` `future_aspirations` `headline` `catchphrase` `social_links` `location` |
| 面談・スカウトの意思表示 | `ow_users.is_open_to_work` `can_casual_meeting` `can_talk_to_candidates` `can_talk_to_hr` `is_mentor` |
| **auth のユーザーID** | `ow_users.auth_id` |
| 検証用フラグ | `ow_users.is_test` |

### 2-6. ★`visibility_reason` は**テーブル直読みでは効かない**

`ow_experiences.visibility_reason`（入社理由を出すかの本人フラグ）を honor しているのは
**`get_public_career_steps` の中だけ**。
RLS 経由のテーブル直読みには `join_reason` をマスクする仕組みが無く、
`join_reason` と `visibility_reason` は**どちらも anon の列 GRANT に入っている**。

つまり `public` になった人の職歴を PostgREST から直に引くと、
**`visibility_reason = false` でも `join_reason` の中身がそのまま返る。**

⚠️ 同じ形が `salary_man` で一度あり、2026-08-06 に「関数だけが守っていて実経路は見ていなかった」
という理由で関数の戻り値ごと削除された経緯が関数のコメントに残っている
（`ow_experiences` の salary 4列は anon の GRANT からも落ちているので、anon には出ない）。
**`join_reason` は GRANT から落ちていないので、同じ形が残っている。**

⚠️ **現時点で実害は0件**（`public` が0人のため anon には1行も返らない）。

---

## 3. ページの現状

### 3-1. 学校ページ

| 項目 | 実測 |
|---|---|
| ルート | **`/schools/[id]`**（`id` は `ow_schools.id` の UUID）。実体は `src/app/(jobseeker)/schools/[id]/page.tsx` |
| **一覧ルート** | **存在しない。** `src/app/(jobseeker)/schools/` の直下は `[id]` のみ。`GET /schools` は **404**（`/schools/` は 308） |
| レンダリング | **サーバー側**。`export const dynamic = "force-dynamic"` |
| データ取得 | **`createAdminClient()`**（RLS をバイパス）。`ow_schools` / `ow_user_educations` / `ow_experiences` / `ow_posts_visible` すべて admin |
| middleware | **`needsAuth` に入っていない** → 未ログインで到達する |
| 未ログインの挙動 | **HTTP 200**（リダイレクトなし・エラーなし）。56,121 バイト |
| `<title>` | **`獨協大学 出身者 | OPINIO`** — **学校名が入っている** |
| `<h1>` | **`獨協大学`** — **学校名が入っている** |
| `robots` | **`noindex, nofollow`**（`generateMetadata` で明示） |
| 未ログインの本文 | 出身者 **0名**。`/u/` リンク **0件**。氏名 0件。「**出身者はログインすると表示されます**」を3箇所に表示 |
| 件数の表示 | **出していない**（0 とも N とも書かない） |

anon で本文が空になるのは RLS ではなく **`page.tsx:81` のアプリ側の分岐**。
`u.visibility === "login_only" && !isLoggedIn` で落としている。

⚠️ ページ内の該当コメントに、2026-09-01 に「未ログインに『登録はありません』と断定していた」のを
「ログインすると表示されます」に直した経緯と、**未ログインには件数を出さない**（0 と出すこと自体が
「居ない」の主張になる）という判断が書かれている。

### 3-2. 企業ページ

| 項目 | 実測 |
|---|---|
| ルート | `/companies/[id]`（`id` は slug または UUID）。実体は `src/app/(jobseeker)/companies/[id]/page.tsx` |
| レンダリング | **サーバー側の ISR**。`export const revalidate = 60` ＋ `generateStaticParams`（12社を事前生成） |
| データ取得 | **`createAdminClient()`**。ページ内で `auth.getUser()` を呼んでいない（呼ぶと動的化するため意図的） |
| middleware | `needsAuth` に入っていない（`/companies/[id]/casual-meeting` だけ `CASUAL_MEETING_RE` で対象） |
| 未ログインの挙動 | **HTTP 200**。277,078 バイト。`x-vercel-cache: HIT` |
| `<title>` | **`株式会社セールスフォース・ジャパン — 企業情報・求人 | OPINIO`** — **企業名（正式名称）が入っている** |
| `<h1>` | **`Salesforce`** — ⚠️ **h1 は英語ブランド名**。正式名称は `<title>` と本文（3箇所）にある |
| `robots` | `index, follow`（ディレクトリ非掲載の企業だけ `noindex, follow`） |
| 未ログインの本文 | 氏名 0件。`/u/` リンク **0件**。「社員・OB/OG」タブは存在。求人件数 `2` を表示 |
| **件数の表示** | **出している。**「**ログインすると 1 名のプロフィールが見られます**」（`CompanyEmployeeSections.tsx:386, 808`） |

**企業ページは既に「集計は未ログインに公開・個人はログイン後」の形になっている。**
人数は anon に出ており、氏名とプロフィールへの導線だけが閉じている。

### 3-3. 参考: `/people`

| 項目 | 実測 |
|---|---|
| 未ログインの挙動 | **307 → `https://opinio.jp/auth?next=%2Fpeople`** |
| middleware | `pathname === "/people" || pathname.startsWith("/people/")` で `needsAuth` |

`/u/` も `pathname.startsWith("/u/")` で `needsAuth`。

⚠️ 学校ページへの入口は現状 `/people`（要ログイン）のみ。
**トップページ（未ログイン）に `/schools/` へのリンクは 0件。**

---

## 4. 集計の最低件数

実ユーザー（`is_test=false` かつ `is_system=false` かつ `visibility<>'private'`）で数えた。

| 条件 | 該当数 |
|---|---|
| **在籍者（現職）が3人以上の企業** | **1社**（株式会社セールスフォース・ジャパン、3人） |
| **退職者が3人以上の企業** | **0社** |
| **卒業生が3人以上の学校** | **0校** |

分布の上位:

| 現職の人数 | 企業 |
|---|---|
| 3 | 株式会社セールスフォース・ジャパン |
| 1 | 伊藤忠テクノソリューションズ／日本ヒューレット・パッカード／海光電業 |

| 卒業生の人数 | 学校 |
|---|---|
| **2** | 獨協大学（**最大**） |
| 1 | 埼玉県立朝霞西高等学校／大阪学院大学／徳島県立城東高等学校／京都産業大学 ほか |

**卒業生が1人以上いる学校は 9校**（`ow_schools` マスタは 37校）。
**掲載企業は 90社**（`ow_companies` 100社中 `is_published = true`）。

→ **最低件数を3に置くと、表示できるページは企業1社のみ。学校は0校。**
   最低件数を2に置いても、学校は獨協大学の1校だけ、退職者3人以上の企業は0社のまま。

---

## 5. 「集計は公開・個人は一行まで公開」に必要な変更箇所

事実として「ここを変えないと成立しない」箇所の列挙。**変更の可否は書かない。**

### 5-1. DB（データ）

| # | 対象 | 現状 |
|---|---|---|
| 1 | `ow_users.visibility` の**値** | `public` **0人** / `login_only` 40 / `private` 1。RLS 経路で anon に1行でも出すには、この値が `public` である必要がある |
| 2 | `ow_users.visibility` の **DB default** | `'login_only'::text`。新規ユーザーは既定でこの状態で生まれる |

### 5-2. DB（RLS ポリシー）

| # | 対象 | 現状 | anon に出すために効いてくる点 |
|---|---|---|---|
| 3 | `ow_users_public_read` | `visibility = 'public'` | 値を変える（5-1）か、条件を変えるかのどちらか |
| 4 | `ow_experiences_public_read` | `visibility_company <> 'hidden'` ＋ 本人が `public` | 同上 |
| 5 | **`ow_schools_authenticated_select`** | `USING(true)` だが **`polroles = {authenticated}`** | **anon は0件。** 学校名を anon 経路で引くには role の追加か別ポリシーが要る |
| 6 | `ow_user_educations` の2本 | admin / 本人 | 卒業生を anon 経路で引くにはポリシーが要る |
| 7 | `ow_profiles` の2本 | admin / 本人。**`visibility` を参照しない** | `public` にしても開かない（＝希望条件は巻き込まれない） |

### 5-3. DB（GRANT）

| # | 対象 | 現状 |
|---|---|---|
| 8 | **`ow_user_educations`** | anon の列 GRANT が **0 / 11列**。ポリシーだけ足しても **401** のまま |
| 9 | `ow_users` / `ow_experiences` | 「一行」に要る列（`name` `avatar_url` `headline` `company_id` `role_category_id` `is_current`）は**すべて anon に配られている**。追加の GRANT は不要 |
| 10 | `ow_companies` / `ow_roles` | anon にテーブル単位で配布済み。追加不要 |
| 11 | `ow_experiences.join_reason` | anon に配布済み。§2-6 のとおり `visibility_reason` はテーブル直読みでは効かない |

### 5-4. コード

| # | ファイル | 現状 |
|---|---|---|
| 12 | `src/app/(jobseeker)/schools/[id]/page.tsx:81` | `if (u.visibility === "login_only" && !isLoggedIn) return false;` — **学校ページで anon に何を出すかを決める唯一の判定** |
| 13 | 同 `generateMetadata` | `robots: { index: false, follow: false }` — **noindex 指定** |
| 14 | 同 ヘッダー文言 | 未ログインには「出身者はログインすると表示されます」を出し、**件数を出さない**分岐 |
| 15 | `src/app/(jobseeker)/companies/[id]/CompanyEmployeeSections.tsx:386, 808` | 「ログインすると{hiddenCount}名のプロフィールが見られます」— **件数は既に anon に出ている** |
| 16 | `src/middleware.ts:51,54` | `/u/` と `/people` が `needsAuth`。「個人の一行」から `/u/[id]` へ導線を張る場合はここに掛かる |
| 17 | `src/app/(jobseeker)/schools/` | **一覧ルートが無い**（`/schools` は 404）。学校ページへの入口は `/people`（要ログイン）のみで、トップからのリンクは 0件 |
| 18 | `src/lib/constants/profileVisibility.ts` | `public` の説明文が **「OPINIO にログインしている人が閲覧できます。将来この制限を外す場合は、事前にお知らせします」**。§6 参照 |

### 5-5. アプリ経路と DB 経路の違い

**学校ページ・企業ページはどちらも `createAdminClient()` で読んでおり、RLS を通っていない。**
したがって「画面に何を出すか」は現状 **アプリ側の分岐（#12・#15）だけ**が決めている。

- 画面に出す範囲を変えるだけなら → **#12 / #14 / #15 の変更で足り、DB の GRANT / RLS は不要**
- PostgREST を anon で直に叩く経路（クライアント取得・外部利用）も開けるなら → **#1〜#8 が要る**

---

## 6. 機微列が巻き込まれるリスク

| リスク | 有無 | 根拠 |
|---|---|---|
| 生年月日が anon に出る | **無し** | `ow_users.birth_date` / `ow_career_profiles.birth_year` とも anon の列 GRANT から除外。混ぜると **401**（実測） |
| 連絡先が anon に出る | **無し** | `ow_users.email` 同上 |
| 希望条件が anon に出る | **無し** | `ow_profiles` のポリシーは `visibility` を参照しないので、`public` にしても開かない |
| 退職理由が anon に出る | **無し** | `exit_reason` / `leave_reasons` とも anon の列 GRANT から除外（実測 401） |
| 年収が anon に出る | **無し** | `salary_*` 4列とも anon の列 GRANT から除外 |
| **入社理由が本人の意思に反して anon に出る** | **有り（条件付き）** | §2-6。`join_reason` と `visibility_reason` の両方が anon に配られており、**テーブル直読みは `visibility_reason` を honor しない**。`visibility_reason = false` でも中身が返る。**`public` の人が出た時点で成立する** |
| 職歴の全期間・自由記述が anon に出る | **有り** | `public` にすると `description` `prefecture` `started_at`/`ended_at` を含む**全職歴行**が開く。「現職の一行だけ」に絞る仕組みは RLS にも GRANT にも無い |
| `auth_id` が anon に出る | **有り** | `ow_users.auth_id` は anon の列 GRANT に含まれている |
| 学校の在籍情報が anon に出る | **無し（現状）** | `ow_user_educations` は anon GRANT 0列。ポリシーを足しても GRANT が無いと 401 |

⚠️ **現時点で実害は0件。** `public` が0人なので、上記「有り」はいずれも
**まだ1行も返っていない**（anon の実測はすべて 200 / 0件）。

---

## 7. 現時点のデータ量で、中身のあるページが存在するか

| ページ | 未ログインで出せる中身（最低件数3の場合） |
|---|---|
| 企業ページ | **1社のみ**（セールスフォース・ジャパン、現職3人）。退職者3人以上は **0社** |
| 学校ページ | **0校**（最大は獨協大学の2人）。卒業生が1人以上いる学校は9校、`ow_schools` マスタは37校 |

最低件数を **2** に下げた場合: 学校は **1校**（獨協大学）、退職者2人以上の企業は
セールスフォース・ジャパンの **1社**。

企業ページ側は「集計」として企業属性（社名・事業領域・従業員数・求人）を既に
未ログインへ出しており、**掲載90社すべてが 200 で表示されている**。
在籍者数に依存しない部分は現時点でも中身がある。

学校ページは学校属性が `ow_schools` の 10列（名称・カナ・ロゴ・国・種別）しか無く、
**卒業生を出さない場合、未ログインに表示できるのは学校名と種別のみ**。

---

## 8. 取得できなかったもの

なし。§1〜§7 の全項目を実測で取得した。

⚠️ 1点だけ測っていないことを明記する。
**`visibility = 'public'` のユーザーが実在する状態での anon の返り値は測っていない。**
本番に `public` のユーザーが0人であり、値を変更しないという依頼の制約による。
§2-4 / §2-5 / §6 の「開く / 出る」は、**GRANT とポリシー条件の読み取りから導いた判定**であって、
行が返るところまでの実測ではない。
