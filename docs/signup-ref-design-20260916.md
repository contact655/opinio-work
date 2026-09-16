# 登録経路の計測（`?ref=`）— 調査と設計案

作成: 2026-09-16 / ★**調査と設計だけ。実装していない**（コード・DB とも変更なし）

**やりたいこと**（柴さん）: 特定の企業の在籍者・元在籍者に個別に声をかけて登録を依頼する。
**どの声かけから何人が登録し、経歴まで入れたか**を測れるようにしたい。

---

## 1. いまある仕組み — ★**流入元を記録している仕組みは無い**

| 探したもの | 結果 |
|---|---|
| `utm_*` / `ref` / `referral` / 招待コードの扱い | ★**src に0件**（`useRef` などの誤検出を除いて完全に0） |
| `ow_users` の列（**38列**） | ★**流入元に当たる列は無い**。`source` も `referrer` も無い |
| `auth.users.invited_at` | **0件**（＝ 運営の招待メールは一度も成立していない） |
| アクセス解析 | Sentry のみ（`sentry.client.config.ts` の `viewport` タグ）。**登録との紐付けは無い** |

### `ow_companies.source` を流用できるか → ★**できない。名前も借りないほうがよい**

| | `ow_companies.source` | 今回ほしいもの |
|---|---|---|
| 主語 | **企業**が | **人**が |
| 意味 | **どの入口から作られたか**（`migration` / `manual` / `biz_self` / `admin_seed` / `user`） | **どの声かけから来たか**（自由文字列） |
| 語彙 | **DB の CHECK で固定**（5値） | ★**固定しない**（声かけのたびに増える） |

⚠️★**`ow_users.source` という名前にしないこと。** 意味が違うのに同じ名前だと、
   `companySource.ts` を読んだ人が同じ語彙だと思う。**`signup_ref`** を推す。

⚠️ `companySource.ts` の経緯（CHECK も定数も無い列挙列を後から張った話）は**そのまま教訓になる**。
   ただし今回は**列挙にしない**ので、CHECK ではなく**形式の検証**で守る（下記）。

---

## 2. ★設計を決める前に知っておくべき制約（今回の調査で分かった）

### ★制約① `ow_users` の行は **DB トリガーが作る**

```
auth.users への INSERT
  → トリガー on_auth_user_created → public.handle_new_ow_user()
      INSERT INTO ow_users (auth_id, email, name, created_at, updated_at)
      ON CONFLICT (email) DO NOTHING
```

⚠️★**したがって、アプリ側の INSERT に `ref` を混ぜる案は成り立たない。**
   `lib/auth/linkOwUser.ts` の INSERT は**トリガーが先に作るのでほぼ到達しない**
   （`resolveOrLinkOwUser` は `"existing"` を返す）。

→ **`ref` は「作るとき」ではなく「作られたあとに1回だけ UPDATE する」形になる。**
  これは要件（「登録完了時に1回だけ記録する。以後は上書きしない」）とも合う。

### ★制約② パスワード登録は **サーバーの後処理を1つも通らない**

`resolveOwUserForVerifiedEmail`（`postAuth.ts`）を呼ぶのは
**`/auth/confirm` と `/auth/callback` の2つだけ**。
CLAUDE.md のとおり「パスワードログイン/登録は callback を通らない」ので、
**いちばん本命の登録経路にサーバー側のフックが無い。**

→ `postAuth` に書くだけでは**パスワード登録を取りこぼす。**

### ★制約③ メールのリンクは**別のブラウザで開かれうる**

CLAUDE.md「認証メールのリンクは `/auth/confirm`」の節のとおり、
スマホのメールアプリ内ブラウザなど**登録したブラウザとは別**で開かれることがある。

→ **cookie だけに頼ると、その経路で ref が落ちる。**
  ⚠️ ただし**このプロジェクトはメール確認が実質無効**で、パスワード登録は
  その場でセッションが立つ（CLAUDE.md: 46名中44名が作成から3秒以内に confirmed）。
  **主経路は同一ブラウザで完結する。**

---

## 3. 最小の設計案（推奨）

### 3-1. 列

```sql
alter table ow_users add column signup_ref text;

comment on column ow_users.signup_ref is
  '登録時の流入元。?ref= で受け取り、登録後に1回だけ書く（以後上書きしない）。
   ⚠️ 個人を特定する文字列を入れない運用。値の妥当性は形式のみで担保する';

-- 形式だけ縛る。★語彙は縛らない（声かけのたびに増えるため）
alter table ow_users add constraint ow_users_signup_ref_format
  check (signup_ref is null or signup_ref ~ '^[a-z0-9][a-z0-9_-]{0,39}$');

create index on ow_users (signup_ref) where signup_ref is not null;
```

| 決めごと | 値 | 理由 |
|---|---|---|
| 文字種 | `[a-z0-9_-]`（小文字英数・ハイフン・アンダースコア） | URL に出るので大小の揺れを作らない。記号を絞ると誤入力が減る |
| 長さ | **1〜40** | `sf-alumni-0916` で14。40 あれば足りる |
| 先頭 | 英数字 | `-` 始まりを禁止（CLI や CSV で事故る） |
| 語彙 | ★**固定しない** | CHECK に列挙すると、声かけのたびに migration が要る |

⚠️★**これは「値の集合」の制約ではなく「形式」の制約。** CLAUDE.md の
   「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」は**当てはまらない**
   （`ow_companies.source` とは性質が違う）。**列挙に直そうとしないこと。**

### ★GRANT は付けない

`ow_users` は **SELECT も UPDATE も列単位 GRANT**（CLAUDE.md）。
`signup_ref` は**運営しか読まない・運営の経路しか書かない**ので、
★**`grant` を書かない**（`can_casual_meeting` / `is_test` / `email` と同じ扱い）。

⚠️★**そのぶん、読み書きは必ず `createAdminClient` を通る。**
   セッションのクライアントで select に混ぜると**クエリごと 403** になり、
   `?? []` で受けている側では**静かに0件**になる（CLAUDE.md）。

### 3-2. 受け取り — cookie（middleware で1行）

```
GET /?ref=sf-alumni-0916  （どのパスでもよい）
  → src/middleware.ts が形式を検証して HttpOnly cookie `opinio_ref` を立てる
     Max-Age 30日 / SameSite=Lax / Secure（本番）
```

⚠️★**検証に通らない値は cookie を立てない**（黙って捨てる）。
   URL の値をそのまま持ち回らない（CLAUDE.md「利用者の入力文字列をそのまま DB に渡さない」）。
⚠️ **既に cookie があれば上書きしない**。最初の声かけを勝ちにする
   （列の「1回だけ・上書きしない」と向きを揃える）。
⚠️ middleware は公開ページでは Supabase に出ないようにしてある。
   **その最適化を壊さないこと**（cookie を読むだけ。DB に触らない）。

### 3-3. 書き込み — ★**1箇所だけ**

```
POST /api/jobseeker/signup-ref   （ボディ無し。cookie とセッションだけを見る）
  1. auth.getUser() でセッションを確かめる
  2. cookie `opinio_ref` を読み、形式を再検証する
  3. mutateAllowNone(
       admin.from("ow_users").update({ signup_ref: v })
         .eq("auth_id", user.id).is("signup_ref", null),   ← ★これが「上書きしない」の実体
       "signup_ref", { returning: "id" })
  4. cookie を消す
```

⚠️★**`.is("signup_ref", null)` を外さないこと。** これが「1回だけ」の保証。
   アプリ側の `if` でやると、同時実行で二重に書ける。
⚠️ **0行でも正常**（2回目以降・ref 無し）。`mutateAllowNone` を使う理由がこれ。
⚠️ **`.select()` はヘルパーが付ける。** 素で書くと全列を返して列単位 GRANT に弾かれる。

#### ★呼び出し元をどこにするか（要判断）

制約②のせいで「サーバーの共通後処理」が無いため、**呼ぶ場所を決める必要がある。**

| 案 | 呼び出し元 | 取りこぼし | 備考 |
|---|---|---|---|
| **A（推奨）** | **`OnboardingGuard`** の既存のセッション判定に相乗り | ★**無し**（全経路がここを通る） | 既に `sessionStorage` で1セッション1回に畳んである。⚠️ 役目が1つ増えるので**コメントで理由を書く** |
| B | `/auth` の signUp 成功時 ＋ `postAuth`（confirm/callback） | Google ログインの初回など**経路ごとに漏れる** | ⚠️ **2箇所に同じ判定**。CLAUDE.md が繰り返し戒めている形 |
| C | トリガーを直し、`raw_user_meta_data` の `ref` を `ow_users` に写す | ★**無し**。サーバー経路も要らない | ⚠️★**トリガーが例外を投げると `auth.users` の INSERT ごと失敗し、サインアップが止まる**（関数のコメントに明記）。**リスクが釣り合わない** |

→ ★**A を推す。** 「認証後に1回だけ走るクライアント側の共通処理」は現状これしかない。

⚠️ A でも **JS が動かない環境では記録されない**。それでよい（計測であって機能ではない）。

### 3-4. `/admin` の画面

`/admin/signup-refs`（新規）。1本のクエリで出せる。

| 列 | 定義 |
|---|---|
| `ref` | `signup_ref`（NULL は「直接・不明」としてまとめて1行） |
| 登録 | 実ユーザーの人数 |
| オンボーディング完了 | ＋ `ow_profiles.onboarding_completed` |
| 経歴あり | ＋ `ow_experiences` が1件以上 |
| **企業ページで見える** | ＋ **公開企業の経歴**があり、`visibility <> 'private'` |

```sql
with u as (
  select ou.id, ou.auth_id, ou.signup_ref, ou.visibility
  from ow_users ou
  where coalesce(ou.is_test,false)=false and coalesce(ou.is_system,false)=false
    and ou.auth_id is not null            -- ★本人が登録した行だけ（lib/users/registered.ts と同じ軸）
)
select coalesce(u.signup_ref, '(直接・不明)') as ref,
  count(*) as registered,
  count(*) filter (where p.onboarding_completed) as onboarded,
  count(*) filter (where exists (select 1 from ow_experiences e where e.user_id = u.id)) as has_experience,
  count(*) filter (where u.visibility <> 'private' and exists (
    select 1 from ow_experiences e join ow_companies c on c.id = e.company_id
     where e.user_id = u.id and c.is_published)) as visible_on_company_page
from u left join ow_profiles p on p.user_id = u.auth_id
group by 1 order by registered desc, ref;
```

⚠️★**「企業ページで見える」の条件を画面側に書き写さないこと。** 実体は
   `getCompanyEmployees` の `isSeedRow` と `is_published`。**ずれると数字が嘘になる。**
   可能なら `lib/users/registered.ts` のように**判定を関数に出す**。

⚠️★**画面に運用の注意を出す**（要件）。文面案:

> ref には個人を特定できる文字列を入れないでください（氏名・メールアドレス・社員番号など）。
> 声かけの「まとまり」を表す名前だけにしてください（例: `sf-alumni-0916`）。

⚠️ この注意は**コードでは守れない**（自由文字列なので）。**文言を消さないこと。**
   ⚠️ 形式の制約（小文字英数）は**メールアドレスを弾かない**（`@` と `.` は弾くが、
      ローカル部だけなら通る）。**運用で守るしかない。**

---

## 4. 運用（柴さんがやること）

1. 声かけの単位ごとに ref を決める。例: `sf-alumni-0916` / `ctc-current-0920`
   ⚠️ **人単位にしない。** まとまり単位にする（個人特定を避ける）
2. URL を作る: `https://opinio.jp/?ref=sf-alumni-0916`
   ⚠️ どのパスでもよい（`/companies/salesforce?ref=...` も可）
3. `/admin/signup-refs` で4つの数字を見る

⚠️ **cookie は30日で切れる。** 声かけから登録まで1か月以上空いた人は「直接・不明」に落ちる。
⚠️ **同じ人が2回来たら、最初の ref が残る**（上書きしない）。

---

## 5. 実装の規模（目安）

| 何を | 触るもの |
|---|---|
| migration 1本 | 列追加 ＋ CHECK ＋ 部分インデックス ＋ COMMENT。★**GRANT は書かない**（意図） |
| `src/middleware.ts` | `?ref=` → cookie（形式検証つき） |
| `src/lib/constants/signupRef.ts`（新規） | 正規表現・最大長・cookie 名を1箇所に |
| `POST /api/jobseeker/signup-ref`（新規） | 上の3-3 |
| `OnboardingGuard` | 1回だけ呼ぶ（案A） |
| `/admin/signup-refs`（新規） | 上のクエリ＋注意書き |
| `npm run gen:types` | 列を足したので |

⚠️★**cookie 名・正規表現・最大長を3箇所に書き写さないこと。** 定数1箇所にする
   （CLAUDE.md「濃度の制約は2層でも、定数は1つ」と同じ理由）。

---

## 6. 判断が必要な点

1. ★**呼び出し元を A（`OnboardingGuard`）にしてよいか。** 役目が1つ増える。
   B は取りこぼす、C はサインアップを止めうる。
2. ★**cookie の有効期間 30日でよいか。**
3. ★**`signup_ref` という列名でよいか**（`ow_companies.source` と混同しないため `source` は避けた）。
4. **NULL（直接・不明）をどう読むか。** いま登録がほぼ無いので、しばらくは**ほぼ全員が NULL**。
   ⚠️ **「0件」を「効果が無かった」と読まないこと**（CLAUDE.md「起きなかった0か、起こせなかった0か」）。
5. **既存9人には遡って入れない**（推測値の投入になる）。NULL のままにする。

---

## 付録: 調査で見つかった別件（★この設計とは独立。実装していない）

### ★`ow_users` を作っているのは DB トリガーで、そこに `split_part(email,'@',1)` が残っている

`handle_new_ow_user()` は表示名をこう決めている。

```sql
COALESCE(
  NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
  NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
  split_part(NEW.email, '@', 1)        -- ★ここ
)
```

⚠️★**CLAUDE.md は「`email.split("@")[0]` を入れる経路は 2026-09-14 に塞いだ」と書いているが、
   塞いだのはアプリ側（`linkOwUser.ts` と `/auth` の signUp）だけで、トリガーは塞がれていない。**
   `raw_user_meta_data` に名前が無い経路（マジックリンク・招待）では**いまも入る。**

実測（2026-09-16）: `name = split_part(email,'@',1)` の行は **1件のみ**（`is_test`・2026-06-28）。
実ユーザーは **0人**。登録フォームが名前を必須にしたので主経路では起きない。

### ★`linkOwUser.ts` の INSERT は `visibility: "public"` を書くが、ほぼ到達しない

トリガーが先に行を作るので、通常は `"existing"` が返る。
実測: 2026-08-03（この行が入った日）以降に作られた **23人全員が `login_only`**（＝列の既定値）。

⚠️★**到達したら、その人は `public`（氏名・職歴が未ログインと検索エンジンに見える）で始まる。**
   設定画面は `login_only` を既定として説明している。**食い違っている。**
   ⚠️ いま実害は無いが、**トリガーを消した日に静かに発火する。**

→ どちらも **docs/todo.md に回すべき実装課題**。★この設計案の前提条件ではない。
