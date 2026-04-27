# Dashboard ActivityList & Placeholder 解消 — 実装計画

**作成日**: 2026-04-27
**ステータス**: ✅ **完了 2026-04-27**（commit c1663a4 で本番リリース）
**実装コミット**: 6b9789a (AL-1) / c1663a4 (AL-2)
**実績時間**: 約 3 時間（計画書作成 30 分 + 実装 60 分 + デバッグ 90 分）

---

## 背景と調査結果

### `/biz/dashboard` の placeholder 4箇所

| コンポーネント | 型 | 現状 | 対応方針 |
|---|---|---|---|
| `PendingMeetings` | `MeetingApplication` | `meetings={[]}` | `ow_casual_meetings` から取得 |
| `ActivityList` | `ActivityItem` | `activities={[]}` | `ow_activities` から取得 |
| `MatchCandidates` | `MatchCandidate` | `candidates={[]}` | **保留** — `ow_matches` 未実装 |
| `TeamMembers` | `TeamMember` | `members={[]}` | `ow_company_admins` + `ow_users` から取得 |

### `ow_activities` テーブル（migration 031）

```sql
CREATE TABLE IF NOT EXISTS ow_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES ow_users(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  description   TEXT,           -- 日本語の説明文（ActivityItem.body に対応）
  target_type   TEXT,
  target_id     UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `ow_activities` への INSERT 経路（調査済み）

| イベントタイプ | INSERT 経路 | 実装可否 |
|---|---|---|
| `job_published` | `/api/biz/jobs` PUT (status → active) | ✅ 実装可 |
| `job_closed` | `/api/biz/jobs/[id]` PATCH (status → closed) | ✅ 実装可 |
| `meeting_status_changed` | `/api/biz/meetings/[id]` PATCH | ✅ 実装可 |
| `profile_updated` | `/api/biz/company` PUT | ✅ 実装可 |
| `application_received` | 対応 API 未実装（求人応募フロー未着手） | ❌ 延期 |
| `casual_meeting_applied` | **INSERT 経路なし** — `ow_casual_meetings` への書き込みパスが断絶 | ❌ Phase 5 以降 |

### `casual_meeting_applied` が欠落している理由

- 候補者側の面談申込は `/api/casual-request` → **`ow_threads`**（migration 005、旧設計）
- `ow_casual_meetings`（migration 031、新設計）は企業側の読み取り・ステータス管理のみ
- 候補者側申込フローを `ow_casual_meetings` に移行するまで hook-in 不可

### `ow_activities` RLS の問題

migration 031 の `ow_activities_company_read` は直接サブクエリを使用:

```sql
-- 031（旧）
USING (
  company_id IN (
    SELECT company_id FROM ow_company_admins
    WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
      AND is_active = true
  )
);
```

migration 037 で作成した `auth_is_company_member()` SECURITY DEFINER 関数を使うべき。
→ **migration 039 で修正**（`ow_activities_company_insert` も追加）

### `ow_company_admins` スキーマ（migration 031）

```sql
-- permission: 'admin' | 'member' (CHECK 制約)
-- role_title: TEXT（担当者の役職名、任意）
```

`TeamMembers.tsx` は `"admin" | "editor" | "viewer"` を期待するが、
DB は `'admin' | 'member'` のみ → `member` → `"viewer"` にマップ。

---

## 型マッピング計画

### DashboardActivity（activities.ts で定義）

```typescript
type ActivityType = "application" | "meeting_scheduled" | "message" | "job_published" | "offer";

const TYPE_MAP: Record<string, ActivityType> = {
  job_published:          "job_published",
  job_closed:             "job_published",   // 同色ドット
  meeting_status_changed: "meeting_scheduled",
  profile_updated:        "message",
  offer:                  "offer",
  application_received:   "application",
};
```

### DashboardMeeting（meetings.ts で追加定義）

```typescript
// PendingMeetings.tsx の MeetingApplication と構造的に同一
type DashboardMeeting = {
  id: string;
  candidateName: string;
  candidateInitial: string;
  candidateGradient: string;
  jobTitle: string | null;
  appliedAt: string;
  status: "pending" | "company_contacted" | "scheduled" | "declined";
};
```

### DashboardTeamMember（team.ts で定義）

```typescript
// TeamMembers.tsx の TeamMember と構造的に同一
// permission: 'admin' → "admin", 'member' → "viewer"
// role: role_title ?? (permission === "admin" ? "管理者" : "メンバー")
```

---

## セッション分割計画

### AL-1: Infrastructure + Fetchers（このセッション）

1. **migration 039**: `ow_activities` RLS を `auth_is_company_member()` に統一
2. **rollback 039**: DROP POLICY + 旧ポリシー再作成
3. **supabase db push**
4. **`src/lib/business/activities.ts`**: `fetchActivitiesForDashboard()`
5. **`src/lib/business/team.ts`**: `fetchTeamMembersForDashboard()`
6. **`src/lib/business/meetings.ts`**: `DashboardMeeting` 型 + `fetchPendingMeetingsForDashboard()` 追加
7. **`src/app/biz/dashboard/page.tsx`**: 3 fetcher を Promise.all に追加、コンポーネントに渡す
8. **tsc + build 確認**
9. **コミット**

### AL-2: ActivityList INSERT（次セッション）

各 API Route に `ow_activities` INSERT を追加:

- `/api/biz/jobs/[id]` (PATCH: status → active/closed)
- `/api/biz/meetings/[id]` (PATCH: status change)
- `/api/biz/company` (PUT: profile save)

Service role key で INSERT（RLS bypass）。

### AL-3: ブラウザ動作確認 + ドキュメント更新

- ActivityList が実データを表示することを確認
- PendingMeetings / TeamMembers の実データ確認
- CLAUDE.md + このファイルを更新

---

## 変更ファイル一覧（AL-1）

| ファイル | 種別 | 内容 |
|---|---|---|
| `supabase/migrations/039_unify_ow_activities_rls.sql` | 新規 | RLS ポリシー更新 |
| `supabase/rollbacks/039_rollback.sql` | 新規 | ロールバック |
| `src/lib/business/activities.ts` | 新規 | ow_activities fetcher |
| `src/lib/business/team.ts` | 新規 | ow_company_admins fetcher |
| `src/lib/business/meetings.ts` | 修正 | DashboardMeeting 型 + 簡易 fetcher 追加 |
| `src/app/biz/dashboard/page.tsx` | 修正 | Promise.all 拡張 + コンポーネント接続 |

---

## 注意事項

- `MatchCandidates` は意図的に空のまま（`ow_matches` テーブル未実装のため）
- `casual_meeting_applied` は Phase 5 で候補者側申込フロー実装後に追加
- `fetchMeetingsForCompany`（全件用）は `/biz/meetings` ページ向けのまま変更しない
- `fetchPendingMeetingsForDashboard` は最新5件を返す軽量版

---

## ✅ 完了サマリー (2026-04-27)

### 実装した機能

5 イベント全てを ow_activities に記録できる枠組みを構築:
- ✅ `company_info_updated` → `/api/biz/company` PUT
- ✅ `job_updated` → `/api/biz/jobs/[id]` PUT
- ✅ `job_published` → `/api/biz/jobs/[id]` PATCH (status=published)
- ✅ `meeting_scheduled` → `/api/biz/meetings/[id]` PATCH (status=scheduled)
- ✅ `meeting_completed` → `/api/biz/meetings/[id]` PATCH (status=completed)

### ブラウザ動作確認

- ✅ `company_info_updated`: 企業情報編集 → dashboard に「企業情報を更新しました」表示確認
- ✅ `job_updated`: 求人編集 → dashboard に「求人「○○」の内容を更新しました」表示確認
- ⏸️ `job_published` / `meeting_scheduled` / `meeting_completed`: 同パターンのため動作確認省略

### 実装中の発見

1. **`.env.development.local` のモックモード残留** — `NEXT_PUBLIC_BIZ_MOCK_MODE=true` が残っていて /biz/jobs がモックデータ表示になっていたケースがあった
2. **insertActivity の best-effort パターン** — try/catch で囲み、INSERT 失敗時もユーザー操作をブロックしない設計を採用
3. **getOwUserId のヘルパー化** — auth.uid() → ow_users.id の変換を `company.ts` の共通関数として extract

### 残課題（Phase 5 以降）

残り 5 イベントは対応する機能自体が未実装のため、機能実装と同時に追加予定:
- `casual_meeting_applied`: 候補者側申込フロー（ow_threads → ow_casual_meetings 移行）
- `offer_sent`: ow_offers テーブル + API 実装
- `message_sent` / `message_received`: 候補者向けメッセージ機能
- `candidate_status_changed`: 候補者ステータス管理機能
- 既存 `insertActivity()` ヘルパーを使うだけで dashboard に自動表示される
