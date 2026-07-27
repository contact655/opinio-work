-- Migration: company_profile_blocks
-- 企業詳細ページ「会社説明の分解」— 5ブロック対応スキーマ
-- SQL Editor で適用済み（2026-07-28）。このファイルは履歴の埋め戻し用。
-- 実定義は information_schema / pg_constraint で確認済み。

-- ──────────────────────────────────────────────────────────────────
-- ① 事業内容: ow_company_segments
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ow_company_segments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  target        TEXT,
  description   TEXT,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ow_company_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read segments"
  ON ow_company_segments FOR SELECT
  USING (true);

CREATE POLICY "company admins manage segments"
  ON ow_company_segments FOR ALL
  USING (auth_is_company_admin(company_id));

CREATE POLICY "admins manage segments"
  ON ow_company_segments FOR ALL
  USING (auth_is_admin());

-- ──────────────────────────────────────────────────────────────────
-- ④ 組織構成: ow_company_org_composition
-- role_id は ow_roles の大分類（parent_id IS NULL）を参照する想定。
-- DB 制約ではなくアプリ側バリデーションで制御する（設計メモ参照）。
-- role_id FK は ON DELETE CASCADE（SQL Editor 適用時の実定義に合わせる）
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ow_company_org_composition (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID         NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  role_id          UUID         NOT NULL REFERENCES ow_roles(id) ON DELETE CASCADE,
  headcount        INT,
  headcount_ratio  NUMERIC(5,2) DEFAULT NULL,
  display_order    INT          NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (company_id, role_id)
);

ALTER TABLE ow_company_org_composition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read org composition"
  ON ow_company_org_composition FOR SELECT
  USING (true);

CREATE POLICY "company admins manage org composition"
  ON ow_company_org_composition FOR ALL
  USING (auth_is_company_admin(company_id));

CREATE POLICY "admins manage org composition"
  ON ow_company_org_composition FOR ALL
  USING (auth_is_admin());

-- ──────────────────────────────────────────────────────────────────
-- ⑤ 規模と変化（時系列出来事）: ow_company_milestones
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ow_company_milestones (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL,
  occurred_at   DATE        NOT NULL,
  title         TEXT        NOT NULL,
  body          TEXT,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT milestones_event_type_check
    CHECK (event_type = ANY (ARRAY['funding'::text, 'ipo'::text, 'new_product'::text, 'org_change'::text, 'headcount'::text, 'other'::text]))
);

ALTER TABLE ow_company_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read milestones"
  ON ow_company_milestones FOR SELECT
  USING (true);

CREATE POLICY "company admins manage milestones"
  ON ow_company_milestones FOR ALL
  USING (auth_is_company_admin(company_id));

CREATE POLICY "admins manage milestones"
  ON ow_company_milestones FOR ALL
  USING (auth_is_admin());

-- ──────────────────────────────────────────────────────────────────
-- ow_companies へのカラム追加
-- ② ビジネスモデル / ③ 顧客・マーケット / ⑤ 規模と変化（数値）
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS biz_model_types       TEXT[]  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS biz_model_new_pct     INT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS biz_model_deal_size   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS biz_model_note        TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS market_customer_size  TEXT[]  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS market_industry_focus TEXT[]  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS market_decision_maker TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS market_deal_days      INT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS market_note           TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS headcount_3y_ago      INT     DEFAULT NULL;

-- CHECK 制約（値の集合を強制）
ALTER TABLE ow_companies
  ADD CONSTRAINT biz_model_types_check
    CHECK (biz_model_types <@ ARRAY['subscription'::text, 'transaction'::text, 'usage'::text, 'one_time'::text, 'hybrid'::text]),
  ADD CONSTRAINT market_customer_size_check
    CHECK (market_customer_size <@ ARRAY['enterprise'::text, 'mid_market'::text, 'smb'::text]),
  ADD CONSTRAINT market_industry_focus_check
    CHECK (market_industry_focus <@ ARRAY['it_tech'::text, 'finance'::text, 'manufacturing'::text, 'retail'::text, 'healthcare'::text, 'public'::text, 'media'::text, 'real_estate'::text, 'other'::text]);

-- ──────────────────────────────────────────────────────────────────
-- 設計メモ
-- ・ow_company_org_composition.role_id は ow_roles の大分類
--   （parent_id IS NULL の9カテゴリ）のみを想定するが、
--   DB 制約ではなくアプリ側バリデーションで制御する。
--   大分類以外の role_id が INSERT される可能性がある点を記録しておく。
--   将来トリガーで守るかは別途判断する。
-- ・biz_model_new_pct は INT（整数%）で確定。
-- ・ow_company_job_roles（migration 270）は 0 行・未使用のまま残す（DROP しない）。
--   役割: 求人の職種表示名を管理する BIZ 内部辞書（公開ページとは別用途）。
-- ──────────────────────────────────────────────────────────────────
