# フェーズ0 調査 — DBトリガーの `split_part(email)` を塞ぐ

作成: 2026-09-17 / ★**変更は一切していない**（コード・DB とも）。`git add` もしていない。
実測は本番 Supabase。⚠️ 件数はこの日付のもの。

---

## 結論を先に

| # | 分かったこと |
|---|---|
| ★1 | **`ow_users.name` は NOT NULL・既定値なし。** したがって「名前が無ければ NULL」は**採れない** ——トリガーの INSERT が落ち、**サインアップ全体が止まる**。 |
| ★2 | **正しい直し方は `split_part(...)` を `'ユーザー'` に差し替えること。** アプリ側（`lib/auth/linkOwUser.ts`）が**既にそうしている**ので、2つの経路が揃う。新しい語彙も列の変更も要らない。 |
| ★3 | **本番の関数定義は migration ファイルと完全に一致している**（`20260804143145`）。別の変更は入っていない。 |
| ★4 | **`auth.users` の非内部トリガーは `on_auth_user_created` の1本だけ。** 残り62本はすべて FK の内部トリガーで、しかも DELETE / UPDATE 用。**INSERT で動くのはこの1本だけ。** |
| ★5 | **実際に踏む経路は「招待」と「マジックリンク」。** `inviteUserByEmail` は `data: { invited_role, invited_by }` しか渡しておらず、**`name` も `full_name` も無い。** これから声かけで使う経路そのもの。 |
| ★6 | 既存データは **1件のみ**（`is_test` / 2026-06-28）。実ユーザーは0人。**触らない。** |
| ★7 | ★**関数の外にもう1箇所ある。** ウェルカムメールの宛名（`postAuth.ts:136`）が `email.split("@")[0]` に落ちる。**今回の対象外**だが、同じ性質なので報告に残す。 |

---

## 0-1. トリガーの現状

### 定義（本番 DB から取得。`pg_get_functiondef`）

```sql
CREATE OR REPLACE FUNCTION public.handle_new_ow_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- ow_users（従来どおり。ここは変えない）
  INSERT INTO public.ow_users (
    auth_id, email, name, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)          -- ★ここ
    ),
    NOW(), NOW()
  )
  -- email が既にある = 運営が先に作った行が存在する。ここでは紐付けず callback に任せる。
  ON CONFLICT (email) DO NOTHING;

  -- ow_profiles（2026-08-04 追加）
  -- ⚠️ scout_enabled は書かない。列の既定値に任せる。
  -- ⚠️ user_id は auth.users.id（ow_users.id ではない）。
  -- ⚠️ ここが例外を投げると auth.users の INSERT ごと失敗し、サインアップが止まる。
  INSERT INTO public.ow_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$
```

★**migration ファイルと完全に一致**（`supabase/migrations/20260804143145_scout_enabled_default_true.sql` の③）。
手で当てた差分は無い。

⚠️ この関数を定義している migration は**4本ある**（後のものが勝つ）。
`20260727000000_baseline` → `20260802155842`（`auth_linked_at`）→
`20260803163809`（**visibility のハードコードを外した**）→ `20260804143145`（**最新**）。
**次に書く migration は5本目になる。**

### name を決める分岐 — 経路ごとに何が入るか

| 登録の経路 | `raw_user_meta_data` に入るもの | name の決まり方 |
|---|---|---|
| **パスワード登録**（`/auth`） | `{ name: 入力値 }`（フォームが `required`） | ① `name` |
| **パスワード登録**（`/biz/auth`） | `{ name: contactName }` | ① `name` |
| **Google OAuth** | プロバイダが `name` / `full_name` を入れる | ① or ② |
| ★**招待**（`/api/admin/invite` → `inviteUserByEmail`） | ★**`{ invited_role, invited_by }` だけ**。name は無い | ★**③ `split_part`** |
| ★**マジックリンク**（`generateLink` / `verifyOtp`） | ★**無し** | ★**③ `split_part`** |

⚠️★**これから声かけで使う経路（招待・マジックリンク）が、まさに③に落ちる。**

### 例外処理・ON CONFLICT

| | |
|---|---|
| `EXCEPTION` 句 | ★**無い。** 例外はそのまま上がる ＝ **`auth.users` の INSERT ごと失敗し、サインアップが止まる** |
| `ow_users` の衝突 | `ON CONFLICT (email) DO NOTHING`（運営が先に作った行があるときは触らず、`/auth/callback` 側の `resolveOrLinkOwUser` に任せる） |
| `ow_profiles` の衝突 | `ON CONFLICT (user_id) DO NOTHING`（`20260804143145` で UNIQUE を張って成立させた） |
| 同時に作る他の行 | `ow_profiles`（`user_id` だけ。`scout_enabled` は**書かない**＝列の既定値に任せる） |
| SECURITY | `SECURITY DEFINER` / `search_path = public` |

⚠️★**だから「NULL にする」が危ない。** NOT NULL 違反 → 例外 → サインアップ停止。

---

## 0-2. name が NULL / 空のときの影響

### 制約

| | |
|---|---|
| `ow_users.name` | ★**`NOT NULL`・既定値なし・CHECK なし**（`text`） |
| `ow_users.email` | `NOT NULL` |

→ ★**NULL は入れられない。** 空文字（`''`）は制約上は通るが、**現に0件**。

実測（2026-09-17 / 全48行）: `name = 'ユーザー'` **0件** ／ 空文字・空白のみ **0件**。

### 表示側

`name` が NOT NULL なので、画面側の `?? フォールバック` は**ほぼ到達しない**。
到達しうる経路として `?? email.split("@")[0]` を書いている箇所が2つあるが、
どちらも**自分自身の表示**で、他人には出ない。

| 場所 | 何を出すか | 判定 |
|---|---|---|
| `JobseekerHeader.tsx:105` | `owUser?.name ?? authUser.email?.split("@")[0] ?? ""` | 自分のヘッダー。`ow_users` が引けなかったときの保険 |
| `mypage/conversations/[id]/page.tsx:85` | `owUser.name ?? user.email?.split("@")[0] ?? null` | 自分の会話画面 |
| `/people` / 企業ページ / `/u/[id]` / フィード / `/admin` | **`name` をそのまま出す**（フォールバック無し） | NOT NULL なので空にならない |

⚠️ 「 さん」のような**単位だけ残る**形は、`name` 由来では**起きない**
（メールの宛名は別系統。0-3 の ★ を参照）。

### オンボーディング

**1画面目（あなたのこと）で 姓・名・せい・めい・生年月日が5つとも必須。**
`ow_users.name` は `buildDisplayName(姓, 名)` で**上書きされる**。
★**「後で設定する」はこの画面には出ない**（出すと必須にならないため）。

⚠️ ただし**画面を閉じれば抜けられる**。その人は `name` がトリガーの値のまま残る。
   ＝ 修正後は **「ユーザー」** のまま残る（= プレースホルダとして読める。これは意図どおり）。

---

## 0-3. 他の「メールから名前を作る」処理 — 全件

`split("@")` / `split_part(...,'@',...)` を `src` / `scripts` / `supabase`（archive を除く）で全件走査。

### ★DB に保存される（＝個人情報が残る）

| # | 場所 | 状態 |
|---|---|---|
| 1 | ★**`handle_new_ow_user`（トリガー）** → `ow_users.name` | ★**今回の対象。塞がれていない** |

**これ1つだけ。** 他に `ow_users.name` へメール由来の値を書く経路は無い。

### 表示するだけ（DB に残らない）

| 場所 | 何に使うか |
|---|---|
| `biz/auth/page.tsx:104` / `biz/dashboard/page.tsx:25` / `biz/jobs/new/page.tsx:19` / `lib/business/dashboard.ts:125,183` | `/biz` の担当者名（**本人向け**の「ご担当者」フォールバック） |
| `biz/companies/add/new/page.tsx:24` | 自分のバッジ表示。**保存しない** |
| `JobseekerHeader.tsx:105` / `mypage/conversations/[id]/page.tsx:85` | 自分の表示名の保険（0-2） |
| ★**`lib/auth/postAuth.ts:136`** | ★**ウェルカムメールの宛名。** `user_metadata.name ?? full_name ?? email.split("@")[0] ?? "さん"` |
| `lib/constants/emailDomains.ts:21` | `split("@")[1]` ＝ **ドメイン側**。無関係 |

⚠️★**`postAuth.ts:136` は今回の対象外**（`ow_users` に保存しない／宛先は本人だけ）。
   ただし**同じ性質**なので記録に残す。招待・マジックリンクで登録した人には
   **「`contact+16` さん、ようこそ」**という宛名のメールが届く。

### 2026-09-14 に塞いだアプリ側が、いまも塞がったままか

| 場所 | 状態 |
|---|---|
| `lib/auth/linkOwUser.ts` | ★**塞がれたまま。** `const displayName = (name?.trim() \|\| "ユーザー").slice(0, 100);` ＋「戻さないこと」の注記あり |
| `src/app/(auth)/auth/page.tsx:157` | ★**塞がれたまま。** `data: { name: name.trim() }` ＋「`\|\| email.split("@")[0]` を戻さないこと」の注記あり |

**どちらも復活していない。** 残っているのはトリガーだけ。

---

## 0-4. 既存データ（★変更しない）

`ow_users.name` が `split_part(email,'@',1)` と一致する行:

| 区分 | 件数 | 作成時期 |
|---|---|---|
| **実ユーザー**（`is_test=false` / `is_system=false` / `auth_id` あり） | ★**0件** | — |
| `is_test` | **1件** | 2026-06-28 |

★**1件とも触らない。** `is_test` なので求職者側の全経路から除外されており、実害は無い。

⚠️ 修正しても**この行は変わらない**（トリガーは新規 INSERT にしか効かない）。それでよい。

---

## 0-5. 修正案と検証方法

### 修正案（★NULL は採れないので `'ユーザー'` にする）

```diff
     COALESCE(
       NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
       NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
-      split_part(NEW.email, '@', 1)
+      'ユーザー'
     ),
```

**理由**

| # | |
|---|---|
| ① | ★`ow_users.name` は **NOT NULL・既定値なし**。NULL にすると INSERT が落ち、**サインアップが止まる** |
| ② | ★**アプリ側（`linkOwUser.ts`）が既に `"ユーザー"` を使っている。** 同じ値にすれば2つの経路が揃う。新しい語彙を増やさない |
| ③ | 列の変更（DEFAULT 追加 / nullable 化）をしない。**`CREATE OR REPLACE FUNCTION` だけで済む** |
| ④ | 「ユーザー」は**プレースホルダと読める値**。オンボーディング1画面目（必須）で上書きされる（`linkOwUser.ts` のコメントに同じ理由がある） |

⚠️★**`CREATE TRIGGER` には触らない。** 関数の差し替えだけ。
⚠️★**`ow_profiles` の INSERT と `ON CONFLICT` は1文字も変えない。**

#### 採らなかった案

| 案 | なぜ採らないか |
|---|---|
| `name` を NULL にする | ★**NOT NULL 違反でサインアップが止まる** |
| `ow_users.name` を nullable にする | 読み手が「必ずある」前提で書かれている（フォールバック無しで出している箇所が多数）。影響が広すぎる |
| `name` 列に DEFAULT を付けてトリガーの列リストから外す | 既定値が**DB とアプリの2箇所**になる。`scout_enabled` / `visibility` で2度失敗している形 |
| メールアドレスを伏せ字にして入れる（`co****@…`） | **推測値の投入**。「値が無いことを、ある値に置き換えない」に反する |

### 検証方法（★案。実行していない）

#### 案A（推奨・**リスク0**）— 式そのものを SELECT で確かめる

`auth.users` に一切触らずに、COALESCE の分岐だけを確かめる。

```sql
-- 経路ごとに何が返るかを1クエリで出す（★読み取りのみ）
with cases(label, meta) as (values
  ('パスワード登録',   '{"name":"山田 太郎"}'::jsonb),
  ('Google OAuth',     '{"full_name":"Taro Yamada"}'::jsonb),
  ('空白だけ',         '{"name":"   "}'::jsonb),
  ('招待',             '{"invited_role":"candidate"}'::jsonb),
  ('マジックリンク',   '{}'::jsonb)
)
select label,
       coalesce(
         nullif(trim(meta->>'name'), ''),
         nullif(trim(meta->>'full_name'), ''),
         'ユーザー'
       ) as name_after_fix
from cases;
-- 期待: 山田 太郎 / Taro Yamada / ユーザー / ユーザー / ユーザー
```

⚠️ これは**トリガーが実際に動くこと**は確かめない。そこは migration の事後チェック
（`prosrc` に `split_part` が無いこと・`ow_profiles` の INSERT が残っていること・
トリガーが `auth.users` に張られたままであること）で担保する。
**`20260804143145` に同じ形の事後チェックが既にあるので、それを踏襲できる。**

#### 案B（**承認が要る**）— BEGIN → INSERT → 確認 → ROLLBACK

**調べた結果、技術的には可能。** ただし本番の `auth.users` に一瞬だけ書く。

| 確かめたこと | 結果 |
|---|---|
| `auth.users` の**非内部**トリガー | ★**`on_auth_user_created` の1本だけ。** 他62本はすべて FK の内部トリガーで、DELETE / UPDATE 用。**INSERT で動くのはこの1本** |
| `auth.users` の NOT NULL 列 | **`id` / `is_sso_user` / `is_anonymous` の3つだけ**（`email` すら nullable）。最小の INSERT で足りる |
| ロールバックの範囲 | `ow_users` / `ow_profiles` への INSERT も**同じトランザクション内**なので一緒に戻る |
| メール送信などの副作用 | GoTrue は**アプリ層**で動くので、SQL の直接 INSERT では**メールも Webhook も飛ばない** |
| ★実行手段 | ★**MCP の `execute_sql` は読み取り専用**（実測: `cannot execute UPDATE in a read-only transaction`）。**`psql` で直接つなぐ必要がある** |

```sql
-- ★案。実行していない。実行するなら psql で、1トランザクションのまま。
BEGIN;
  INSERT INTO auth.users (id, email, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'trigger-check@example.invalid', '{}'::jsonb, false, false);

  SELECT name FROM ow_users WHERE email = 'trigger-check@example.invalid';
  -- 期待: ユーザー（修正前なら trigger-check）

  SELECT count(*) FROM ow_profiles p
    JOIN auth.users u ON u.id = p.user_id
   WHERE u.email = 'trigger-check@example.invalid';
  -- 期待: 1（ow_profiles 側を壊していないこと）
ROLLBACK;

-- ★ROLLBACK 後に3つとも0件であることを別トランザクションで確認する
SELECT count(*) FROM auth.users WHERE email = 'trigger-check@example.invalid';
SELECT count(*) FROM ow_users  WHERE email = 'trigger-check@example.invalid';
```

⚠️★**リスクと、それでも小さい理由**
- `auth.users` に書く以上、**ROLLBACK し損ねると本番に幽霊ユーザーが残る**
  （CLAUDE.md「本番で検証用アカウントを作らない」に抵触する）
- `.invalid` は RFC 2606 の予約 TLD で、**実在しないことが保証されている**
- `ow_users` の FK は `ON DELETE CASCADE` が多いので、**残した場合の後始末も危険**
- ⇒ ★**やるなら「ROLLBACK まで1つのコマンドで流す」こと。** 対話的に打たない

#### 推奨

★**案A（式の SELECT）＋ migration の事後チェック**で足りる、と考えます。
案Bは「トリガーが実際に発火すること」を確かめますが、それは**今回の変更で触らない部分**
（`CREATE TRIGGER` は変更しない）なので、確かめる価値がリスクに見合いません。

⚠️ ただし**「修正後に初めて実際のサインアップが通るか」は、どちらの案でも確かめられません。**
   最初の実登録が実質の本番確認になります。**その1件を柴さんが見てください。**

### 失敗したときの戻し方

**変更前の定義は下に全文を保存してある**（このファイルの 0-1）。戻すときは
`split_part(NEW.email, '@', 1)` に戻した `CREATE OR REPLACE FUNCTION` を当てるだけ。

⚠️★**`DROP FUNCTION` しないこと。** `on_auth_user_created` が依存しているので、
   CASCADE で落とすと**トリガーごと消え、サインアップで `ow_users` が作られなくなる。**
   **常に `CREATE OR REPLACE`。**

⚠️ 適用前に `./scripts/dump-tables.sh ow_users` を取る（関数は対象外なので、
   **この文書が関数側のバックアップ**）。

---

## 判断が必要な点

1. ★**フォールバックを `'ユーザー'` にしてよいか。** NULL は採れない（NOT NULL）。
   アプリ側と揃う値がこれ。
2. ★**検証は案A（式の SELECT ＋ 事後チェック）でよいか。** 案B は本番の `auth.users` に
   一瞬書くので、承認が要ると考えます。
3. **ウェルカムメールの宛名（`postAuth.ts:136`）を今回一緒に直すか。**
   ★今回の指示の範囲外なので**触らない前提**で書いていますが、招待・マジックリンクで
   登録した人には「`contact+16` さん」という宛名で届きます。**別タスクにするか、
   同じ commit に含めるか**を決めてください。
