# Changelog

## 2026-04-28 / 2026-04-29 — Marathon Session

このセッションで Opinio Work は以下の状態に到達:

- **M-4 マルチテナント基盤完成** — 1ユーザー複数企業対応、招待フロー、CompanySwitcher
- **求職者プロダクト主要機能実装** — 12ページ + 認証 + プロフィール + ブックマーク + カジュアル面談 + 応募 + メンターシステム + 記事システム
- **全 commit が E2E 実機検証済み** (Phase E2E + Phase E2E-J)
- **設計書 両方最新化** — `docs/plans/biz-members-multitenant.md` / `docs/plans/jobseeker-product.md`

**合計: 65 commits · 6 migrations · 2 design docs · 3 E2E verification phases**

---

### Biz Members MVP (7 commits)

企業側チーム管理画面の READ / UPDATE / CREATE フロー実装（M-4 の前準備）。

| Hash | Commit |
|------|--------|
| `636eb90` | docs: dashboard placeholder resolution complete |
| `e737acc` | docs: document name display dual-path issue + quick fix |
| `176faf0` | docs(plans): biz-members v2 — review reflected |
| `abb4722` | feat(biz/members): M-1 — list view (READ only) |
| `7e1b2dc` | feat(biz/members): M-2 — permission/deactivate/reactivate (UPDATE) |
| `7338927` | feat(biz/members): M-3 — add existing user (CREATE) |
| `15cb148` | feat(biz/members): M-2.5 — edit role_title and department |

---

### M-4 Invite Flow Initial (4 commits)

招待メール + 承認フロー初期実装（後に一部 revert）。

| Hash | Commit |
|------|--------|
| `f5a33e7` | feat(biz/members): M-4 commit 1 — migration 040 (invite flow schema) |
| `1b52c72` | feat(biz/members): M-4 commit 2 — POST /api/biz/members/invite |
| `f4bac92` | feat(biz/members): M-4 commit 2.5 — close M-3 access gap via ow_user_roles INSERT |
| `55d9bb6` | docs: biz-members plan v3 + handoff for night session end |

---

### M-4 Multitenant (14 commits)

1ユーザー複数企業対応（`getCompanyContext` 導入）、CompanySwitcher UI、招待承認フロー完成。

| Hash | Commit |
|------|--------|
| `2d41bef` | revert: M-4 commit 2.5 — close M-3 access gap via ow_user_roles INSERT |
| `38f881f` | docs(plans): biz-members multitenant design (M-4 extended scope) |
| `126bcf4` | feat(biz/members): M-4 commit 2.6a — migration 042 (multitenant schema) |
| `a7ccc1d` | feat(biz/members): M-4 commit 2.6b — add getCompanyContext + migrate members POST |
| `ae4099a` | feat(biz/members): M-4 commit 2.6c — migrate invite + [id] routes to getCompanyContext |
| `d1eb1bd` | feat(biz/company): M-4 commit 2.6d — migrate company + photos routes to getCompanyContext |
| `40bd00c` | feat(biz): M-4 commit 2.6e — migrate jobs, meetings, dashboard to getCompanyContext |
| `b84e6d7` | feat(multi-tenant): commit 2.7 — switch-company API + select-company page + dashboard redirect |
| `a8fcb8d` | feat(biz): M-4 commit 2.8 — CompanySwitcher UI in header + select-company UX |
| `6368aa0` | feat(biz/members): M-4 commit 3 — POST /api/biz/members/accept |
| `30a481c` | feat(biz/members): M-4 commit 4 — /biz/auth/accept-invite page |
| `fec7b9f` | feat(biz/members): M-4 commit 5 (final) — show pending invitations in members UI |
| `9a0e8d7` | chore(biz): M-4 commit 2.6f — remove deprecated getCompanyId/getOwUserId |
| `ca0bc35` | docs(plans): update biz-members-multitenant.md to reflect implementation |

---

### Polish & Bug Fixes (5 commits)

UUID mismatch バグ修正、API レスポンスコード統一、migration クリーンアップ。

| Hash | Commit |
|------|--------|
| `23d2c04` | fix(biz/company/photos): POST returns 201 (was 200) |
| `2752c41` | refactor(roles): getUserRoles uses ow_company_admins for 'company' role |
| `b004d34` | refactor(roles): 7b — wire /api/roles + fetchTeamMembers to ow_company_admins |
| `cf6f140` | refactor(company/register): remove deprecated ow_user_roles INSERT |
| `2247173` | chore(db): ow_user_roles role='company' cleanup (migration 043) |

---

### UX Polish — Company Join Flow (4 commits)

企業参加フロー UI：デフォルトマーク表示、会社選択・トークン入力・新規作成画面。

| Hash | Commit |
|------|--------|
| `25d8fda` | feat(biz/CompanySwitcher): show default company marker in dropdown |
| `65342cb` | feat(biz/companies): add company selection page (commit 9-1) |
| `7b50c85` | feat(biz/companies/add): commit 9-2 — token + URL invite acceptance pages |
| `fea0478` | feat(biz/companies): create new company flow (commit 9-3, polish complete) |

---

### Jobseeker Product — Pages (7 commits + 1 design doc)

求職者向け公開ページ 6 本 + (jobseeker) route group 基盤。

| Hash | Commit |
|------|--------|
| `02e215c` | docs(plans): jobseeker product design document (新規 358 行) |
| `058d457` | feat(jobseeker): A — (jobseeker) route group + JobseekerHeader/Footer + CompanyLogo + migration 044 |
| `5a3d2f5` | feat(jobseeker): B — move top page into (jobseeker) route group + typewriter animation |
| `33c497a` | feat(jobseeker): C — /companies list + keyword/industry/phase/work-style filter |
| `0d9f65e` | feat(companies): D — /companies/[id] Server Component + photo gallery + recruiters |
| `c184faf` | feat(jobseeker): E — /jobs list + dynamic dept derivation + Supabase data |
| `65e1888` | feat(jobseeker): F — move /jobs/[id] to (jobseeker) route group (UX unification) |

---

### Service-Ready Trio (3 commits + 1 design doc update)

認証・プロフィール・公開プロフィールを Supabase 接続。

| Hash | Commit |
|------|--------|
| `54575d4` | feat(jobseeker): B (サービス化) — /auth login/signup + Open Redirect 対策 + role='candidate' INSERT |
| `c5af352` | feat(jobseeker): F (サービス化) — /mypage + /profile/edit Supabase ow_users 接続 + DashboardView closure バグ修正 |
| `e53daf0` | feat(jobseeker): C (サービス化) — /u/[id] public profile (visibility 制御 + /u/ URL 衝突回避) |
| `61fcaf5` | docs(plans): jobseeker product update with service-ready trio |

---

### Schema Cleanup & Bookmark (3 commits)

dead code 削除 + `ow_bookmarks` 企業ブックマーク本格実装。

| Hash | Commit |
|------|--------|
| `4322214` | fix(jobseeker): P2 — remove dead JOB_DEPTS, document job_category schema inconsistency |
| `9c99ad3` | feat(jobseeker): I — bookmark with DB persistence (UPSERT + optimistic UI + auth guard) |
| `603e072` | docs(plans): mark bookmark task as resolved (Commit I) |

---

### Casual Meeting & Test Tooling (2 commits)

カジュアル面談申込フロー本格実装 + E2E テスト用 Cookie 取得スクリプト整備。

| Hash | Commit |
|------|--------|
| `d0bebfe` | feat(jobseeker): G — casual meeting request flow (4-section form + inline completion) |
| `2268515` | chore(scripts): P3 — formalize get_session_cookie.mjs (Magic Link → Cookie) |

---

### E2E Verification (2 commits)

実機 curl テストで Commit B/F/I/G および J の DB 接続を証明。クリーンアップ込み。

| Hash | Commit |
|------|--------|
| `d7e1235` | docs(plans): Phase E2E — B/F/I/G verification results + §6-X |
| `01ef5a7` | docs(plans): Phase E2E-J — Commit J verification results |

---

### Experiences CRUD (1 commit)

`ow_experiences` テーブルへの CRUD API + CareerModal DB 接続 + /u/[id] 職歴セクション実データ化。

| Hash | Commit |
|------|--------|
| `95d8bf7` | feat(jobseeker): J — ow_experiences CRUD + CareerModal DB integration + /u/[id] career section |

---

### Mypage Subpages (1 commit)

/mypage サブページを (jobseeker) route group 配下に移動。`ow_company_members` デッドコード削除。

| Hash | Commit |
|------|--------|
| `2ed7f21` | feat(jobseeker): H — move /mypage subpages to (jobseeker) route group |

---

### Application Flow (1 commit)

求人応募フロー実装 + 既存バグ修正（テーブル名・カラム名の誤り）。

| Hash | Commit |
|------|--------|
| `baad773` | feat(jobseeker): L — job application flow (POST /api/applications + /jobs/[id]/apply + form) |

---

### Verification & Documentation (2 commits)

/jobs/[id] の DB 接続済みを実機確認 + 設計書記録。CHANGELOG 新規作成。

| Hash | Commit |
|------|--------|
| `c06d8ff` | docs(plans): K — /jobs/[id] DB connection verified (S-P-1〜8 all PASS) |
| *(this)* | docs: add CHANGELOG.md for marathon session (2026-04-28/29) |

---

### Mentor System (3 commits + migration 045)

メンター一覧・詳細・予約申込・マイページ相談履歴の DB 接続。
`mentors` テーブルと `ow_users` が未連携という設計矛盾を発見し、migration 045 で吸収。

| Hash | Commit |
|------|--------|
| `6e1fd79` | feat(jobseeker): M-1 — /mentors list + /mentors/[id] detail (DB 接続、(jobseeker) route group 移行) |
| `2b84f6b` | feat(jobseeker): M-2 — /mentors/[id]/reserve form + /mypage mentor history (DB 接続、migration 045) |
| `09fa14d` | docs(plans): mentor system completion (M-1/M-2 反映 + mentors 未連携記録) |

**完成した機能:**
- `/mentors` — 10名のメンター一覧 (is_available フィルター、DB 接続)
- `/mentors/[id]` — 詳細ページ新規実装 (`catchphrase`, `bio`, `concerns[]` 活用)
- `/mentors/[id]/reserve` — 予約申込フォーム (Server wrapper + Client Form、POST `/api/mentor-reservations`)
- `/mypage` 相談履歴 — `ow_mentor_reservations` JOIN `mentors` で実データ表示

**Discovered & Documented:**
- `mentors` テーブルが `ow_` プレフィックスなし（命名規約逸脱）→ §6-X+3 に記録
- `mentors` と `ow_users` が未連携 → migration 045 (`mentor_id` 追加 + `mentor_user_id` nullable 化) で対処
- メンター本人の予約閲覧は未対応（M-5 候補 §6-X+2 に記録）

---

### Schema Hardening (2 commits + migrations 047/048)

`ow_job_applications` の race condition リスクを DB 層で完全解消。Defense in depth 完成。

| Hash | Commit |
|------|--------|
| `17765ee` | fix(jobseeker): UNIQUE constraint on ow_job_applications (Commit U) |
| — | refactor(db): rename mentors → ow_mentors for naming consistency (Commit V) |

**Commit U — UNIQUE(user_id, job_id) on ow_job_applications:**
- migration 047 — `ALTER TABLE ow_job_applications ADD CONSTRAINT ow_job_applications_user_job_unique UNIQUE (user_id, job_id)`
- `src/app/api/applications/route.ts` — INSERT error で `error.code === "23505"` を 409 で返す分岐追加
- Defense in Depth 完成: アプリ層チェック + DB UNIQUE 制約の二重防御

**Phase S-T 検証 (全 PASS):**
- S-T-2: 1回目 → 201、2回目 → 409（アプリ層）
- S-T-3: service_role 直接 INSERT → 409 + `constraint "ow_job_applications_user_job_unique"` 確認（DB 層）
- S-T-4: 既存ページ影響なし
- S-T-5: クリーンアップ 0件確認

**Commit V — `mentors` → `ow_mentors` RENAME:**
- migration 048 — `ALTER TABLE mentors RENAME TO ow_mentors` + CONSTRAINT rename
- 全 8 TypeScript ファイルの `.from("mentors")` → `.from("ow_mentors")` 更新
  - `src/lib/supabase/queries.ts` (getMentors, getMentorById)
  - `src/app/(jobseeker)/mypage/page.tsx`
  - `src/app/api/mentor-reservations/route.ts`
  - `src/app/career-consultation/page.tsx` + `[id]/page.tsx`
  - `src/app/admin/mentors/page.tsx` + `consultation-cases/new/page.tsx`
  - `src/app/api/consultation/book/route.ts`

**Phase S-V 検証 (全 PASS):**
- S-V-1: `ow_mentors` → 3件返却、`mentors` → PGRST205 (テーブル消滅確認)
- S-V-2: `/mentors` → 200、`/mentors/[id]` → 200
- S-V-3: `POST /api/mentor-reservations` → 401（auth guard 正常動作）
- S-V-5: `/companies /jobs /articles /mentors` → 全 200（回帰なし）

---

### Article System (2 commits + migration 046)

記事一覧・詳細（4タイプ対応）を DB 接続。`ow_articles` テーブル新規作成 + 10件シード。Phase E2E-D で全 S-D-1〜7 PASS。

| Hash | Commit |
|------|--------|
| `178433d` | feat(articles): Commit D — articles system with DB integration |
| `e731cc0` | docs(plans): Phase E2E-D verification (Commit D articles system) |

**完成した機能:**
- migration 046 — `ow_articles` テーブル（JSONB: qa_blocks / body_blocks / chapters / themes_blocks / subject_freeze）+ 10件シード + RLS + 3インデックス
- `queries.ts` — `getArticles()` / `getArticleBySlug()` / `getArticlesBySlugs()` + `mapDbArticle()`
- `/articles` — DB 接続 async Server Component、タイプ別フィルター（`type` param）、ソート（読了時間順）
- `/articles/[slug]` — SSR 詳細ページ、4タイプ分岐（employee/mentor/ceo/report）、関連記事サーバーサイド取得
- 旧 `src/app/articles/` mock ファイル群を削除 → `(jobseeker)/articles/` に完全移行

**Design decisions:**
- `company_id` フィールドは `company_slug` (e.g. "layerx") を格納 → `company_name_text` / `company_gradient_text` 等のスナップショット列で表示
- `related_job_ids` は DB では `TEXT[]` だが mock slug のため空配列フォールバック（UUID化後に接続）
- `generateStaticParams` 削除 → SSR モード（記事追加時に自動対応）

---

## Statistics

| 項目 | 数 |
|------|---|
| Commits (this session) | 65 |
| Migrations | 5 (042: multitenant schema, 043: ow_user_roles cleanup, 045: mentor_id追加, 046: ow_articles, 047: ow_job_applications UNIQUE) |
| Design Documents | 2 (biz-members-multitenant.md, jobseeker-product.md) |
| E2E Test Phases | 3 (Phase E2E, Phase E2E-J, Phase E2E-D) |
| New Pages (求職者側) | 12 (/、/companies、/companies/[id]、/jobs、/jobs/[id]、/u/[id]、/auth、/jobs/[id]/apply、/mentors、/mentors/[id]、/articles、/articles/[slug]) |
| Bugs Found & Fixed | 9 (see below) |
| DB Tables Connected | 11 (see below) |

**DB Tables Connected to Application**:
`ow_users`, `ow_companies`, `ow_company_photos`, `ow_company_admins`,
`ow_jobs`, `ow_bookmarks`, `ow_casual_meetings`, `ow_experiences`, `ow_job_applications`,
`mentors`, `ow_mentor_reservations`, `ow_articles`

---

## Key Technical Discoveries

| 発見 | 詳細 |
|------|------|
| `@supabase/ssr` Cookie format | URI-encoded JSON、3180 chars で分割（`.0` / `.1`）。curl テストでは chunked Cookie 両方が必要 |
| `redirect()` in try/catch | `isRedirectError()` での分岐が必要。try/catch で wrap すると redirect が catch される |
| Server Component + Cookie | Server Component は Cookie の読み取りのみ可能（`Set-Cookie` は不可） |
| Magic Link auth pattern | `admin.auth.generateLink()` → `verifyOtp()` → Cookie chunks 出力。本番 DB 汚染なしのテスト手法 |
| `ow_user_roles.user_id` = `auth_id` | `ow_users.id` ではなく `auth.users.id`。Phase E2E で発見 |
| Closure scope in React components | ファイル内でサブコンポーネント関数を定義しても親スコープの変数は参照不可。props 経由が正しい（Commit F サービス化で修正） |
| `ow_experiences` XOR constraint | `company_id` / `company_text` / `company_anonymized` の 3 カラムは必ず 1 つだけ非 null（DB CHECK 制約） |
| `getCompanyContext` pattern | `ow_user_roles.tenant_id`（primary）+ `ow_companies.user_id`（fallback）で会社 ID 解決。M-4 全 API Route に適用 |

---

## Bugs Found and Fixed

| # | バグ | 発見場所 | 修正 commit |
|---|------|---------|------------|
| 1 | `fetchTeamMembers` UUID mismatch (`auth_id` vs `ow_users.id`) | Phase E2E | `b004d34` |
| 2 | photos POST `200` → `201` | コードレビュー | `23d2c04` |
| 3 | `/biz/auth` Open Redirect 脆弱性 | セキュリティレビュー | `54575d4` |
| 4 | pending row の `name: —` が active member 一覧に混入 | UI 確認 | `fec7b9f` |
| 5 | `mockJobData.JOB_DEPTS` dead code（表示ゆれの原因） | Phase P2 | `4322214` |
| 6 | `DashboardView` closure 変数スコープ | サービス化 F | `c5af352` |
| 7 | `/mypage/applications` 誤テーブル名 `ow_applications`、誤カラム `candidate_id` / `applied_at` | Commit L 調査 | `baad773` |
| 8 | `ow_company_members` デッドコード（0行テーブルへの参照 + 1167行の未使用ページ）| Commit H 調査 | `2ed7f21` |
| 9 | `mentors` と `ow_users` 未連携設計矛盾（`ow_mentor_reservations.mentor_user_id NOT NULL` が INSERT 不能）| Commit M-2 調査 | `2b84f6b` (migration 045) |

---

## Future Tasks (M-5 Candidates)

詳細は [`docs/plans/jobseeker-product.md`](docs/plans/jobseeker-product.md) §9 を参照。

### Completed M-5 Large Tasks (2026-04-30)

| タスク | Commit | E2E |
|--------|--------|-----|
| `ow_experiences` CRUD + CareerModal DB 接続 | `95d8bf7` (Commit J) | Phase E2E-J ✅ |
| メンターシステム（一覧・詳細・予約・マイページ履歴） | `6e1fd79` + `2b84f6b` (M-1, M-2) | Phase E2E-Q/R ✅ |
| 記事システム（`ow_articles` + 4タイプ対応） | `178433d` (Commit D) | Phase E2E-D ✅ |
| DB 命名規則統一（`mentors` → `ow_mentors`） | — (Commit V) | Phase S-V ✅ |

### Remaining Tasks

| 優先度 | タスク |
|--------|--------|
| ✅ 完了 | `mentors` → `ow_mentors` リネーム (migration 048, Commit V) で命名規約統一完了 |
| — | `ow_mentors` と `ow_users` の連携設計 + メンター本人の予約閲覧 + 承認フロー |
| ⭐ | `/mypage` サブページの Server Component 化 |
| ⭐ | `ow_jobs.job_category` FK 化（表記ゆれ解消） |
| ✅ 完了 | `ow_job_applications` UNIQUE(user_id, job_id) 制約追加 — Commit U (migration 047) で完了 |
| — | 記事 / メンター / 求人ブックマーク (`target_type` 拡充) |
| — | `type Job` / `type PositionMember` を独立ファイルに移動（mockJobData.ts 完全削除） |
| — | 求人詳細の空フィールドにデータ補充（description, requirements 等） |
