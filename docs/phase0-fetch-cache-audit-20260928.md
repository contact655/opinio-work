# 棚卸し: supabase-js の fetch キャッシュで「DB に行かずに古い値を返す」箇所

**実測日: 2026-09-28**（本番 opinio.jp に対する GET と、本番 Supabase の edge_logs。
**コード・DB は変更していない**。cron 2本の修正は別途・承認済みで、本書は**その後の読み取り調査**）

きっかけ: [rebuild-transitions が9日間 200 を返しながら何もしていなかった件](#付録-経緯)。

---

## 1. 結論（4行）

1. ★**危険なのは「`cookies()` にも `searchParams` にも触らない GET ルート」だけ。** 実測で確定した。
2. ★**該当は5本しかない。** うち **`/api/industries` は現に壊れている**（6回叩いて DB 読み取り **0件**）。
   残り4本は cron で、2本は今日修正済み、2本は**停止中**。
3. ★**認証つきのルートと `/admin` のページは安全。** セッションクライアント（`cookies()`）を通るので
   Next が dynamic 扱いにし、キャッシュ層に載らない。**46本の GET のうち42本がこれ。**
4. ★**知識は既に2箇所に書かれていたのに防げなかった**（`noStore.ts` と `nextjs-caching` スキル）。
   **文章では止まらない。機械的な検査が要る**（§5）。

---

## 2. ★実測して分かった規則

Next 14.2.35 の [patch-fetch.js:314-322](../node_modules/next/dist/server/lib/patch-fetch.js) が
`autoNoCache = (hasUnCacheableHeader || isUnCacheableMethod) && staticGenerationStore.revalidate === 0`
で判定している。**`revalidate === 0` になるのは「リクエスト依存の API に触ったとき」**で、
`export const dynamic = "force-dynamic"` **だけでは 0 にならない**（下の実測がその証拠）。

| 条件 | キャッシュされるか |
|---|---|
| `cookies()` に触る（セッションクライアント `@/lib/supabase/server`／`viewerIsAdmin`／`getTenantContext`） | ✅ **されない**（安全） |
| `searchParams` を読む | ✅ **されない**（安全） |
| ★**どちらにも触らない**（`createAdminClient` / `createPublicClient` / 素の `createClient(url,key)` だけ） | ❌ ★**される** |
| `createNoStoreAdminClient()` を使う | ✅ **されない**（クライアント側で `cache:"no-store"`） |

⚠️★**`export const dynamic = "force-dynamic"` は対策にならない。** 5本すべてに付いていた。

---

## 3. 実測表（本番で叩いて、Supabase の edge_logs を数えた）

| ルート | クライアント | 触るもの | 叩いた回数 | ★DB 読み取り | 判定 |
|---|---|---|---|---|---|
| **`/api/industries`** | `createAdminClient` | ★**なし** | **6** | ★**0** | ❌ **キャッシュされている** |
| `/api/languages` | セッション | `cookies()` | 6 | **6** | ✅ 毎回 DB |
| `/api/skills` | セッション | `cookies()` | 6 | **6** | ✅ 毎回 DB |
| `/api/companies/batch` | public + admin | ★`searchParams` | 4 | **4巡**（各巡 ow_companies / ow_jobs / ow_company_admins） | ✅ 毎回 DB |
| `/api/cron/rebuild-transitions`（修正前） | 素の `createClient` | ★**なし** | **10**（9/19〜9/28 の定時） | ★**1**（初回のみ） | ❌ **9日間再生** |

⚠️ 陽性対照: 同じ問い方で `/rest/v1/ow_languages` `/rest/v1/ow_skills` `/rest/v1/ow_companies` が
   **叩いた回数ぶんちょうど**記録された。**「0件」は検出漏れではない。**
⚠️ ログ配信は当日分まで生きていることを確認済み（最新 12:11 台のリクエストが記録されている）。

---

## 4. 棚卸しと影響の分類

### 4-1. ★該当する5本（＝「どちらにも触らない GET」）

| # | 場所 | 影響 | 分類 | 状態 |
|---|---|---|---|---|
| ① | **`/api/industries`** | ★**利用者に誤った情報が出る。** 業種の選択肢が古いまま固定される。運営が小分類を足しても**画面に出ない**。⚠️ 2026-09-20 に「53行あるのに22行を返す」で**一度踏んでいる**（そのとき `force-dynamic` を入れて直したつもりになっていた） | ★**利用者に誤った情報** | ❌ **未修正** |
| ② | `/api/cron/rebuild-transitions` | 集計用の導出表が古いまま。⚠️ 製品の画面はこの表を読まないので**利用者への影響なし**。SQL で見るときの鮮度と、**撤回時に職歴を消しても消えない**点に効く | 通知・集計が止まる | ✅ **今日修正** |
| ③ | `/api/cron/check-test-leftovers` | ★**通知が永久に止まる。** 0件のときメールを送らない設計なので、**キャッシュされた0件を再生し続けると、取り残しが出ても誰も気づけない**（CLAUDE.md「壊れているのに正常に見える」） | ★**通知が止まる** | ✅ **今日修正** |
| ④ | `/api/cron/weekly-jobs` | 同じ形。⚠️ ただし **`crons` に無い ＋ `WEEKLY_EMAIL_ENABLED` 未設定**の二重で停止中 | 実害なし（停止中） | ⏸ 停止中 |
| ⑤ | `/api/cron/weekly-match` | 同上 | 実害なし（停止中） | ⏸ 停止中 |

⚠️★**④⑤ は今は無害だが、再開する日に②③と同じ形で踏む。** 再開の手順
（`docs/scout-runbook.md` / CLAUDE.md「週次メールは停止中」）に**この1行を足すべき**。

### 4-2. 安全だと確認したもの

| 対象 | 件数 | なぜ安全か |
|---|---|---|
| GET ルートハンドラ（上記5本を除く） | **42本** | セッションクライアント（`cookies()`）か `searchParams` を通る。`/api/languages` `/api/skills` `/api/companies/batch` で**実測**した |
| `/admin/*` のページ（Server Component） | 8本 | `admin/layout.tsx:100` がセッションクライアントを使う → リクエスト全体が dynamic |
| `/dev/preview/job-cards` | 1本 | `devOnly()` で**本番は 404** |
| 公開ページ（`/companies` `/jobs` など） | — | `unstable_cache` の**意図した鮮度契約**。今回の層とは別で、CLAUDE.md の「キャッシュは3層」の3層目 |
| Server Action（`actions.ts` 群） | — | POST なので `isUnCacheableMethod`。加えて `viewerIsAdmin()` を通る |

⚠️★**42本を「安全」と書いたのは、規則（§2）と3本の実測からの推論です。** 全42本を個別に
   叩いたわけではありません（認証が要るため）。**未確認**として §7 に残します。

### 4-3. ⚠️ 調査中に見つけた別件（今回の対象外・修正していない）

**`/admin` 配下の8ページに、ページ本体の運営権限チェック（`viewerIsAdmin()`）が無い。**
`admin/applications` / `company-join-requests` / `jobs/[id]` / `meetings` / `member-reports` /
`plans` / `schools` / `scout-quotas`。

CLAUDE.md は「★★運営権限をページ本体でも確かめる（2026-09-18）。**消さないこと。**
レイアウトのガードだけでは、ページが実行されて props が RSC フライトデータとして
HTML に載り、権限の無い人に読まれる」と書いており、`/admin/placements` はそれに従っている。
**この8ページは従っていない。** ⚠️ **今回の調査の範囲外なので触っていません。別途の判断を。**

---

## 5. 再発防止

### 5-1. 知識はすでに2箇所にあった（だから文章では足りない）

| 場所 | 記述 |
|---|---|
| [lib/supabase/noStore.ts:11](../src/lib/supabase/noStore.ts) | 「⚠️ ルートに `export const dynamic = "force-dynamic"` を書いてもこの層は止まらない」（2026-08-06 の前例つき） |
| [.claude/skills/nextjs-caching/SKILL.md:53](../.claude/skills/nextjs-caching/SKILL.md) | 「`force-dynamic` でも `revalidate = 0` でも止まらない」／ 61行「即時反映が要る読み取りは `createNoStoreAdminClient()` を使う」 |
| **CLAUDE.md:114** | 「キャッシュは3層ある（…supabase-js の fetch キャッシュ…）」**だけ。★「`force-dynamic` では止まらない」が無い** |

⚠️★**2箇所に書いてあっても、cron 2本は素の `createClient` で書かれた。**
   しかも `/api/industries` は **2026-09-20 に一度踏んで `force-dynamic` で直したつもりになっている。**
   → **注意書きを3箇所目に増やすのではなく、機械で検出する。**

### 5-2. ★検出スクリプトの案（`scripts/check-fetch-cache.mjs`）

既存の `check-columns.mjs` / `check-embeds.mjs` と**同じ作り**にする（CLAUDE.md の作法）。

```
node scripts/check-fetch-cache.mjs --self-test   # ★先にこれ
node scripts/check-fetch-cache.mjs
```

| | |
|---|---|
| 判定 | `export async function GET` を持つ `route.ts` のうち、**①** 非セッションのクライアント（`createAdminClient` / `createPublicClient` / `createClient(url,` ）を使い、**②** `cookies()` / `searchParams` / `headers()` / セッションクライアント / `getTenantContext` / `viewerIsAdmin` のいずれにも触れず、**③** `createNoStoreAdminClient` でも `fetchCache = "force-no-store"` でもない → **報告** |
| ★自己テスト | **`git show HEAD~1:src/app/api/cron/rebuild-transitions/route.ts`**（修正前）を当てて**検出できること**を確かめる。通らないうちは「0件」を信じない |
| 対象外 | `dev/preview`（`devOnly()`）／ `export const fetchCache = "force-no-store"` のあるもの |

⚠️★**`force-dynamic` の有無を判定条件に入れないこと。** 5本すべてに付いていた。**無意味な条件を入れると通ってしまう。**

⚠️ **lint ルール（ESLint）にはしない**案を推します。理由は、判定に「同じリクエストで
   `cookies()` に触っているか」という**ファイル横断の情報**が要り（ヘルパー経由で触ることが多い）、
   ESLint の単一ファイル解析では表せないため。**スクリプトのほうが素直。**

### 5-3. CLAUDE.md に足すべき1行（案・まだ足していません）

CLAUDE.md:114 の「キャッシュは3層ある」の直後に、
**「⚠️★2層目（supabase-js の fetch キャッシュ）は `force-dynamic` では止まらない。
`cookies()` にも `searchParams` にも触らない GET ルートは黙ってキャッシュされる
（2026-09-18〜28 に cron が9日間動かなかった）。→ `createNoStoreAdminClient()`」**
を追記する。

---

## 6. 影響の大きさで並べた「次にやること」（提案・未実施）

| 優先 | 対象 | 理由 |
|---|---|---|
| **1** | ★**`/api/industries` を `createNoStoreAdminClient()` に** | **現に壊れている**（0/6）。業種を足しても画面に出ない。1行で直る |
| **2** | 検出スクリプト（§5-2） | 3度目を防ぐ。2箇所の注意書きでは止まらなかった |
| 3 | `weekly-jobs` / `weekly-match` | 停止中。**再開の手順書に1行足す**だけでも足りる |
| 4 | CLAUDE.md:114 への追記（§5-3） | — |
| 別件 | `/admin` 8ページの権限チェック（§4-3） | 今回の対象外。**別途の判断を** |

---

## 7. 未確認

| 項目 | 理由 |
|---|---|
| ★**42本の「安全」を個別に実測していない** | 認証が要るため。§2 の規則と3本の実測からの**推論**。⚠️ 規則が外れる例があれば結論が変わる |
| ★**POST（RPC）が具体的にどう再生されたか** | GET/HEAD のキャッシュは実測した。RPC は「リクエストがログに無いのに戻り値がハンドラのログに出ている」という**観測からの確定**で、統制された POST 実験はしていない |
| `staticGenerationStore.revalidate` が `force-dynamic` で 0 にならない理由 | Next 内部の実装。**実測では 0 になっていない**、まで |
| `/api/cron/check-test-leftovers` が実際にキャッシュ再生していたか | **同じ形**だが、修正前に実測する機会が無かった（0件が正常値なので応答からも判別できない）。**修正後は `checkedAt` / `durationMs` で見分けられる** |

---

## 付録: 経緯

| | |
|---|---|
| 2026-08-06 | `createAdminClient` の読み取りがキャッシュされる件を踏み、`createNoStoreAdminClient` を作る |
| 2026-09-18 | `rebuild-transitions` を追加（**素の `createClient`**）。初回の定時実行だけ成功 |
| 2026-09-19〜28 | 定時実行が**10回すべて 200 ＋ `10 → 10 行`**。★**DB では何も起きていない** |
| 2026-09-20 | `/api/industries` が「53行あるのに22行」を踏み、`force-dynamic` を追加（★**直っていなかった**） |
| 2026-09-28 | 原因特定・cron 2本を修正・本書の棚卸し |

---

## 付録2: 修正後の検証（2026-09-28 / 本番）

デプロイ: commit `47146c01`（`builtAt 2026-09-28T14:28:57Z`）。**ビルドは成功**。

### rebuild-transitions（手動1回・14:30:08 UTC）

```json
{"ok":true,"before":10,"after":10,"builtAt":"2026-09-28T14:30:08.490262+00:00","durationMs":593}
```

| 確認項目 | 前 | 後 | 判定 |
|---|---|---|---|
| `built_at` | 2026-09-18 18:00:27.674353 | ★**2026-09-28 14:30:08.490262** | ✅ **10日ぶりに動いた**（応答の `builtAt` と DB が一致） |
| 行数 | 10 | 10 | ✅ 変化なし（想定どおり） |
| 内容ハッシュ | `30e2c57b4409d45f9cb4bae4d3e68a4a` | `30e2c57b4409d45f9cb4bae4d3e68a4a` | ✅ **一致＝冪等** |
| `durationMs` | — | **593ms** | ✅ 実際の往復（キャッシュ再生なら 0ms 近く） |

★**Supabase 側の記録**（`ow_transitions` 系が初めて残った。IP は Vercel）:

```
14:30:08.121  HEAD  /rest/v1/ow_transitions                 200   ← before の件数
14:30:08.462  POST  /rest/v1/rpc/rebuild_ow_transitions     200   ← ★RPC。これが9日間無かった
14:30:08.606  GET   /rest/v1/ow_transitions                 200   ← built_at の読み直し
```

### check-test-leftovers（手動1回・14:31:00 UTC）

```json
{"ok":true,"total":1,"failed":false,"notified":true,"checkedAt":"2026-09-28T14:30:59.985Z","durationMs":264}
```

| 確認項目 | 結果 |
|---|---|
| 件数 | **1**（SQL の実測と一致） |
| Supabase 側の記録 | ✅ `GET /rest/v1/ow_users` / `GET /rest/v1/ow_company_creations`（14:31:00） |
| `durationMs` | **264ms** |

★**初めての実アラート**: `contact+43@opinio.co.jp`（2026-09-27 21:41 作成・`is_test` 未設定）。
**取り残しの5回目**。⚠️ 倒すのは人が email を明示列挙した migration で行う（自動で倒さない）。

### /api/industries

| 確認項目 | 結果 |
|---|---|
| 件数 | API **51件** ＝ DB の `is_active = true` **51件**（全53行） ✅ |
| 5回叩いたときの DB 読み取り | ★**5件**（修正前は **0 / 6**） ✅ **毎回 DB へ行く** |

### ★翌日（2026-09-29 03:00 JST = 2026-09-28 18:00 UTC）に確認すること

**定時実行が自力で `built_at` を動かすか。** 手動実行は通ったが、
**9日間壊れていたのは定時実行**なので、そこが直ったかは別に確かめる。

```sql
-- 2026-09-28 18:00 UTC 台になっていれば直っている（14:30 のままなら定時実行がまだ動いていない）
select max(built_at) from ow_transitions;
```

| 見るもの | 期待 |
|---|---|
| `ow_transitions.built_at` | **2026-09-28 18:00:2x UTC** |
| Vercel Logs の応答 | `builtAt` が同じ時刻／`durationMs` が数百 ms |
| `check-test-leftovers`（21:00 UTC） | `contact+43` を倒していなければ `total:1` でメールが届く |

⚠️ `durationMs` が **0ms 近く**なら、キャッシュが別の経路で復活している。**そのときは再調査。**
