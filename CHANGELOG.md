# Changelog

## 2026-04-30 — Email Notifications (Commits AA/BB/CC/DD)

企業詳細ページ大幅拡充 + メール通知基盤整備。

- **Commit AA**: `/companies/[id]` 数値セクション（avg_salary/avg_age/paid_leave_rate/avg_overtime_hours/gender_ratio/funding_total）
- **Commit BB**: `/companies/[id]` テキスト・タグ系セクション（nearest_station/work_time_system/workstyle_description/benefits/evaluation_system）
- **Commit CC**: `/companies/[id]` 現役社員・OB 社員セクション（ow_experiences JOIN ow_users、メンターバッジ、/u/[id] リンク）
- **Commit DD**: メール通知基盤（`src/lib/notify/`）+ T3/T4/T5 通知実装。RESEND_API_KEY 未設定時は console.log mock

**合計: 76 commits · design docs 最新化**

| Hash | Commit |
|------|--------|
| `f58d3e4` | feat(companies/detail): AA — NumbersSection (6 columns) |
| `9bda883` | feat(companies/detail): BB — BenefitsSection + EvaluationText + WorkStyle text fields |
| `385bd50` | feat(companies/detail): CC — CurrentEmployeesSection + AlumniSection |
| — | feat(notify): DD — email notifications for meetings + mentor (T3/T4/T5) |

---

## 2026-04-28 / 2026-04-29 — Marathon Session

このセッションで Opinio Work は以下の状態に到達:

- **M-4 マルチテナント基盤完成** — 1ユーザー複数企業対応、招待フロー、CompanySwitcher
- **求職者プロダクト主要機能実装** — 12ページ + 認証 + プロフィール + ブックマーク + カジュアル面談 + 応募 + メンターシステム + 記事システム
- **全 commit が E2E 実機検証済み** (Phase E2E + Phase E2E-J)
- **設計書 両方最新化** — `docs/plans/biz-members-multitenant.md` / `docs/plans/jobseeker-product.md`

**合計: 73 commits · 7 migrations · 2 design docs · 8 E2E verification phases**

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

### Biz Application Management (1 commit + migration 049)

企業側 応募管理画面の新規実装。求職者が `POST /api/applications` から送信した応募を、企業担当者が閲覧・ステータス管理できる。

| Hash | Commit |
|------|--------|
| — | feat(biz): job application management for company admins (Commit X) |

**実装内容:**

- `supabase/migrations/049_ow_job_applications_company_rls.sql`:
  - `company_admins_read_applications` RLS (FOR SELECT): 自社求人への応募のみ閲覧可
  - `company_admins_update_applications` RLS (FOR UPDATE): 同上
  - `ow_job_applications_status_check` CHECK 制約: `status IN ('pending', 'reviewing', 'interview', 'accepted', 'rejected')`
- `src/lib/business/applications.ts`: `BizApplication` 型 + `fetchApplicationsForCompany` + `countByStatus`
- `src/app/biz/applications/page.tsx`: Server Component + getTenantContext auth guard
- `src/app/biz/applications/ApplicationsClient.tsx`: 2ペインレイアウト（一覧 + 詳細）、ステータスタブ、楽観的 UI 更新
- `src/app/api/biz/applications/[id]/route.ts`: PATCH ハンドラー（status 変更、getCompanyContext auth、0行チェック）
- `src/components/business/BusinessLayout.tsx`: サイドバーに「応募管理」リンク追加

**Phase S-X 検証 (全 PASS):**
- S-X-0: service_role で 3件テストデータ挿入（job: ee29c055, ccfd6c4e）
- S-X-1: /biz/applications → 200 + テスト太郎/花子/三郎 全表示確認
- S-X-2: 未認証 → 307 リダイレクト
- S-X-3: PATCH status=reviewing → 200 + DB 反映確認（pending→reviewing）
- S-X-4: 無効 status="hired" → 400 + エラーメッセージ返却
- S-X-5: 他社 application PATCH → 404（RLS が SELECT をブロック、存在自体を秘匿）
- S-X-6: 全 3 件表示確認（フィルタータブは client-side）
- S-X-7: /jobs /companies /articles /mentors /biz/dashboard → 全 200（回帰なし）
- S-X-8: クリーンアップ 4件削除、0件確認

**RLS 設計のポイント:**
- `ow_job_applications` には `company_id` カラムがないため、`ow_jobs!inner(company_id)` 経由でフィルタリング
- 他社の application は SELECT 自体がブロックされるため API は 404 を返す（403 より安全: 存在を漏らさない）

---

### Biz Casual Meetings Bug Fix (1 commit)

カジュアル面談管理画面 (`/biz/meetings`) の Critical Bug 修正。
ページ・API・fetcher は実装済みだったが `"scheduling"` ステータスが DB CHECK 制約と不整合だった。

| Hash | Commit |
|------|--------|
| — | fix(biz): casual meetings status validation + scheduling cleanup (Commit Y) |

**Critical Bug 詳細:**
- `mockMeetings.ts` の `MeetingStatus` 型に `"scheduling"` が含まれていた（`// TODO: mock-only` コメントあり）
- DB CHECK 制約 (migration 031): `pending / company_contacted / scheduled / completed / declined` の 5 値のみ
- `MeetingsClient.tsx` の `handleScheduleAdjust` が `.status("scheduling")` を送信 → DB CHECK VIOLATION（サイレントエラー）

**修正ファイル:**
- `src/lib/business/mockMeetings.ts`: `MeetingStatus` 型から `"scheduling"` 削除、`STATUS_TABS` 6→5タブ、`MOCK_MEETINGS` 3件を `"scheduled"` に変更
- `src/app/biz/meetings/MeetingsClient.tsx`: `handleScheduleAdjust` → `"scheduled"` に修正（1行）
- `src/app/api/biz/meetings/[id]/route.ts`: `VALID_MEETING_STATUSES` バリデーション追加 + `.maybeSingle()` 0行チェック追加（Commit W/X 教訓）
- `src/components/business/MeetingStatusBadge.tsx`: `"scheduling"` エントリ削除、型同期

**Phase S-Y 検証 (全 PASS):**
- S-Y-0: service_role で 3件テストデータ挿入（pending/company_contacted/scheduled）
- S-Y-1: /biz/meetings → 200 + 3件表示確認
- S-Y-2: 未認証 → 307
- S-Y-3: PATCH status=company_contacted → 200 + DB 反映確認
- S-Y-4a: 無効 status="invalid_status" → 400
- S-Y-4b: `"scheduling"` → 400（キーリグレッションテスト：DB VIOLATION を防止）
- S-Y-5: 他社 meeting PATCH → 404（RLS + 0行チェック）
- S-Y-7: memo/assign_to_me/mark_read 全 200 + DB 反映（company_internal_memo/assignee_user_id/company_read_at）
- S-Y-8: / /jobs /companies /mentors /articles /biz/dashboard /biz/jobs /biz/applications → 全 200
- S-Y-9: クリーンアップ 4件削除、0件確認

---

### Company Employee Sections (1 commit)

企業詳細ページ（`/companies/[id]`）に「現役社員」「OB・OG社員」セクション追加。
`ow_experiences` テーブルと `ow_users` を JOIN し、visibility RLS で自動制御。
DB データゼロでも항목枠常時表示（AA/BB ポリシー継続）。

| Hash | Commit |
|------|--------|
| — | feat(jobseeker): current employees + alumni sections (Commit CC) |

**実装内容:**
- `src/lib/supabase/queries.ts`: `CompanyEmployee` 型 + `getCompanyEmployees(companyId)` 追加
  - 現役社員: `ow_experiences` WHERE `is_current=true` JOIN `ow_users!inner`
  - OB社員: WHERE `is_current=false` AND `ended_at IS NOT NULL` ORDER BY `ended_at DESC`
  - anon = visibility='public' のみ（RLS 自動フィルター）
  - `avatar_color` hex → `linear-gradient(135deg, ...)` 変換
- `src/app/(jobseeker)/companies/[id]/page.tsx`:
  - `EmployeeCard` コンポーネント（avatar circle / name / roleTitle / mentor badge / endedAt / CSS hover）
  - `CurrentEmployeesSection`（0件: "公開準備中 — Opinio で取材した社員プロフィールが順次公開されます"）
  - `AlumniSection`（0件: "OB・OG情報は順次更新されます"）
  - `Promise.all` に `getCompanyEmployees()` 追加
  - BenefitsSection と JobsSection の間に挿入

**設計決定:**
- Event handler（`onMouseEnter`/`onMouseLeave`）は Server Component では使用不可 → `className="employee-card-link"` + `<style>` CSS hover に変更（実装中に発見）
- CompanyDetail 型への追加なし — photos/recruiters/articles と同じ別フェッチパターン
- `role_category_id NOT NULL` 制約あり → テスト INSERT に `role_category_id` 必須と判明

**Phase S-CC 検証 (全 PASS):**
- S-CC-1: 全 15 社（0件状態）で両セクション・空状態テキスト表示
- S-CC-2: Ubie に現役社員 INSERT → 「柴久人 / CEO / Co-founder」カード表示
- S-CC-3: SmartHR に OB 社員 INSERT → 「柴久人 / シニアエンジニア / 退職: 2019-12」表示
- S-CC-4: visibility='private' → RLS で非表示、空状態「公開準備中」に戻る
- S-CC-5: is_mentor=true → 「メンター」バッジ（purple-soft）表示
- S-CC-6: 全テストデータ削除（ow_experiences 0件、is_mentor=false 復元）
- S-CC-7: 既存 8 セクション全保持（企業/Opinio/数値/働き方/福利厚生/現役/OB/求人）
- S-CC-8: / /companies /jobs /mentors /articles → 全 200

---

### Company Benefits Section (1 commit + 1 new client component)

企業詳細ページ（`/companies/[id]`）に 5 つのテキスト・タグ系フィールドを追加。
Commit AA「항목枠常時表示」ポリシーを継続適用。全 5 フィールドが `/biz/company` 編集 UI と対応。

| Hash | Commit |
|------|--------|
| — | feat(jobseeker): BenefitsSection + WorkStyleSection extensions (Commit BB) |

**実装内容:**
- `src/lib/supabase/queries.ts`: `COMPANY_DETAIL_COLS` に 5 カラム追加（`nearest_station`, `work_time_system`, `workstyle_description`, `benefits`, `evaluation_system`）+ `buildCompanyDetail()` に 5 フィールドマッピング追加
- `src/app/companies/[id]/mockDetailData.ts`: `CompanyDetail` 型に 5 フィールド追加 + LAYERX / SMARTHR / `makeDetail()` の 3 箇所に null 初期値追加
- `src/app/(jobseeker)/companies/[id]/EvaluationText.tsx`: 新規「use client」コンポーネント（THRESHOLD=180 chars で line-clamp-3 + 「続きを読む」展開）
- `src/app/(jobseeker)/companies/[id]/page.tsx`:
  - sidebar Company Info に「最寄り駅」行追加（`isUnset` フラグで灰色「未設定」表示）
  - `WorkStyleSection` に `work_time_system` pill 追加（null は灰枠「勤務時間制度: 未設定」）
  - `WorkStyleSection` に `workstyle_description` テキストブロック追加（null は「未設定」）
  - `BenefitsSection` 新規コンポーネント（`benefits` タグ pill + `evaluationSystem` text）
  - `BenefitsSection` を WorkStyleSection と JobsSection の間に挿入

**設計決定:**
- **항목枠常時表示** (Commit AA と同ポリシー) — データ入力を促す設計
- `benefits` 空: pill なし、「(まだ登録されていません)」テキスト — 空 pill 表示は避ける
- `evaluation_system` 長文: `EvaluationText` で line-clamp-3 + 展開ボタン（>180 chars の場合）
- `nearest_station`: sidebar の `所在地` 直下に追加。`isUnset` フラグで既存 filter を回避

**Phase S-BB 検証 (全 PASS):**
- S-BB-1: 複数社ページ 200 レスポンス（全フィールド null 状態）
- S-BB-2: sidebar「最寄り駅」行が常時表示、null → 灰色「未設定」
- S-BB-3: WorkStyleSection に「勤務時間制度: 未設定」pill + Working Style Note ブロック
- S-BB-4: BenefitsSection「福利厚生・評価制度」見出し + 「まだ登録されていません」表示
- S-BB-5: Ubie 社にテストデータ投入 → 全項目入力済み表示（JR渋谷駅 / フレックスタイム制 / タグ一覧 / 評価制度テキスト）
- S-BB-5b: 長文テキスト（196 chars > 180）→ 「続きを読む」ボタン表示
- S-BB-6: テストデータ全 NULL 復元確認
- S-BB-7: 既存 6 セクション（企業について / Opinio 観点 / 数値で見る企業 / 働き方 / 求人 / 採用担当者）影響なし
- S-BB-8: / /companies /jobs /mentors /articles → 全 200 回帰

---

### Company Numbers Section (1 commit)

企業詳細ページ（`/companies/[id]`）に「数値で見る企業」セクションを追加。
平均年収・平均年齢・有給取得率・月間残業時間・男女比・累計調達額の 6 項目を常時表示。

| Hash | Commit |
|------|--------|
| — | feat(jobseeker): NumbersSection on company detail (Commit AA) |

**実装内容:**
- `src/lib/supabase/queries.ts`: `COMPANY_DETAIL_COLS` に 6 カラム追加（`avg_salary`, `avg_age`, `paid_leave_rate`, `avg_overtime_hours`, `gender_ratio`, `funding_total`）+ `buildCompanyNumbers()` 追加
- `src/app/companies/[id]/mockDetailData.ts`: `CompanyNumbers` 型（export）追加 + `CompanyDetail` に `numbers` フィールド追加 + LAYERX / SMARTHR / `makeDetail()` の 3 箇所に初期値追加
- `src/app/(jobseeker)/companies/[id]/page.tsx`: `NUMBER_ITEMS` 定数 + `NumbersSection` コンポーネント（~100 行）実装 + `<NumbersSection numbers={detail.numbers} />` を OpinionSection と WorkStyleSection の間に挿入

**設計決定:**
- **항목枠は常に 6 枠表示**（graceful hide なし）— データなしでも枠を見せることで「Opinio がどの情報を持てるか」を明示
- **未設定は薄字「未設定」**（`color: var(--ink-mute)`, `font-size: 0.75rem`）— 値あり項目と視覚的に区別
- `avg_salary` / `funding_total` は Opinio 編集部管理フィールド（migration 006 seed 済み、biz 編集 UI なし → §6-X+5 参照）

**Phase S-AA 検証 (全 PASS):**
- S-AA-1: `/companies/{layerx-uuid}` でセクション表示（平均年収 780〜900万円 等が表示）
- S-AA-2: 未設定項目に「未設定」グレー表示
- S-AA-3: 常に 6 枠表示（セクション非表示にならない）
- S-AA-4: `tsc --noEmit` エラーなし
- S-AA-5: 既存 6 セクション（AboutSection / OpinionSection / ArticlesSection / WorkStyleSection / JobsSection / RecruitersSection）影響なし
- S-AA-6: `/jobs`, `/mentors`, `/articles` 全ページ 200 回帰

---

### Company Articles Section (1 commit)

企業詳細ページ（`/companies/[id]`）に「この企業の記事」セクションを追加。
`ow_articles.company_id` NULL データギャップの発見と backfill も含む。

| Hash | Commit |
|------|--------|
| — | feat(jobseeker): company-related articles section (Commit Z) |

**実装内容:**
- `ow_articles` seed data (migration 046): 全 10 件の `company_id` が NULL だった → 8 社分 UUID backfill（service_role PATCH）
- `src/lib/supabase/queries.ts`: `getArticlesByCompany(companyId)` 追加
- `src/app/(jobseeker)/companies/[id]/page.tsx`: `Promise.all` に `getArticlesByCompany` 追加 + `CompanyArticlesSection` コンポーネント実装（コンパクトカードグリッド、タイプバッジ、3行 title クランプ、「記事一覧を見る」リンク）

**Phase S-Z 検証 (全 PASS):**
- S-Z-1: Ubie 企業ページに記事 1 件表示確認
- S-Z-2: 記事なし企業ではセクション非表示（graceful hide）
- S-Z-3: 既存 5 セクション（ミッション/写真/採用担当者/求人/働き方）影響なし
- S-Z-4: 記事タイトルリンク + 「記事一覧を見る」リンク正常動作
- S-Z-5: LayerX（2 件）全表示 + 全ページ 200 回帰確認

**発見した既知課題:**
- `ow_articles.company_slug` TEXT カラムが残存（旧 seed フィールド）。将来 `company_id` FK のみに統一するかを要検討（§9 M-5 に記録）

---

### Biz Jobs CRUD Bug Fix (1 commit)

biz 側求人管理の Critical Bug 修正。`fetchJobsForCompany` が migration 001/010 の旧カラムを参照していたため、
編集フォームでの保存内容が一覧に反映されない状態だった。

| Hash | Commit |
|------|--------|
| — | fix(biz): jobs page column reference + auth hardening (Commit W) |

**Critical Bug 詳細:**
- `description` (m001 TEXT) → `description_markdown` (m031 TEXT)
- `requirements` (m010 TEXT) → `required_skills` (m031 TEXT[])
- `selection_process` (m001 JSONB) → `selection_steps` (m031 TEXT[])
- `completionPercent` の計算も旧カラムベースだったため 0% 固定になっていた

**追加修正:**
- `POST /api/biz/jobs`: `getCompanyContext` による明示的 companyId 検証追加（RLS + アプリ層の二重防御）
- `BizJob` 型に `salaryNote?: string` フィールド追加（型の穴埋め）

**Phase S-W 検証 (全 PASS):**
- S-W-2: POST 新規作成 → `description_markdown`/`required_skills`/`selection_steps` DB 保存確認
- S-W-3: PUT 編集後、一覧 SELECT が新カラム値を返すことを確認（Critical Bug 解消証明）
- S-W-4: PATCH status=published → DB 反映確認
- S-W-5: sourceId 複製 → title「のコピー」/status=draft/新カラム引き継ぎ確認
- S-W-6: DELETE 2件 → DB 0件確認
- S-W-7a: 未認証 → 401
- S-W-7b: 他社 PUT → API ok:true / DB 変化なし（RLS ブロック確認）
- S-W-7c: 他社 companyId POST → 403 Forbidden（getCompanyContext が明示 reject）
- S-W-8: /jobs /companies /articles /mentors → 全 200
- S-W-9: クリーンアップ 0件（柴さん既存求人 2件のみ）

**補足 (Supabase RLS の UPDATE 挙動):**
PUT の RLS ブロック時、Supabase は error を返さず 0 rows affected で silent success になる。
`{"ok":true}` を返すが DB は変化しない。これは既知の Supabase 仕様（将来: `.select("id").single()` で 0行チェック推奨）。

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
| 10 | `fetchJobsForCompany` が migration 001/010 の旧カラム（`description`, `requirements`, `selection_process`）を参照。編集フォームは m031 の新カラム（`description_markdown`, `required_skills`, `selection_steps`）に保存するため、保存内容が一覧で消える Critical Bug | Commit W 調査 | — (Commit W で修正) |

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
| biz 求人 CRUD カラム不整合修正（Commit W） | — (Commit W) | Phase S-W ✅ |
| biz 応募管理（migration 049 + 2ペイン UI + PATCH API） | — (Commit X) | Phase S-X ✅ |
| biz カジュアル面談 "scheduling" バグ修正 | — (Commit Y) | Phase S-Y ✅ |
| `/companies/[id]` 関連記事セクション（`ow_articles.company_id` backfill 含む） | — (Commit Z) | Phase S-Z ✅ |

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
| — | `ow_articles.company_slug` 残存整理（`company_id` FK のみに統一 or `ow_companies.slug` 正式化） |
| — | `/companies/[id]` 現役社員 / OB 社員セクション（`ow_experiences` データ補充後） |
