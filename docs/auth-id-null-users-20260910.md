# `auth_id IS NULL` のユーザーを表示対象から外した（2026-09-10）

## 何が起きていたか

`ow_users` に **`auth_id` が NULL の行が2件**あり、うち1件が
**ログイン中の利用者に氏名・職歴5件・所属3社ごと見えていた。**

| uid | 名前 | is_test / is_system | 経緯 |
|---|---|---|---|
| **`0c99e403`** | 生藤 弘樹 | false / false | **`supabase/migrations/archive/154_add_users_narifuji_komatsu.sql` が INSERT。** 冒頭に「**履歴書からプロフィールデータを作成**／メールアドレスは仮設定／招待は /admin > ユーザー招待」と明記。email は `hiroki.ikuto.placeholder@opinio.co.jp` |
| `00000000` | OPINIO | false / **true** | フィード投稿の主体。`is_system` かつ `visibility=private` なので元から表示対象外 |

⚠️ 同じ migration が作った **小松耕野は現存しない**（削除済み）。`placeholder` を含む email はこの1件だけ。
⚠️ migration では `visibility='public'` で作られたが、現在は `login_only`（後から変更されている）。

### なぜ従来の除外をすり抜けたか

`is_test = false` / `is_system = false` なので、**既存の除外条件はどれも当たらない。**
`visibility = 'login_only'` なので anon には出ないが、**ログインした利用者には出ていた。**

### 同意の状態 ── **記録なし**

`ow_terms_agreements` は全体で**2行しかなく、どちらも企業側**（`business` 1 / `listing` 1）。
**求職者側の同意記録は誰の分も存在しない。**
求職者の同意は「登録画面の包括同意の一文を通ること」＝**登録行為そのもの**で取っている。

⇒ **`0c99e403` は登録していない**（`auth_id` NULL / `last_sign_in_at` なし / `auth_linked_at` なし）ので、
**その暗黙の同意すら経ていない。**

---

## 採った対処 ── ルールとして入れる

**個別の行を `visibility='private'` にする1行の UPDATE は採らなかった。**
次に同じ経緯の行が生まれたときに効かないため（2026-08-19 に年齢で
「規約ではなく型で担保する」と決めたのと同じ考え方）。

**判定は [src/lib/users/registered.ts](../src/lib/users/registered.ts) の `isRegisteredUser()` 1本に定義**し、
**7箇所**から参照する。

| # | 場所 | 何に効くか |
|---|---|---|
| 1 | `lib/people/directory.ts` | `/people` の一覧 |
| 2 | `lib/search/companies.ts` | **`/companies` のカードの「現役社員 N名」** |
| 3 | `lib/supabase/queries.ts` `getCompaniesForList` | **`/feed` の企業一覧の人数** |
| 4 | `lib/supabase/queries.ts` `getJobPositionMembers` | 求人ページの経験者 |
| 5 | `lib/supabase/queries.ts` `getCompanyEmployees` | 現役社員 / OB・OG |
| 6 | `lib/supabase/queries.ts` 面談対応者 | 企業ページの「話を聞ける人」 |
| 7 | `app/(jobseeker)/u/[id]/page.tsx` | 公開プロフィール（**404 にする**） |

### ⚠️★当初「6箇所」と報告したのは誤りだった

`directory.ts` / `queries.ts` / `u/[id]` しか見ておらず、
**`lib/search/companies.ts`（`/companies` のカードの人数）を数え漏らしていた。**
`getCompaniesForList` を「企業カードの人数」と書いたのも誤りで、**あれは `/feed` 側**。
**`grep` の範囲を先に決めてしまうと数え漏らす**という、このリポジトリで繰り返している形。

### なぜ 2・3・4 も含めたか

- **2・3（人数カウント）**: 氏名が出なくても**人数は情報**。「この会社に◯名いる」は
  OPINIO が外向きに言う数字なので、登録していない人を数に入れない。
  揃えないと「一覧6名／カード7名」の食い違いが残る
- **4（求人の経験者）**: `visibility === 'public'` を要求しており**現状 no-op**。
  ⚠️★**no-op であることは足さない理由ではなく足す理由。**
  誰かが `public` を選んだ日に、気づかないまま出る

### ⚠️ 実装上の注意

- **`auth_id` を SELECT に含めること。** 落とすと `undefined` になり、
  `isRegisteredUser` が全員 false を返して**一覧が丸ごと空になる**。型では気づけない
  （DB 行は `Record<string, any>` で来る）
- **`?? true` のような既定値で埋めない。**「取得漏れ」を「登録済み」に化けさせることになる
- `auth_id` は **anon / authenticated とも SELECT できる**（2026-09-10 実測）。列単位 GRANT に弾かれない
- **`is_test` / `is_system` の除外は集約していない**（7箇所すべてインラインの式のまま）。
  今回は新しい条件だけを関数にした。**集約は別タスク**

---

## 実測（dev / 適用前後とも `.next` を消して cold キャッシュから測定）

⚠️★**`unstable_cache` を先に潰さないと測れない。** `/people` は `revalidate: 1800`、
社員一覧は `revalidate: 300`。最初の測定は**適用後の結果をキャッシュから読んでいた**ため
数字が食い違い、2回測り直した。

| 測ったもの | 適用前 | 適用後 |
|---|---|---|
| 社員API `salesforce` | 現役 **3** / OB 1 / 氏名 **あり** | 現役 **2** / OB 1 / 氏名 **なし** |
| 社員API `fujifilm-bi` | 現役 0 / OB **1** / 氏名 **あり** | 現役 0 / OB **0** / 氏名 なし（**セクションごと消える**） |
| 社員API `flyle` | 現役 0 / OB **1** / 氏名 **あり** | 現役 0 / OB **0** / 氏名 なし |
| `/people` の氏名 | **出る** | **出ない** |
| `/people` のカード数 | **8** | **7** |
| `/u/0c99e403` | **200** | **404** |

### 企業カードの人数（述語を SQL で再現）

⚠️ カードの数値は HTML から確実に拾えなかったので、`searchCompanies` の述語を
SQL で再現して比較した。**画面から読んだ値ではない。**

| slug | 現役 前→後 | OB 前→後 |
|---|---|---|
| `salesforce` | **3 → 2** | 1 → 1 |
| `fujifilm-bi` | 0 → 0 | **1 → 0** |
| `flyle` | 0 → 0 | **1 → 0** |

⚠️★**富士フイルムBI とフライルは「カードとして」は未目視。** 一覧のどのページにも
   カードとして出てこず（開示充実順の1頁目に無い）、`?q=` の検索結果は
   `.clc-stats` を描画しない形だった。**API と企業ページ本体では両社とも 0/0 を確認済み**
   なので実害は無いが、**カードの数値は画面で見ていない。**
   ⚠️ セールスフォースは画面で目視できた（`?view=list&sort=disclosure` の1件目。
      **現役社員 2名 / OB・OG 1名 / 募集中 2件**）。

### 変わらないことの確認

| | 結果 |
|---|---|
| `/biz/candidates` | **不変**。`0c99e403` は `ow_profiles` の行が**0件**で、母集合（`career_stance` 非NULL かつ ≠`no_contact`・11件）に入りようがない |
| 業界マッチ | **不変**。`fetchIndustryMatchBlocks(owUserId)` は**本人の職歴だけ**を見る（他人を数える集計ではない） |
| **`ow_users` への UPDATE** | **0件**。`auth_id` NULL の2行とも `updated_at` は 2026-07-22 / 2026-07-14 のまま、`visibility` も変えていない |

---

## 再発経路 ── src には無い

| 経路 | 結果 |
|---|---|
| `src` から `ow_users` に INSERT | **`lib/auth/linkOwUser.ts` の1つだけ**で、`auth_id` を必ず入れる |
| `/admin` のユーザー作成画面 | **無い**（`/admin/users` は一覧・詳細のみ） |

⇒ **`auth_id` NULL の行を作れるのは migration / 手動 SQL だけ。** アプリからは再発しない。

---

## ★ B（招待）の手順 ── **実行しない。順序だけ残す**

`lib/auth/linkOwUser.ts:68-87` に**引き継ぎ経路**がある。
メール確認済みの人が**同じアドレス**でログインすると、`auth_id IS NULL` の行を
**そのまま引き継いで** `auth_id` が入る（条件は `is_system=false` かつ `is_test=false`）。

**⇒ 正しい順序:**

1. **今回の除外を入れる**（本人が未登録の間は表示されない）← **完了**
2. **`ow_users.email` を placeholder から本物のアドレスに UPDATE** ← ★**未実施・指示待ち**
3. `/admin > ユーザー招待` で招待する
4. 本人が登録 → **email 一致で既存行に `auth_id` が入る**
   → 職歴5件・所属3社を**作り直さずにそのまま本人のものになる**
   → `auth_id` が入るので**表示にも自動的に戻る**

⚠️★**順序を間違えて先に招待すると、本人が別アドレスで登録して行が二重になる。**
   引き継ぎは **email の完全一致**が条件なので、2 を先にやらないと効かない。
⚠️ 2 の本物のアドレスは柴さんが確認する。**推測で入れない。**
⚠️ **placeholder のアドレスには送らない。**

### `/admin > ユーザー招待` は動く（コード経路の確認のみ）

| | |
|---|---|
| 画面 | `/admin/invite` |
| API | `POST /api/admin/invite` |
| 認可 | `supabase.rpc("auth_is_admin")` |
| 実体 | `adminSupabase.auth.admin.inviteUserByEmail()`（Supabase がメール送信）＋ `redirectTo` は `confirmRedirectTo()` |
| role | `candidate` / `biz` を選べる |

⚠️ **実送信のテストはしていない**（本番のメールが飛ぶため）。経路が生きていることの確認まで。

---

## やらなかったこと

- **レコードの削除**（`ow_users` を参照する FK 45列のうち29列が CASCADE。
  実在の職務経歴であり検証データではない）
- **`visibility` の書き換え**
- **placeholder メールへの送信**
- `is_test` / `is_system` の除外の集約（別タスク）
