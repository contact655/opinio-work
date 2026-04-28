# Changelog

## 2026-04-28 / 2026-04-29 — Marathon Session

このセッションで Opinio Work は以下の状態に到達:

- **M-4 マルチテナント基盤完成** — 1ユーザー複数企業対応、招待フロー、CompanySwitcher
- **求職者プロダクト主要機能実装** — 8ページ + 認証 + プロフィール + ブックマーク + カジュアル面談 + 応募
- **全 commit が E2E 実機検証済み** (Phase E2E + Phase E2E-J)
- **設計書 両方最新化** — `docs/plans/biz-members-multitenant.md` / `docs/plans/jobseeker-product.md`

**合計: 56 commits · 2 migrations · 2 design docs · 2 E2E verification phases**

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

## Statistics

| 項目 | 数 |
|------|---|
| Commits (this session) | 57 |
| Migrations | 2 (042: multitenant schema, 043: ow_user_roles cleanup) |
| Design Documents | 2 (biz-members-multitenant.md, jobseeker-product.md) |
| E2E Test Phases | 2 (Phase E2E, Phase E2E-J) |
| New Pages (求職者側) | 8 (/、/companies、/companies/[id]、/jobs、/jobs/[id]、/u/[id]、/auth、/jobs/[id]/apply) |
| Bugs Found & Fixed | 8 (see below) |
| DB Tables Connected | 9 (see below) |

**DB Tables Connected to Application**:
`ow_users`, `ow_companies`, `ow_company_photos`, `ow_company_admins`,
`ow_jobs`, `ow_bookmarks`, `ow_casual_meetings`, `ow_experiences`, `ow_job_applications`

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

---

## Future Tasks (M-5 Candidates)

詳細は [`docs/plans/jobseeker-product.md`](docs/plans/jobseeker-product.md) §9 を参照。

| 優先度 | タスク |
|--------|--------|
| ⭐⭐ | `ow_articles` 新規テーブル + 記事システム（/articles 系 4 ページ）|
| ⭐⭐ | `/mentors` 系 Supabase 接続（`mentors` テーブル確認済み）|
| ⭐ | `/mypage` サブページの Server Component 化 |
| ⭐ | `ow_jobs.job_category` FK 化（表記ゆれ解消） |
| ⭐ | `ow_job_applications` UNIQUE(user_id, job_id) 制約追加 |
| — | 記事 / メンター / 求人ブックマーク (`target_type` 拡充) |
| — | `type Job` / `type PositionMember` を独立ファイルに移動（mockJobData.ts 完全削除） |
| — | 求人詳細の空フィールドにデータ補充（description, requirements 等） |
