-- ===========================================================
-- Phase 1: Opinio Consultation (相談機能 Phase 1)
-- Created: 2026-04-18
--
-- 方針（案③）:
--   - 既存の ow_consultations は温存（企業MVPとの互換性維持）
--   - 相談予約フロー用に別テーブル ow_consultation_bookings を新設
--   - その他 2 テーブル + ow_user_profiles 2 カラム追加
--
-- 作成対象:
--   A. ow_user_profiles に roles / mentor_profile カラム追加
--   B. ow_mentor_availability (新規)
--   C. ow_consultation_bookings (新規)
--   D. ow_mentor_match_history (新規)
--   E. 各テーブルの RLS + インデックス
-- ===========================================================


-- ───────── A. ow_user_profiles 拡張 ─────────
-- roles: このユーザーが持つ役割（配列）。seeker / mentor
-- mentor_profile: "mentor" ロール時のプロファイル（キャリア・空き枠上限など）

ALTER TABLE ow_user_profiles
ADD COLUMN IF NOT EXISTS roles jsonb NOT NULL DEFAULT '["seeker"]'::jsonb;

ALTER TABLE ow_user_profiles
ADD COLUMN IF NOT EXISTS mentor_profile jsonb;

-- roles に "mentor" を含む行の高速検索用
CREATE INDEX IF NOT EXISTS idx_user_profiles_roles_mentor
  ON ow_user_profiles USING GIN (roles)
  WHERE roles @> '["mentor"]'::jsonb;


-- ───────── B. ow_mentor_availability (新規) ─────────
-- メンターの空き枠管理
-- Phase 1 では Hisato が SQL Editor から手動 INSERT

CREATE TABLE IF NOT EXISTS ow_mentor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_user_id uuid NOT NULL REFERENCES ow_user_profiles(user_id) ON DELETE CASCADE,
  slot_start_at timestamptz NOT NULL,
  slot_end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'booked', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT slot_time_valid CHECK (slot_end_at > slot_start_at)
);

CREATE INDEX IF NOT EXISTS idx_mentor_availability_mentor
  ON ow_mentor_availability(mentor_user_id);
CREATE INDEX IF NOT EXISTS idx_mentor_availability_start
  ON ow_mentor_availability(slot_start_at);
CREATE INDEX IF NOT EXISTS idx_mentor_availability_status_available
  ON ow_mentor_availability(status) WHERE status = 'available';


-- ───────── C. ow_consultation_bookings (新規メインテーブル) ─────────
-- 仕様書の ow_consultations 相当。既存 ow_consultations とは分離。

CREATE TABLE IF NOT EXISTS ow_consultation_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 関係者
  seeker_user_id uuid NOT NULL REFERENCES ow_user_profiles(user_id) ON DELETE RESTRICT,
  mentor_user_id uuid NOT NULL REFERENCES ow_user_profiles(user_id) ON DELETE RESTRICT,
  availability_id uuid REFERENCES ow_mentor_availability(id) ON DELETE SET NULL,

  -- Step 2 ヒアリング（JSONB）
  -- { state, current_role, main_concern, free_text? }
  hearing_data jsonb NOT NULL,

  -- どの求人ページから来たか（トップ直接 = NULL）
  source_job_id uuid REFERENCES ow_jobs(id) ON DELETE SET NULL,

  -- Step 5 事前情報（任意）
  -- { current_company, current_role_detail, interested_companies, topics }
  pre_meeting_info jsonb,

  -- 予約確定情報
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 15,
  zoom_url text,

  -- ステータス
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),

  -- 相談後メモ（Phase 2 で本格利用）
  post_meeting_memo text,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_consultation_bookings_seeker
  ON ow_consultation_bookings(seeker_user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_mentor
  ON ow_consultation_bookings(mentor_user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_scheduled
  ON ow_consultation_bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_status
  ON ow_consultation_bookings(status);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_source_job
  ON ow_consultation_bookings(source_job_id) WHERE source_job_id IS NOT NULL;


-- ───────── D. ow_mentor_match_history (新規) ─────────
-- マッチング履歴。Phase 2 で改善用データとして利用。

CREATE TABLE IF NOT EXISTS ow_mentor_match_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_booking_id uuid REFERENCES ow_consultation_bookings(id) ON DELETE CASCADE,

  -- 提示したメンター候補（スコア付き）
  -- [{ mentor_user_id, score, reason }, ...]
  suggested_mentors jsonb NOT NULL,

  -- 最終選択（デフォルト = top1）
  selected_mentor_user_id uuid REFERENCES ow_user_profiles(user_id) ON DELETE SET NULL,

  -- 「別の方を見る」を押したか
  user_changed_selection boolean NOT NULL DEFAULT FALSE,

  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_match_history_booking
  ON ow_mentor_match_history(consultation_booking_id);


-- ───────── E. RLS ─────────

ALTER TABLE ow_mentor_availability      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_consultation_bookings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_mentor_match_history     ENABLE ROW LEVEL SECURITY;

-- ── ow_mentor_availability ──
-- 全ユーザー(未認証含む)が available 枠を閲覧可
DROP POLICY IF EXISTS "availability_read_available" ON ow_mentor_availability;
CREATE POLICY "availability_read_available"
  ON ow_mentor_availability FOR SELECT
  USING (status = 'available');

-- メンター本人のみ自分の枠を更新可
DROP POLICY IF EXISTS "availability_update_own" ON ow_mentor_availability;
CREATE POLICY "availability_update_own"
  ON ow_mentor_availability FOR UPDATE
  USING (auth.uid() = mentor_user_id);

-- メンター本人のみ自分の枠を削除可
DROP POLICY IF EXISTS "availability_delete_own" ON ow_mentor_availability;
CREATE POLICY "availability_delete_own"
  ON ow_mentor_availability FOR DELETE
  USING (auth.uid() = mentor_user_id);

-- Phase 1 は INSERT はサービスロール(Hisato 手動 SQL)のみ。
-- Phase 2 でメンター自身に開放する場合はここに INSERT ポリシーを追加。

-- ── ow_consultation_bookings ──
-- 相談者本人: 自分の予約を読める
DROP POLICY IF EXISTS "booking_read_own_seeker" ON ow_consultation_bookings;
CREATE POLICY "booking_read_own_seeker"
  ON ow_consultation_bookings FOR SELECT
  USING (auth.uid() = seeker_user_id);

-- メンター本人: 自分が担当する予約を読める
DROP POLICY IF EXISTS "booking_read_own_mentor" ON ow_consultation_bookings;
CREATE POLICY "booking_read_own_mentor"
  ON ow_consultation_bookings FOR SELECT
  USING (auth.uid() = mentor_user_id);

-- 認証済みユーザーが自分の予約を作成可
DROP POLICY IF EXISTS "booking_insert_authenticated" ON ow_consultation_bookings;
CREATE POLICY "booking_insert_authenticated"
  ON ow_consultation_bookings FOR INSERT
  WITH CHECK (auth.uid() = seeker_user_id);

-- 相談者本人のみ更新可(キャンセル / 事前情報入力)
DROP POLICY IF EXISTS "booking_update_own_seeker" ON ow_consultation_bookings;
CREATE POLICY "booking_update_own_seeker"
  ON ow_consultation_bookings FOR UPDATE
  USING (auth.uid() = seeker_user_id);

-- ── ow_mentor_match_history ──
-- 認証済みユーザーが INSERT 可(予約フロー内で記録)
DROP POLICY IF EXISTS "match_history_insert_authenticated" ON ow_mentor_match_history;
CREATE POLICY "match_history_insert_authenticated"
  ON ow_mentor_match_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT ポリシーは Phase 1 では特に設定せず(サービスロールで読む)。
-- Phase 2 で管理者用SELECTを追加する場合はここに追記。
