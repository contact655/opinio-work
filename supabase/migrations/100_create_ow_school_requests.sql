-- ============================================================
-- Migration 100: Create ow_school_requests table
-- ============================================================
-- 段階6-8 Phase 1
--
-- Purpose:
--   ユーザーが ow_schools マスターに学校を追加リクエストする仕組みのための
--   テーブル。承認 → ow_schools INSERT + ow_user_educations.school_id 自動更新
--   というワークフローを段階6-8 全体で構築する(本 Phase はテーブル作成のみ)。
--
-- Design:
--   - status (pending/approved/rejected) で承認状態を管理
--   - approved_school_id で承認時の紐付けを記録
--   - RLS: SELECT/INSERT は authenticated(自分のリクエストのみ)
--           UPDATE/DELETE はポリシーなし(運営が postgres role で手動実施)
--
-- Prerequisites:
--   - Migration 098 (ow_schools) 適用済み
--   - Migration 099 (ow_user_educations.school_id) 適用済み
--
-- Rollback: supabase/rollbacks/100_create_ow_school_requests_rollback.sql
-- ============================================================

-- ── テーブル作成 ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ow_school_requests (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by       uuid        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  school_name        text        NOT NULL,
  school_name_kana   text,
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_school_id uuid        REFERENCES ow_schools(id) ON DELETE SET NULL,
  approved_at        timestamptz,
  approved_by        uuid        REFERENCES ow_users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── インデックス ──────────────────────────────────────────────────────────────

-- ユーザー自身のリクエスト一覧表示に使う
CREATE INDEX IF NOT EXISTS ow_school_requests_requested_by_idx
  ON ow_school_requests (requested_by);

-- 運営が pending リクエストを抽出する時に使う
CREATE INDEX IF NOT EXISTS ow_school_requests_status_idx
  ON ow_school_requests (status);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE ow_school_requests ENABLE ROW LEVEL SECURITY;

-- ユーザー自身は自分のリクエストのみ SELECT 可
CREATE POLICY ow_school_requests_select_own
  ON ow_school_requests
  FOR SELECT
  TO authenticated
  USING (
    requested_by IN (
      SELECT id FROM ow_users WHERE auth_id = auth.uid()
    )
  );

-- authenticated 全員が自分のリクエストとして INSERT 可
CREATE POLICY ow_school_requests_insert_authenticated
  ON ow_school_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by IN (
      SELECT id FROM ow_users WHERE auth_id = auth.uid()
    )
  );

-- UPDATE/DELETE はポリシーなし
-- → authenticated 経由では不可。承認は postgres role(SQL Editor)から手動実施
-- → 将来、運営側管理画面(段階7-F 等)で admin role を導入する時に追加する
