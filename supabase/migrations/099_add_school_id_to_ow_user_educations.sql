-- ============================================================
-- Migration 099: Add school_id FK to ow_user_educations
-- ============================================================
-- 段階6-6 Phase 2
--
-- Purpose:
--   ow_user_educations に ow_schools への FK カラムを追加し、
--   学歴データと学校マスターの紐付けを可能にする。
--
-- Design:
--   - school_id は nullable: 既存データは null のまま、新規入力時は任意
--   - 既存の school (text) は廃止せず保持: UI でマスター選択推奨、
--     未マッチ大学はフリー入力継続(判断点 1 案 C)
--   - ON DELETE SET NULL: マスター削除時は school_id だけ null になり、
--     学歴データ本体は school text で保持される(データ損失なし)
--
-- Prerequisites:
--   - Migration 098 (ow_schools テーブル + 30 校シード) 適用済み
--
-- Effect after apply:
--   - 既存 ow_user_educations 全行で school_id = NULL
--   - 新規 INSERT 時に school_id を含めて記録可能(API Route 拡張は Phase 3)
--
-- Migration policy:
--   - 既存データへの UPDATE なし(漸進的移行、判断点 5 案 m)
--   - ユーザーが編集時にマスターから選び直せば school_id が埋まる
--
-- Rollback: supabase/rollbacks/099_add_school_id_to_ow_user_educations_rollback.sql
-- ============================================================

ALTER TABLE ow_user_educations
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES ow_schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ow_user_educations_school_id_idx
  ON ow_user_educations (school_id);

COMMENT ON COLUMN ow_user_educations.school_id IS
  'Optional FK to ow_schools master. NULL for legacy data and free-text-only entries. Filled when user selects from master in EducationEditor.';
