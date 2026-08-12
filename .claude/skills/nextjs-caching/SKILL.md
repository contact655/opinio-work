---
name: nextjs-caching
description: DBを更新したのに画面に反映されない、revalidate が効かない、ビルドで項目が黙って消える — Next.js App Router のキャッシュ3層（静的レンダリング / supabase-js の fetch キャッシュ / unstable_cache）の判別と対処。ページの鮮度設定を変えるときにも参照する。
---

## ⚠️ ルートキャッシュと Supabase クライアントの判別軸（2026-08-03 確立）

**DBを更新したのに画面に反映されない場合、まずここを疑う。**

App Router は「動的関数を使っていないページ」を静的レンダリングして結果を固定する。
`fetch` ではなく supabase-js でデータを取る場合、Next は動的だと判断できないため、
**コードを変えるまで DB の更新が画面に反映されない。**

### 判別軸：`cookies()` を呼ぶかどうか

| クライアント | 実装 | 動的判定 | 静的化リスク |
|---|---|---|---|
| `createClient()`（`lib/supabase/server.ts`） | 内部で `cookies()` を呼ぶ | **自動的に動的** | なし |
| `createAdminClient()`（`lib/supabase/admin.ts`） | 素の supabase-js。Cookie を触らない | されない | **あり** |

`searchParams` を受け取るページ、`headers()` を使うページも自動的に動的になる。

### レイアウト単位の保護

| レイアウト | `cookies()` | 効果 |
|---|---|---|
| `admin/layout.tsx` | あり | **admin 配下は全ページ自動的に動的** |
| `biz/layout.tsx` | あり | **biz 配下は全ページ自動的に動的** |
| `(jobseeker)/layout.tsx` | **なし** | **各ページが自力で宣言する必要がある** |

### 原則

**`(jobseeker)` 配下で `createAdminClient`（および `lib/supabase/queries.ts` /
`lib/search/companies.ts` 経由）を使うページは、`revalidate` か `dynamic` の宣言が必須。**

`cookies()` も `searchParams` も使わないページで宣言を忘れると、
本番で「再デプロイするまで永久に古いデータを出し続ける」状態になる。

2026-08-03 の事例: LP（`(jobseeker)/page.tsx`）が唯一この穴に落ちていた。
migration で talk_themes を更新しても LP に反映されず、原因は静的レンダリングだった。
`export const revalidate = 300` を追加して解消。同日の全ルート監査では他に該当なし
（86ページ中、DB利用70ページ・GETルートハンドラ全件を確認）。

### ⚠️ もう1層ある：supabase-js の fetch キャッシュ（2026-08-06 追記）

**`force-dynamic` を書いても、supabase-js の読み取りは Next の fetch キャッシュに載る。**

supabase-js は内部で `fetch` を使う。Next はその `fetch` をパッチして結果を
メモリと `.next/cache/fetch-cache` に保存するため、
`createAdminClient()` / `createClient()` の SELECT が**黙ってキャッシュされる**。

上の「ルートキャッシュ」（静的レンダリング）とは**別の層**であり、
`export const dynamic = "force-dynamic"` でも `export const revalidate = 0` でも止まらない。

2026-08-06 の事例: 会社呼称（`ow_company_job_roles`）を論理削除しても
`deleted_at` が null のまま返り続けた。ルートは `force-dynamic` で、
dev サーバーを再起動して `.next/cache/fetch-cache` を消すまで直らなかった。

#### 対処

**即時反映が要る読み取りは `createNoStoreAdminClient()`（`lib/supabase/noStore.ts`）を使う。**
`global.fetch` で `cache: "no-store"` を強制する管理クライアント。

| 用途 | クライアント |
|---|---|
| 運営・企業の操作がすぐ画面に出てほしい読み取り（職種タグ・会社呼称） | `createNoStoreAdminClient()` |
| それ以外 | `createAdminClient()` |

⚠️ `unstable_cache`（`getJobs` は revalidate 300 / `jobs/[id]` は 60）は**別の層で、こちらは残す**。
意図した鮮度契約なので消さない。切りたいのは二重にかかっている fetch キャッシュだけ。

#### ⚠️ `unstable_cache` の中で no-store を使わない（2026-08-06 追記）

**`unstable_cache` の中で `cache: "no-store"` の fetch を呼ぶと、
静的プリレンダリング時に `DynamicServerError` になる。**

ビルド中にこう出る:

```
[fetchCompanyRoleMap] Error: Dynamic server usage: no-store fetch
  https://….supabase.co/rest/v1/ow_company_job_roles?select=… /jobs/dept/exec
```

⚠️ **ビルドは失敗しない。** supabase-js は例外を投げずに `{ error }` を返すので、
呼び出し側が握って空の結果を返し、**その項目だけ黙って消えた状態でページが生成される**。
2026-08-06 に `/jobs/dept/[slug]`（`generateStaticParams` あり）で実際に起き、
会社呼称が空のままプリレンダリングされていた。

原則:

- **`unstable_cache` の中は通常のクライアント**（`createAdminClient()`）を使う。
  鮮度は `unstable_cache` の `revalidate` と、更新側の `revalidatePath()` に任せる
- **no-store のクライアントは `unstable_cache` の外でだけ使う**
  （ルートハンドラ、Server Action、`force-dynamic` のページ）

⚠️ `generateStaticParams` を持つ動的ルートは全部プリレンダリング対象。
新しく付けるときは、そのページから no-store の読み取りに到達しないか確認すること。

⚠️ 症状は「DBを直したのに画面が古い」で上の静的化と同じ。
**切り分け方**: コードを変えずに dev を再起動して直れば fetch キャッシュ、
再デプロイしないと直らなければ静的レンダリング。

### ⚠️ `revalidate` を書いても効いているとは限らない（2026-08-09 確立）

**`export const revalidate = 60` は「宣言」でしかない。**
ページが動的関数（Cookie / `searchParams`）に触れていると、Next はそのルートを
**完全に動的**にし、宣言は**黙って無視される**。エラーも警告も出ない。

⚠️ **ページのファイルを読んだだけでは分からない。**
`queries.ts` の中で `createClient()`（Cookie を読む方）を使っている関数を
呼ぶだけで動的になる。2026-08-09 時点で `queries.ts` には5箇所ある
（`:572` `:587` `:976` `:1623` `:1789`）。
`/articles/[slug]` はページ側に認証も `searchParams` も無いのに動的で、
原因は `getArticlesBySlugs` の中の `createClient()` だった。

#### 確かめ方：宣言ではなく応答ヘッダを見る

```bash
curl -sS -o /dev/null -D - -L "https://opinio.jp/<ルート>" | grep -iE "cache-control|x-vercel-cache"
```

| 出力 | 意味 |
|---|---|
| `public, max-age=0, must-revalidate` ＋ `HIT`/`STALE`/`PRERENDER` | **効いている** |
| `private, no-cache, no-store` ＋ `MISS`（毎回） | **効いていない＝毎回レンダリング** |

⚠️ `?t=...` のようなキャッシュ避けを付けたまま測らないこと。常に MISS になる。

#### 実測（2026-08-09、本番）

| ルート | 宣言 | 実際 | 備考 |
|---|---|---|---|
| `/` | 300秒 | ✅ 効く | — |
| `/salary` `/salary/[slug]` | 3600秒 | ✅ 効く | — |
| `/articles/type/[slug]` | 3600秒 | ✅ 効く | — |
| `/jobs/dept/[slug]` | 60秒 | ✅ 効く | — |
| `/articles/[slug]` | 300秒 | ✅ 効く | 同日に修正。TTFB 0.392 → **0.173秒** |
| `/jobs/[id]` | 60秒 | ✅ 効く | 同日に修正。**0.069秒** |
| `/companies/[id]` | 60秒 | ✅ 効く | 同日に修正。0.367 → **0.076秒** |
| **`/articles`**(一覧) | 300秒 | ❌ **毎回動的** | `searchParams`（絞り込み機能。構造上避けられない） |

⚠️ **残る動的は `/articles`（一覧）だけ。** 絞り込み機能のため構造上避けられない。
新しくページを足すときは、上の2条件を満たしているか
**応答ヘッダで確かめてから**「効いている」と言うこと。

### ⚠️ 効かせるには2つ揃える必要がある

**① 動的関数に触れないこと**（Cookie / `searchParams`）

⚠️ **ページのファイルを読んだだけでは分からない。** `/articles/[slug]` は
ページ側に認証も `searchParams` も無いのに動的で、原因は
`getArticlesBySlugs` の中の `createClient()` だった。
`queries.ts` の Cookie を読む `createClient()` を呼ぶ関数は全部これになる。

**② `generateStaticParams` があること**

⚠️ **①だけでは足りない。** `/articles/[slug]` は Cookie 依存を外しても
`private, no-cache, no-store` のままだった。実測で、動的セグメントは
**`generateStaticParams` を持つものだけ**がキャッシュされていた。

```
あり … /salary/[slug]  /jobs/dept/[slug]  /articles/type/[slug]  → HIT / PRERENDER
なし … /articles/[slug]  /jobs/[id]  /companies/[id]            → 毎回 MISS
```

ビルド出力の記号でも判別できる。**`ƒ`（動的）なら効かない、`●`（SSG）なら効く。**

⚠️ **`generateStaticParams` を足すときは、そのページから no-store の読み取りに
到達しないか先に確認すること。** `/jobs/[id]` に足した直後のビルドで
`[getJobRoleMap] Error: Dynamic server usage: no-store fetch` が出た。
**ビルドは成功してしまい、職種だけが黙って消えたページが生成される。**
`getJobRoleMap` に `{ cached: true }` を足して公開ページ側だけ通常クライアントにした。

⚠️ そもそも**ページがキャッシュされるなら no-store に鮮度上の意味は無い。**
配信されるのはキャッシュ済みHTMLで、鮮度はページの `revalidate` が決める。

### ⚠️ 閲覧者依存の値をクライアントに出す前に測ること（2026-08-09 実測）

| 対象 | 中央値 |
|---|---|
| 存在しないURL（404。関数が動かない） | 0.065秒 |
| `/api/companies/search`（**認証なし** + DB問い合わせ） | **0.202秒** |
| `/api/bookmarks`（認証 + 1クエリ） | **0.298秒** |
| 認証 + 2クエリ | 0.585秒 |

つまり **API を1本呼ぶだけで 0.2秒前後**かかり、認証はそこに +0.1秒ほど乗る。

⚠️ **最初「認証なしは 0.067秒」と測って「認証だけが重い」と書いたが、誤りだった。**
   測っていた `/api/stats` は**既に削除されていて 404 を返していた**。
   404 はルーティングだけで返るので速い。**status を確認せず時間だけ測っていた。**
   実在する認証なしAPIで測り直したら 0.202秒で、差はずっと小さかった。

#### 判断の目安

⚠️ **「サーバーから外せば速くなる」は成り立たない。** ページの器は速くなるが、
その値が画面に出るのは**遅くなる**。2026-08-09 に `/companies/[id]` の
ブックマーク状態をクライアントに移したところ、ボタンの確定が
**DOM完了から +688ms** になり、ページは動的のままだったので
**純粋な悪化**になった（一度 revert し、ISR 化と同時に入れ直した）。

⚠️ 移してよいのは、**そのページがキャッシュされる場合だけ**。
器が 0.07秒で出るなら、0.2〜0.3秒後に中身が入っても全体としては速い。

### 現在の鮮度設定

⚠️ **この表は「宣言値」。実際に効いているかは上の表を見ること。**

| 間隔 | ルート |
|---|---|
| `force-dynamic` | `/jobs`(一覧) `/people` `/people/role/[slug]` `/schools/[id]` `/mypage/*` |
| 60秒 | `/companies/[id]` `/jobs/[id]` `/companies/[id]/casual-meeting` `/jobs/dept/[slug]` |
| 300秒 | `/`（LP） `/articles`(一覧) `/articles/[slug]` |
| 3600秒 | `/salary` `/salary/[slug]` `/articles/type/[slug]` |

掲載状態（`is_published` / 求人の `status`）が出るページは60秒以下にすること。
`/jobs/dept/[slug]` は当初3600秒だったが、求人を閉じた後も最大1時間流入し続けるため60秒に変更した。
`/salary` 系は集計ページで掲載状態を直接出さないため3600秒のままでよい。

⚠️ `/companies/[id]` は動的なので、`queries.ts` 側で企業単位の公開データを
`unstable_cache`（記事・ストーリー・アンバサダー60秒／ツール300秒）に載せている。
60秒はこの宣言値に合わせたもの。**企業がストーリーを公開しても最大60秒遅れる。**
`/biz/posts` の Server Action は `revalidatePath("/biz/posts")` しか呼ばないため。

---

