-- ============================================
-- Migration 103: ow_company_join_requests テーブル作成
-- 目的: YOUTRUST型オンボーディングフロー Phase 1
-- 作成日: 2026-05-13
-- 備考: spec-2026-05-13-youtrust-onboarding-phase1.md に基づく
--       仕様書では 048 と記載されていたが、
--       048 は既存（rename_mentors_to_ow_mentors）のため 103 を使用
-- ============================================

-- ── 既存があれば削除（冪等性）──────────────────────────────────────────────
DROP TABLE IF EXISTS ow_company_join_requests CASCADE;

-- ── テーブル作成 ──────────────────────────────────────────────────────────
CREATE TABLE ow_company_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,

  -- 既存企業への紐づけ申請 OR 新規企業作成申請
  request_type text NOT NULL CHECK (request_type IN ('join_existing', 'create_new')),

  -- 既存企業への申請の場合
  target_company_id uuid REFERENCES ow_companies(id) ON DELETE CASCADE,

  -- 新規企業作成申請の場合（仮の企業情報）
  new_company_name text,
  new_company_url text,
  new_company_description text,

  -- 申請者が希望する権限
  requested_permission text NOT NULL CHECK (requested_permission IN ('admin', 'member')) DEFAULT 'admin',

  -- 申請理由・補足
  request_message text,

  -- ステータス管理
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',

  -- 承認者情報
  reviewed_by uuid REFERENCES ow_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,

  -- 作成日時
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── インデックス ──────────────────────────────────────────────────────────
CREATE INDEX idx_ow_company_join_requests_user_id
  ON ow_company_join_requests(user_id);

CREATE INDEX idx_ow_company_join_requests_target_company_id
  ON ow_company_join_requests(target_company_id)
  WHERE target_company_id IS NOT NULL;

CREATE INDEX idx_ow_company_join_requests_status
  ON ow_company_join_requests(status);

-- ── データ整合性チェック制約 ──────────────────────────────────────────────
ALTER TABLE ow_company_join_requests
  ADD CONSTRAINT chk_request_type_data CHECK (
    (request_type = 'join_existing' AND target_company_id IS NOT NULL AND new_company_name IS NULL)
    OR
    (request_type = 'create_new' AND target_company_id IS NULL AND new_company_name IS NOT NULL)
  );

-- ── RLS（Row Level Security） ────────────────────────────────────────────
ALTER TABLE ow_company_join_requests ENABLE ROW LEVEL SECURITY;

-- ポリシー1: ユーザーは自分の申請のみ閲覧可能
CREATE POLICY "Users can view their own join requests"
  ON ow_company_join_requests FOR SELECT
  USING (auth.uid() = (
    SELECT auth_id FROM ow_users WHERE id = user_id LIMIT 1
  ));

-- ポリシー2: ユーザーは自分の申請を作成可能
CREATE POLICY "Users can create their own join requests"
  ON ow_company_join_requests FOR INSERT
  WITH CHECK (auth.uid() = (
    SELECT auth_id FROM ow_users WHERE id = user_id LIMIT 1
  ));

-- ポリシー3: ユーザーは自分の pending な申請をキャンセル可能
CREATE POLICY "Users can cancel their own pending requests"
  ON ow_company_join_requests FOR UPDATE
  USING (
    auth.uid() = (SELECT auth_id FROM ow_users WHERE id = user_id LIMIT 1)
    AND status = 'pending'
  )
  WITH CHECK (status = 'cancelled');

-- ポリシー4: admin は全申請を閲覧・編集可能
CREATE POLICY "Admins can view all join requests"
  ON ow_company_join_requests FOR SELECT
  USING (auth_is_admin());

CREATE POLICY "Admins can update all join requests"
  ON ow_company_join_requests FOR UPDATE
  USING (auth_is_admin());

-- ポリシー5: 既存企業の admin は、自社への申請を閲覧・編集可能
CREATE POLICY "Company admins can view requests to their company"
  ON ow_company_join_requests FOR SELECT
  USING (
    request_type = 'join_existing'
    AND target_company_id IS NOT NULL
    AND auth_is_company_admin(target_company_id)
  );

CREATE POLICY "Company admins can update requests to their company"
  ON ow_company_join_requests FOR UPDATE
  USING (
    request_type = 'join_existing'
    AND target_company_id IS NOT NULL
    AND auth_is_company_admin(target_company_id)
  );

-- ── トリガー：updated_at の自動更新 ──────────────────────────────────────
CREATE TRIGGER set_updated_at_ow_company_join_requests
  BEFORE UPDATE ON ow_company_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ── 動作確認メッセージ ─────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Migration 103: ow_company_join_requests テーブル作成完了';
  RAISE NOTICE 'カラム数: %', (
    SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'ow_company_join_requests'
  );
  RAISE NOTICE 'インデックス数: %', (
    SELECT count(*) FROM pg_indexes
    WHERE tablename = 'ow_company_join_requests'
  );
  RAISE NOTICE 'RLS ポリシー数: %', (
    SELECT count(*) FROM pg_policies
    WHERE tablename = 'ow_company_join_requests'
  );
END $$;
