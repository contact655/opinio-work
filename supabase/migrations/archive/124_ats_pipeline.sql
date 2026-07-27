-- Migration 124: ATS Phase 1 — 選考パイプライン
-- 2026-05-28
--
-- 概要:
--   1. ow_pipeline_stages テーブル新規作成（会社ごとのカスタムステージ）
--   2. ow_job_applications にカラム追加（応募経路・ステージ・外部候補者情報・メモ）
--   3. 既存企業にデフォルトステージを一括挿入
--   4. 既存応募データに source = 'opinio' を付与
--
-- ロールバック: supabase/rollbacks/124_rollback.sql

-- ── 1. ow_pipeline_stages ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ow_pipeline_stages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  color         TEXT        NOT NULL DEFAULT '#64748B',
  order_index   INT         NOT NULL DEFAULT 0,
  is_hired      BOOLEAN     NOT NULL DEFAULT false,  -- 「採用」フラグ
  is_rejected   BOOLEAN     NOT NULL DEFAULT false,  -- 「不採用」フラグ
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 採用・不採用は各社1つのみ
  CONSTRAINT unique_hired_per_company    EXCLUDE (company_id WITH =) WHERE (is_hired = true),
  CONSTRAINT unique_rejected_per_company EXCLUDE (company_id WITH =) WHERE (is_rejected = true)
);

CREATE INDEX IF NOT EXISTS ow_pipeline_stages_company_id_idx
  ON ow_pipeline_stages(company_id);

CREATE INDEX IF NOT EXISTS ow_pipeline_stages_order_idx
  ON ow_pipeline_stages(company_id, order_index);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_ow_pipeline_stages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ow_pipeline_stages_updated_at
  BEFORE UPDATE ON ow_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_ow_pipeline_stages_updated_at();

-- RLS
ALTER TABLE ow_pipeline_stages ENABLE ROW LEVEL SECURITY;

-- 所属企業メンバーは読み取り可
CREATE POLICY "pipeline_stages_select"
  ON ow_pipeline_stages FOR SELECT
  USING (auth_is_company_member(company_id));

-- 所属企業メンバーは作成・更新・削除可
CREATE POLICY "pipeline_stages_insert"
  ON ow_pipeline_stages FOR INSERT
  WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY "pipeline_stages_update"
  ON ow_pipeline_stages FOR UPDATE
  USING (auth_is_company_member(company_id))
  WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY "pipeline_stages_delete"
  ON ow_pipeline_stages FOR DELETE
  USING (
    auth_is_company_member(company_id)
    AND is_hired = false    -- 「採用」ステージは削除不可
    AND is_rejected = false -- 「不採用」ステージは削除不可
  );

-- ── 2. ow_job_applications カラム追加 ──────────────────────────────────────

ALTER TABLE ow_job_applications
  -- 応募経路
  ADD COLUMN IF NOT EXISTS source             TEXT NOT NULL DEFAULT 'opinio',
  -- エージェント会社名（source = 'agent' のみ使用）
  ADD COLUMN IF NOT EXISTS agent_company      TEXT,
  -- 選考ステージ（null = 未振り分け）
  ADD COLUMN IF NOT EXISTS pipeline_stage_id  UUID REFERENCES ow_pipeline_stages(id) ON DELETE SET NULL,
  -- 外部候補者情報（user_id = null のとき使用）
  ADD COLUMN IF NOT EXISTS external_name      TEXT,
  ADD COLUMN IF NOT EXISTS external_email     TEXT,
  -- 人事メモ（社内共有用）
  ADD COLUMN IF NOT EXISTS memo               TEXT;

-- source のインデックス（絞り込みで使用）
CREATE INDEX IF NOT EXISTS ow_job_applications_source_idx
  ON ow_job_applications(source);

CREATE INDEX IF NOT EXISTS ow_job_applications_pipeline_stage_idx
  ON ow_job_applications(pipeline_stage_id);

-- ── 3. 既存データ移行 ──────────────────────────────────────────────────────

-- 既存の応募はすべて OPINIO 経由
UPDATE ow_job_applications
  SET source = 'opinio'
  WHERE source IS NULL OR source = '';

-- ── 4. 既存企業にデフォルトステージを一括挿入 ─────────────────────────────
--
-- デフォルト7ステージ:
--   書類選考(0) → 一次面接(1) → 二次面接(2) → 最終面接(3) → 内定(4)
--   → 採用(5, is_hired=true) / 不採用(6, is_rejected=true)

INSERT INTO ow_pipeline_stages (company_id, name, color, order_index, is_hired, is_rejected)
SELECT
  c.id,
  s.name,
  s.color,
  s.order_index,
  s.is_hired,
  s.is_rejected
FROM ow_companies c
CROSS JOIN (
  VALUES
    ('書類選考'::text, '#64748B'::text, 0::int, false::bool, false::bool),
    ('一次面接',       '#3B5FD9',       1,      false,       false      ),
    ('二次面接',       '#7C3AED',       2,      false,       false      ),
    ('最終面接',       '#D97706',       3,      false,       false      ),
    ('内定',           '#059669',       4,      false,       false      ),
    ('採用',           '#059669',       5,      true,        false      ),
    ('不採用',         '#94A3B8',       6,      false,       true       )
) AS s(name, color, order_index, is_hired, is_rejected)
-- 既にステージが存在する企業はスキップ（冪等性担保）
WHERE NOT EXISTS (
  SELECT 1 FROM ow_pipeline_stages ps WHERE ps.company_id = c.id
);
