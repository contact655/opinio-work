---
name: db-safety
description: Supabase の migration・RLS・GRANT・DROP を扱うときの検証手順。ポリシーを書く/変える、列単位 GRANT を剥がす、テーブルや関数を DROP する、migration で既存データを更新する前に必ず参照する。user_id の2空間（auth.uid() と ow_users.id）の判別もここ。
---

## migration を書くときのルール

### 1. 全社一括の UPDATE を禁止する

`WHERE is_published = true` のような条件で全社を更新しない。
**対象を id または name で明示列挙する。**

実例: `archive/258_enable_casual_meetings_all_companies.sql` が

```sql
UPDATE ow_companies SET accepting_casual_meetings = true WHERE is_published = true;
```

で全社を true にし、その直前の `archive/170_disable_casual_meetings_6companies.sql`
（「LayerX / PKSHA / Ubie / freee / SmartHR / Sansan は現時点で面談を受け付けて
いないためバッジを非表示にする」と**理由まで書いて**個別に false にしていた）を
理由もろとも打ち消していた。

結果、公開76社すべてが「面談受付中」と表示され、**全社で申込フォームが送信可能**
だった。宛先を持つのは2社しかない。

### 2. 一括 UPDATE の前に、同じ列を触った直近の migration を確認する

打ち消していないかを確認し、**確認した旨を migration のコメントに書き残す。**
`archive/258` にその一行があれば、170 を上書きしていることに気づけた。

```
-- ── 直近に同じ列を触った migration（確認済み）────────────
--   archive/170 … 6社を false（面談を受け付けていないため）→ 本migrationで復元される
--   archive/258 … 公開全社を true ← これを取り消すのが目的
```

### 3. 推測値を投入しない

**企業ごとに調べた値でなければ列に入れない。**
「とりあえず hybrid」「とりあえず東京都」「たぶん700万円〜」は、
後から migration 由来か企業設定かを判別できなくなる。

実例: 出典を記録する列が無かったために、**公開求人18件の出所調査に丸一日かかった**。
`archive/*.sql`（299本）を全文検索するしかなく、13件は実在を確認できず掲載を下ろした。
`ow_jobs.source_url` を足したのはこのため。

⚠️ 企業側にも同じ問題が残っている。2026-08-11 に除去したもの:

| 列 | 社数 | 出所 |
|---|---|---|
| `remote_work_status` | 74 → 2 | archive/156 が 'hybrid' を一括投入（2026-07-27 に除去済み） |
| `accepting_casual_meetings` | 76 → 2 | archive/258 |
| `avg_salary` | 68 → 0 | archive/157（65社）/ archive/137（3社）。**どちらも出典の記載なし** |
| 求人の `work_style` / `location` | 18 → 5 | archive/147「サンプル求人データ追加」/ archive/152 |

---


## RLS / GRANT を変えたら、非admin の実セッションで実測する（2026-08-06 確立）

**admin のセッションで測っても、権限の検証にはならない。**
2026-08-06 に「一般ユーザーでも他人の年収・プロフィールが読める」と報告したが、
検証に使っていたアカウントが DB 上の admin で、**admin ポリシーで通っていただけ**だった。
`ow_profiles` と `ow_terms_agreements` は実際には漏れていなかった。

### なぜ間違えたか

`ow_user_roles.user_id` は **`auth.uid()` 空間**（`ow_users.id` ではない）。
`ow_users.id` で照合して「admin ロール無し」と判断していた。

⚠️ **user_id 系の列がどちらの空間かは、テーブルごとに違う。**
ポリシーを書く前に必ず実測すること。判断材料は2つ。

| 判定材料 | 見方 |
|---|---|
| FK の参照先 | `REFERENCES auth.users(id)` なら auth 空間 / `REFERENCES public.ow_users(id)` なら ow_users 空間 |
| 実データ | `ow_users.id` と `ow_users.auth_id` のどちらに一致するか数える |

同じ「user_id」でも `ow_profiles` は auth 空間、`ow_experiences` は ow_users 空間。

### 非admin のセッションを取る手順

**service role で `generateLink` → `verifyOtp`。メールは飛ばず、新規ユーザーも作らない。**
（`generateLink` はリンクを返すだけで送信しない。CLAUDE.md の
「本番で検証用アカウントを作らない」に抵触しない）

```js
const admin = createClient(url, SERVICE_ROLE_KEY);
// 既存の is_test アカウントを使う。新規作成はしない
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
const pub = createClient(url, ANON_KEY);
const { data } = await pub.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
const token = data.session.access_token;
// あとは PostgREST を直接叩く
await fetch(`${url}/rest/v1/ow_users?select=email`, {
  headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
});
await pub.auth.signOut();
```

### 画面ごと確かめたいとき（ブラウザにセッションを入れる）

PostgREST を直接叩くだけでなく、**実際の画面**を非admin で見たいときは
上で得た `data.session` をクッキーに入れる。

⚠️ **`base64url` でエンコードすること。** 標準 base64 だと `+` や `/` が混ざり、
`@supabase/ssr` が `Invalid Base64-URL character "+"` を投げて**そのページが 500 になる**。

```js
const ref = new URL(url).hostname.split(".")[0];
const value = "base64-" + Buffer.from(JSON.stringify(data.session), "utf8").toString("base64url");
//                                                                              ^^^^^^^^^ ここ
// 3180文字を超えるときは sb-<ref>-auth-token.0 / .1 … に分割する
const cookieName = `sb-${ref}-auth-token`;
```

### 原則

- **RLS ポリシーか GRANT を変えたら、最低3者で実測する**：anon / 非admin / admin
- 「画面が動いている」は検証にならない。**画面は正しく作られていても、
  PostgREST を直接叩く経路だけが漏れている**のが 2026-08-06 に見つかった穴の共通形
  （年収・学歴・email・入社理由。いずれも画面側は visibility を正しく見ていた）
- 検証対象のアカウントが admin かどうかを**先に確認**する
  （`ow_user_roles` を **auth_id** で引く）

### GRANT と RLS は二層で持つ（2026-08-07 確立）

**anon に GRANT が無いと、PostgREST は `401 permission denied for table` を返し、
RLS を評価する前に止まる。** RLS ポリシーを1本書き間違えても漏れない。
逆に GRANT があると、RLS だけが最後の砦になる。**層は2つ持つこと。**

実測（`ow_profile_desired_roles`）:

| セッション | 状態 | 読めた行 | 止まった層 |
|---|---|---|---|
| anon | **401** | — | **GRANT**（RLS に到達しない） |
| 本人 | 200 | 自分の1行だけ | RLS |
| 第三者 | 200 | 0行 | RLS |
| admin | 200 | 全6行 | — |

### ⚠️ 新しいテーブルを作ったら GRANT を実測する。既定に任せない（2026-08-07 確立）

**このプロジェクトの `public` スキーマは、既定ACL が `anon` に全権限を付ける設定だった。**
`CREATE TABLE` しただけで**未ログインから読み書きできるテーブルが増える**状態で、
2026-08-06 に anon の書き込みを94テーブルから剥がしても、
作るたびに再生産されていた（`ow_profile_desired_roles` で実際に踏んだ）。

`20260807050000_default_acl_revoke_anon.sql` で既定を直した。

| ロール | 対象 | 変更前 | 変更後（2本適用後） |
|---|---|---|---|
| `postgres` | テーブル・ビュー | `postgres, anon, authenticated, service_role` | **`postgres, service_role` のみ** |
| `postgres` | シーケンス | 同上 | **`postgres, service_role` のみ** |
| `postgres` | 関数 | 同上 | **`postgres, service_role` のみ** |

`20260807050000`（anon）と `20260807060000`（authenticated）の2本に分けて適用した。

### 新しいテーブルには GRANT を必ず書く

**anon も authenticated も既定では権限が1つも付かない。**
書き忘れると PostgREST が `401 permission denied for table` を返す
（黙って空になる形ではなく、はっきり落ちる）。

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<新テーブル> TO authenticated;
GRANT ALL ON TABLE public.<新テーブル> TO service_role;
-- 未ログインにも読ませる公開テーブルのときだけ
GRANT SELECT ON TABLE public.<新テーブル> TO anon;
```

⚠️ 手間が増えたのではなく、**権限設計が migration に必ず残るようになった**。
以前は「書いていない = 全権限」で、migration を読んでも権限が分からなかった。

⚠️ `ALTER DEFAULT PRIVILEGES` は**実行したロールごと**に効く。
このプロジェクトでテーブルを作るのは `postgres`（migration も SQL Editor も）。
`supabase_admin` の既定も別に存在するが、`postgres` はそのメンバーではないため
変更できない（Supabase 内部が作るオブジェクト用なので触らない）。

⚠️ **既定を直しても、新しいテーブルの GRANT は毎回実測すること。**
既定は「これから作るもの」にしか効かず、
`GRANT` を書いた migration 自体が間違っている可能性は消えない。

```sql
select grantee, string_agg(privilege_type, ', ' order by privilege_type)
from information_schema.role_table_grants
where table_schema='public' and table_name='<新テーブル>' group by grantee;
```

⚠️ **踏みやすい罠：RLS ポリシーが呼ぶ関数には anon にも EXECUTE が要る。**
`TO` 句の無いポリシーは anon でも評価されるため、EXECUTE が無いと
**クエリ自体がエラーになる**（`auth_ow_user_id()` で経験済み）。
関数の既定からも anon を落としたので、今後ポリシーから呼ぶ関数を作るときは
明示すること。

```sql
GRANT EXECUTE ON FUNCTION public.<関数名>() TO anon, authenticated, service_role;
```

### ⚠️ 検証を自社だけで完結させない — 他社を混ぜて交差確認する（2026-08-07 追記）

**自社（株式会社Opinio）1社だけで測ると、「たまたま動く条件」を引いて
「通った＝正しい」と誤読する。** 最低2社ぶんのデータを入れて、
自社宛と他社宛を**分けて数える**こと。

2026-08-07 の事例: `ow_scouts` の company 系ポリシーは
`company_id IN (SELECT id FROM ow_companies WHERE user_id = auth.uid())` で、
**この条件を満たすのは 85社中 2社だけ**だった。
検証に使った Opinio がその2社の1つだったため「企業担当者は自社のスカウトを読める」
と測れてしまったが、**残り83社では1件も読めない**状態だった。

測り方は「他社宛の行を1件足して、両方を別々に数える」だけでよい。

| 数える単位 | なぜ |
|---|---|
| 計 | 全体の可否 |
| **自社宛** | 開くべき相手に開いたか |
| **他社宛** | **開いてはいけない相手に開いていないか（ここが本番）** |

⚠️ 他社役の会社は、**その条件を満たさない会社**を選ぶ。
Opinio と同じ性質の会社を選ぶと交差確認にならない。

### ⚠️ `ow_companies.user_id` に依存しない（2026-08-07 確立）

**85社中 2社にしか入っていない実質未使用の列。**
「会社レコードを最初に作った人」であって、担当者の一覧ではない。
実際 Opinio の `user_id` が指すアカウントは `ow_company_admins` 上で
`is_active = false`（すでに担当を外れた人）だった。

**ポリシーにもコードにも、この列で企業担当者を判定させない。**

| 判定したいこと | 使うもの |
|---|---|
| 企業の管理者か | `public.auth_is_company_admin(company_id)`（permission と is_active まで見る） |
| 企業のメンバーか | `public.auth_is_company_member(company_id)` |

2026-08-07 時点でまだ `ow_companies.user_id` に依存しているポリシー（いずれも
`public_read` か正しい空間の別ポリシーがあるため機能欠落は無いが、
その機能を session 経由で作った瞬間に「操作できない」として現れる）:

| テーブル | 本数 | 現状 |
|---|---|---|
| `ow_jobs` | 4 | `ow_jobs_company_admin_manage`(ALL) が正しい空間で存在するため実害なし |
| `ow_job_requirements` | 4 | コードからの参照 0 件 |
| `ow_job_matching_tags` | 4 | コードからの参照 0 件 |
| `ow_company_culture_tags` | 4 | 唯一の参照 `api/company/me` は admin クライアント、かつ未使用 |

---

## user_id は2つの空間がある（2026-08-06 確立）

`auth.uid()` が返すのは **auth.users.id** で、`ow_users.id` とは別物。
**どちらの空間かはテーブルごとに違う。** 同じ「user_id」でも
`ow_profiles` は auth 空間、`ow_experiences` は ow_users 空間。

**ポリシーを書く前に [docs/user-id-spaces.md](docs/user-id-spaces.md) の表を見ること。**
`ow_*` の全テーブルを FK の参照先から機械判定した一覧がある。

| 空間 | 書き方 |
|---|---|
| auth 空間 | `user_id = auth.uid()` |
| ow_users 空間 | `user_id = public.auth_ow_user_id()` |
| 会社の管理者か | `public.auth_is_company_admin(company_id)`（permission と is_active まで見る） |
| 運営か | `public.auth_is_admin()` |

⚠️ 自前で `ow_users` を JOIN して書かない。ヘルパーに寄せる。

2026-08-06 に踏んだ事故:
- 検証アカウントが admin かを `ow_users.id` で調べて「非admin」と誤判定し、
  漏洩調査の結論を1度誤って報告した（`ow_user_roles.user_id` は auth 空間）
- `ow_company_members` の6本と `ow_career_profiles` の1本が空間取り違えで**常に false**。
  拒否側なので事故は起きなかったが、その機能を作った瞬間に「admin なのに操作できない」
  として現れる状態だった

---

## 列単位 GRANT を剥がすときのチェックリスト（2026-08-06 確立）

**PostgREST は列単位で落とさない。剥奪列が select に1つでも入っていると、
そのクエリを丸ごと 403 にする。** 本人の行でも取れなくなる。

しかも Next のページは **HTTP 200 のまま**で、中身だけが静かに空になる。
2026-08-06 に `ow_users.email` / `birth_date` / `ow_experiences.join_reason` を剥がしたとき、
session クライアントのまま select していた **6箇所**を巻き添えにした。
`/mypage` はダッシュボードが丸ごと空になり、ユーザー名まで「ユーザー」に化けていたが、
HTTP 200 だったので気づけなかった。

### 剥がす前に洗うもの

1. **剥奪列の名前で grep** し、1件ずつクライアントを判定する
   （`createAdminClient` なら影響なし / session なら 403）
2. **`select("*")` を探す。** 列名の grep では絶対に引っかからないのに同じ 403 になる
3. **`.select(COLS)` のような定数・変数渡し**を追う（`JOB_LIST_COLS` など）
4. **埋め込み（`ow_users!user_id(...)`）の中身**も見る。親テーブルの select 文字列に
   紛れているので、単純な grep では見落としやすい
5. **ブラウザクライアント（`@/lib/supabase/client`）を使う画面**を特に見る。
   サーバー側は admin に寄せられるが、ブラウザからは admin を使えないので
   「列ごと表示をやめる」か「API を1本作る」しかない

### ⚠️ 書き込み経路も洗う — PostgREST は「返す列」にも権限を要求する

`Prefer: return=representation`（supabase-js の `.insert().select()` /
`.update().select()` / `.upsert().select()`）で更新後の行を返すとき、
**返す列にも SELECT 権限が要る。** 剥奪列が返却対象に入っていると
`permission denied for table ...` になる。

⚠️ **`.select()` を引数なしで呼ぶと全列を返す。** これが一番危ない。
   `.select("id")` のように列を絞っていれば安全。

⚠️ 閲覧より目立つ壊れ方をする。「保存ボタンを押したら失敗する」になる。

2026-08-06 に `ow_career_profiles` を `Prefer: return=representation` 付きで
UPDATE したところ、`gender` / `birth_year` で 403 になった。
RLS の拒否と区別がつかず、原因の特定に時間を取られた。

洗う対象:

```
grep -rn "\.insert(\|\.update(\|\.upsert(" src   # 剥奪列を持つテーブルへの書き込み
grep -rn "\.select()" src                          # 引数なし = 全列返却
```

### 剥がしたあとの確認

⚠️ **HTTP 200 を確認としない。画面の中身の値まで見る。**

| 画面 | 見るもの |
|---|---|
| `/mypage` | 名前・プロフィール完成度・経歴が出るか（完成度 0% は赤信号） |
| `/profile/edit` | 基本情報 / 職歴・学歴の各タブに中身があるか |
| `/u/[id]` | 年齢・職歴・学歴 |
| `/people` `/schools/[id]` | 一覧に人が出るか |
| `/biz/members` `/biz/meetings` `/biz/candidates` | 行が出るか |
| `/admin` | 最近の登録ユーザーに行が出るか |

**「0件」を見たら、正常な0件かリグレッションかを必ず切り分ける。**
DB を数えて期待値を出してから画面と突き合わせる
（例: `/biz/candidates` の1件は `scout_enabled=true` の絞り込みによる正常な1件だった）。

---


## ⚠️ テーブル・カラム・関数を DROP するときのチェックリスト（2026-08-07 確立）

**FK を見ただけでは足りない。**

### なぜ

**PL/pgSQL の本体は Postgres が依存として追跡しない。**
関数の中で `UPDATE ow_xxx` と書いてあっても、`DROP TABLE ow_xxx` は**成功する**。
壊れたことは**その関数を実際に呼ぶまで分からない**。

2026-08-06 の salary-remove で `ow_salary_reports` を DROP したとき、
`merge_role()` の中に `UPDATE ow_salary_reports` が残り、
**全職種の統合が約1日壊れていた**。気づけたのは、翌日たまたま統合を試したから。

⚠️ **「DROP して `npm run build` が通った」は確認にならない。**
   ビルドは DB を見ない。**その関数を実際に呼んで確かめること。**

### DROP する前に洗う場所

```sql
-- 関数（PL/pgSQL・SQL 関数とも）／ビュー／マテビュー／RLS ポリシーの全文を検索する
select '関数' k, p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosrc like '%<消す名前>%'
union all select 'ビュー', v.viewname, v.definition from pg_views v
 where v.schemaname='public' and v.definition like '%<消す名前>%'
union all select 'マテビュー', m.matviewname, m.definition from pg_matviews m
 where m.schemaname='public' and m.definition like '%<消す名前>%'
union all select 'ポリシー', pol.tablename||' / '||pol.policyname,
       coalesce(pol.qual,'')||' '||coalesce(pol.with_check,'')
 from pg_policies pol where pol.schemaname='public'
   and (coalesce(pol.qual,'') like '%<消す名前>%' or coalesce(pol.with_check,'') like '%<消す名前>%');
```

⚠️ **カラムを消すときも同じ。** 列名で全文検索する。

⚠️ トリガー関数は `pg_trigger` から辿るのではなく、**関数の本体で探す**。
   関数がどのトリガーに紐づいているかとは別に、本体が消えたテーブルを触っていることがある。

### 定期的に「参照先が実在するか」を突き合わせる

DROP のたびに洗うだけでは、**最初から存在しないものを参照しているコード**は見つからない。
2026-08-07 に洗ったところ、`ow_company_reviews` が
**baseline にも無く、どの migration でも作られていない**のに、
アプリの2箇所（`getCompanyReviewSummaries()` と admin の口コミ審査待ちKPI）が
読みに行っていた。`const { data } = await ...` で **error を見ずに** `if (!data) return {}`
していたため、`/jobs` と `/companies` の全レンダリングで**静かに空を返し続けていた**。

**DB 側（関数・ビュー・ポリシー）:**

```sql
select k as 種別, nm as 名前, obj as 存在しない参照先 from (
  select distinct k, nm, m[1] as obj from (
    select '関数' k, p.proname nm, p.prosrc body from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc is not null
    union all select 'ビュー', v.viewname, v.definition from pg_views v where v.schemaname='public'
    union all select 'ポリシー', pol.tablename||' / '||pol.policyname,
           coalesce(pol.qual,'')||' '||coalesce(pol.with_check,'')
      from pg_policies pol where pol.schemaname='public'
  ) s, lateral regexp_matches(s.body, '\mow_[a-z0-9_]+\M', 'g') m
) t
where to_regclass('public.'||obj) is null
  and not exists (select 1 from information_schema.columns
                   where table_schema='public' and column_name = t.obj);
```

**アプリ側:** `grep -rhoE '\.from\("(ow_[a-z0-9_]+)"' src` で全テーブル名を出し、
`to_regclass` で1つずつ突き合わせる。2026-08-07 時点で **65テーブル中1つ**が該当した。

⚠️ この検査は `20260807070000_fix_merge_role_drop_review_fns.sql` の事後チェックに
   組み込んである。**新しい migration でも同じ検査を回すと、DROP の取りこぼしを毎回拾える。**

---

## Migration 運用ルール（2026-07-27 確立）

### 基本原則
- SQL Editor での手動適用を禁止する。必ず migration ファイルを作成し
  `supabase db push` で適用する
- 新規 migration は `supabase migration new <name>` で採番する
  （タイムスタンプ命名。連番は使わない）
- `supabase/migrations/` 直下には baseline と新規 migration のみを置く
- `supabase/migrations/archive/` は 2026-07-27 以前の履歴。
  CLI の対象外であり、再適用しない

### baseline について
- `20260727000000_baseline.sql` が現在のスキーマの起点
- 2026-07-27 時点の本番スキーマを pg_dump で取得し、
  Supabase Branch での round-trip diff により検証済み
- 旧 migration ファイル 299本は連番の重複が15組あり、
  適用順序を復元できなかったため archive に退避した

### 型の同期
- migration 適用のたびに `npm run gen:types` を実行してコミットする
- 型定義が実態とズレると、存在しないカラムを参照するバグが
  エラーを出さずに埋もれる（2026-07-27 の birth_year / auth_user_id /
  ow_mentors の事例）

### 残タスク
- 型エラー約100件を解消し、`createClient<Database>` の generic を
  再有効化する。これが再発防止の本体

### ダンプ手順（Docker なし環境）
- Docker を使わず pg_dump を直接実行して本番 DB からスキーマを取得する
- Supabase CLI の db dump はローカル Docker が必要なため使用不可
- 代わりに `PGPASSWORD=<pass> pg_dump <connection_string>` を使用
  フラグ: `--schema-only --quote-all-identifier --role "postgres"`
  除外スキーマ: `_analytics _realtime auth cron extensions graphql graphql_public
    pgbouncer pgsodium pgsodium_masks pgtle realtime storage supabase_functions
    supabase_migrations tiger tiger_data topology vault`
- 接続先: `aws-0-ap-northeast-1.pooler.supabase.com:5432`（session mode）
- パスワード取得: `supabase branches get <ref> --output json` の `.db_pass` フィールド、
  または Supabase ダッシュボードの Project Settings > Database

---

