-- ============================================================================
-- Migration 055: Create ow_conversations
-- ============================================================================
-- Purpose: Phase ν-1 の中核テーブル。Opinio の対話基盤を確立する。
--
-- 引き継ぎ書 v10 §3-1 の仕様に基づき、以下を実装:
-- - kind: 対話種別 (company / mentor / editor)
-- - stage: 対話のフェーズ (mediated / direct / active)
-- - candidate_user_id: 対話の主役(必須)
-- - company_id / mentor_user_id: 種別ごとに必須化(CHECK 制約)
-- - A-1 原則: (kind, company_id, mentor_user_id, candidate_user_id) UNIQUE NULLS NOT DISTINCT
--   = 同じ組み合わせの対話は永続的に 1 つだけ
--
-- 関連設計原則:
-- - 「グローバルロール ≠ 対話内ロール」原則 (M-5)
-- - A-1: 永続的に 1 対話
--
-- 注意:
-- - RLS ポリシーは migration 060 で別途設定する
-- - conversation_id を参照する既存テーブルの修正は migration 059 で行う
-- - PostgreSQL 15+ の UNIQUE NULLS NOT DISTINCT を使用
-- ============================================================================

CREATE TABLE ow_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 対話の種別
  kind TEXT NOT NULL CHECK (kind IN ('company', 'mentor', 'editor')),

  -- 対話のフェーズ
  -- - company: 常に 'active'
  -- - mentor: 'mediated' (運営者仲介中) → 'direct' (運営者離脱後)
  -- - editor: 常に 'active'
  stage TEXT NOT NULL DEFAULT 'active' CHECK (stage IN ('mediated', 'direct', 'active')),

  -- 種別ごとに必須となる外部キー
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  mentor_user_id UUID REFERENCES ow_users(id) ON DELETE SET NULL,

  -- 対話の主役(求職者) - 全種別で必須
  candidate_user_id UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,

  -- 対話の状態
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  -- 並べ替え・未読判定用
  last_message_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A-1 原則: 永続的に 1 対話
  -- (kind, company_id, mentor_user_id, candidate_user_id) の組み合わせで一意
  -- NULLS NOT DISTINCT により、NULL 同士も「等しい」と扱われるため、
  -- 例えば (mentor, NULL, mentor_X, candidate_Y) と
  --       (mentor, NULL, mentor_X, candidate_Y) が重複として検出される
  CONSTRAINT ow_conversations_unique_per_relation
    UNIQUE NULLS NOT DISTINCT (kind, company_id, mentor_user_id, candidate_user_id),

  -- kind と外部キーの整合性チェック
  CONSTRAINT ow_conversations_kind_consistency CHECK (
    (kind = 'company' AND company_id IS NOT NULL AND mentor_user_id IS NULL) OR
    (kind = 'mentor'  AND company_id IS NULL     AND mentor_user_id IS NOT NULL) OR
    (kind = 'editor'  AND company_id IS NULL     AND mentor_user_id IS NULL)
  ),

  -- stage と kind の整合性チェック
  -- - company: 'active' のみ
  -- - mentor: 'mediated' or 'direct' のみ
  -- - editor: 'active' のみ
  CONSTRAINT ow_conversations_stage_consistency CHECK (
    (kind = 'company' AND stage = 'active') OR
    (kind = 'mentor'  AND stage IN ('mediated', 'direct')) OR
    (kind = 'editor'  AND stage = 'active')
  )
);

-- ============================================================================
-- インデックス
-- ============================================================================

-- マイページの「対話一覧」取得を高速化
-- WHERE candidate_user_id = $1 ORDER BY last_message_at DESC
CREATE INDEX idx_ow_conversations_candidate_last_message
  ON ow_conversations (candidate_user_id, last_message_at DESC NULLS LAST);

-- 企業側の対話一覧取得を高速化
-- WHERE company_id = $1 AND kind = 'company' ORDER BY last_message_at DESC
CREATE INDEX idx_ow_conversations_company_last_message
  ON ow_conversations (company_id, last_message_at DESC NULLS LAST)
  WHERE company_id IS NOT NULL;

-- メンター側の対話一覧取得を高速化
-- WHERE mentor_user_id = $1 AND kind = 'mentor' ORDER BY last_message_at DESC
CREATE INDEX idx_ow_conversations_mentor_last_message
  ON ow_conversations (mentor_user_id, last_message_at DESC NULLS LAST)
  WHERE mentor_user_id IS NOT NULL;

-- ============================================================================
-- コメント (ドキュメント)
-- ============================================================================

COMMENT ON TABLE ow_conversations IS
  'Opinio 対話基盤の最上位テーブル。求職者と企業/メンター/編集部の対話を統一的に表現する。Phase ν-1 で導入。';

COMMENT ON COLUMN ow_conversations.kind IS
  '対話種別: company (企業対話), mentor (メンター対話), editor (編集部対話)';

COMMENT ON COLUMN ow_conversations.stage IS
  '対話フェーズ: mediated (運営者仲介中、kind=mentor のみ), direct (直接対話、kind=mentor のみ), active (kind=company/editor)';

COMMENT ON COLUMN ow_conversations.candidate_user_id IS
  '対話の主役(求職者)。全種別で必須。';

COMMENT ON COLUMN ow_conversations.company_id IS
  'kind=company の場合のみ NOT NULL。それ以外は NULL。';

COMMENT ON COLUMN ow_conversations.mentor_user_id IS
  'kind=mentor の場合のみ NOT NULL。それ以外は NULL。';

COMMENT ON COLUMN ow_conversations.last_message_at IS
  '最新メッセージの送信時刻。対話一覧の並べ替えに使用。新規作成時は NULL。';

-- ============================================================================
-- RLS は migration 060 で設定 (本 migration ではテーブル作成のみ)
-- ============================================================================

-- 注意: ALTER TABLE ow_conversations ENABLE ROW LEVEL SECURITY; は
--       migration 060 で設定する。本 migration では RLS を有効化しない。
