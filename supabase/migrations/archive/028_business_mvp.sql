-- ===========================================================
-- Phase 1: Opinio Business MVP
-- Created: 2026-04-18
--
-- 目的:
--   企業側UI(/business/...)のベースとなるDB構造を準備する。
--   既存テーブルは構造変更せず、必要最小限のカラム追加とビュー作成のみ。
--
-- 対象:
--   A. ow_user_roles: tenant_id カラム追加
--   B. ow_applications: 選考タイムスタンプ + 返信時刻 + メッセージ
--   C. 新規4テーブル: ow_job_views / ow_tenant_plans / ow_invoices / ow_consultations
--   D. 新規3ビュー: ow_business_todo_counts / ow_business_monthly_stats / ow_business_job_performance
-- ===========================================================


-- ───────── A. 既存テーブル: ow_user_roles ─────────
-- 'company' ロールに所属企業(tenant_id)を持たせる。
-- candidate ロールには tenant_id = NULL のまま。

ALTER TABLE ow_user_roles
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES ow_companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ow_user_roles_tenant
  ON ow_user_roles(tenant_id) WHERE tenant_id IS NOT NULL;


-- ───────── B. 既存テーブル: ow_applications ─────────
-- ダッシュボード/選考管理用カラム追加 (デフォルトNULL、既存データに影響なし)

ALTER TABLE ow_applications
ADD COLUMN IF NOT EXISTS message text;

ALTER TABLE ow_applications
ADD COLUMN IF NOT EXISTS first_round_at timestamptz;

ALTER TABLE ow_applications
ADD COLUMN IF NOT EXISTS second_round_at timestamptz;

ALTER TABLE ow_applications
ADD COLUMN IF NOT EXISTS offer_at timestamptz;

ALTER TABLE ow_applications
ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

ALTER TABLE ow_applications
ADD COLUMN IF NOT EXISTS replied_at timestamptz;


-- ───────── C-1. 新規テーブル: ow_job_views ─────────
-- 求人閲覧ログ。匿名閲覧も許容。

CREATE TABLE IF NOT EXISTS ow_job_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES ow_jobs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ow_job_views_job
  ON ow_job_views(job_id);
CREATE INDEX IF NOT EXISTS idx_ow_job_views_created
  ON ow_job_views(created_at DESC);


-- ───────── C-2. 新規テーブル: ow_tenant_plans ─────────
-- 企業ごとの契約プラン (成果報酬 / SaaS月額 / SaaS年額)

CREATE TABLE IF NOT EXISTS ow_tenant_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  plan_type text NOT NULL CHECK (plan_type IN ('performance', 'saas_monthly', 'saas_yearly')),
  monthly_fee integer,                       -- SaaSプランの月額(円)、成果報酬は NULL
  performance_rate numeric(4,3),             -- 成果報酬の年収比率 (0.250 = 25%)
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ow_tenant_plans_tenant
  ON ow_tenant_plans(tenant_id);


-- ───────── C-3. 新規テーブル: ow_invoices ─────────
-- 請求履歴

CREATE TABLE IF NOT EXISTS ow_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  invoice_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','void')),
  related_candidate_id uuid REFERENCES auth.users(id),
  related_job_id uuid REFERENCES ow_jobs(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ow_invoices_tenant
  ON ow_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ow_invoices_date
  ON ow_invoices(invoice_date DESC);


-- ───────── C-4. 既存テーブル: ow_consultations にカラム追加 ─────────
-- 既存構造: id, user_id, mentor_id, consulted_at, duration_min, tags, memo, created_at
-- MVPでは candidate_id を新設してそちらを使う(既存 user_id は残す)。
-- candidate_id は NULL 許容にし、新規データから埋めていく方針。

ALTER TABLE ow_consultations
ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ow_consultations
ADD COLUMN IF NOT EXISTS mentor_name text;

ALTER TABLE ow_consultations
ADD COLUMN IF NOT EXISTS consultation_date date;

ALTER TABLE ow_consultations
ADD COLUMN IF NOT EXISTS topic text;

ALTER TABLE ow_consultations
ADD COLUMN IF NOT EXISTS summary text;

ALTER TABLE ow_consultations
ADD COLUMN IF NOT EXISTS is_shareable boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ow_consultations_candidate
  ON ow_consultations(candidate_id) WHERE candidate_id IS NOT NULL;


-- ───────── D-1. ビュー: ow_business_todo_counts ─────────
-- ダッシュボードの「今日のTo-Do」4カードに集計値を提供
--   - reply_overdue: 5日以上未返信 (status='applied' かつ replied_at IS NULL)
--   - new_applications: 24時間以内の新規応募
--   - scout_replies: スカウト返信 (Phase 3以降。MVPは0)
--   - interviews_today: 本日の面接 (Phase 3以降。MVPは0)

CREATE OR REPLACE VIEW ow_business_todo_counts AS
SELECT
  c.id AS tenant_id,
  COALESCE(SUM(CASE
    WHEN a.replied_at IS NULL
     AND a.applied_at < NOW() - INTERVAL '5 days'
     AND a.status = 'applied'
    THEN 1 ELSE 0 END), 0)::int AS reply_overdue,
  COALESCE(SUM(CASE
    WHEN a.applied_at >= NOW() - INTERVAL '24 hours'
    THEN 1 ELSE 0 END), 0)::int AS new_applications,
  0::int AS scout_replies,
  0::int AS interviews_today
FROM ow_companies c
LEFT JOIN ow_jobs j ON j.company_id = c.id
LEFT JOIN ow_applications a ON a.job_id = j.id
GROUP BY c.id;


-- ───────── D-2. ビュー: ow_business_monthly_stats ─────────
-- 月次採用サマリー (応募/スカウト/面接/内定)
-- 判定ロジック (タイムスタンプベース):
--   - applications: 応募が存在する全件
--   - scouts: 0 (Phase 3以降)
--   - interviews: first_round_at OR second_round_at が存在
--   - offers: offer_at が存在

CREATE OR REPLACE VIEW ow_business_monthly_stats AS
SELECT
  c.id AS tenant_id,
  date_trunc('month', a.applied_at)::date AS month,
  COUNT(*)::int AS applications,
  0::int AS scouts,
  COUNT(*) FILTER (
    WHERE a.first_round_at IS NOT NULL OR a.second_round_at IS NOT NULL
  )::int AS interviews,
  COUNT(*) FILTER (WHERE a.offer_at IS NOT NULL)::int AS offers
FROM ow_companies c
JOIN ow_jobs j ON j.company_id = c.id
LEFT JOIN ow_applications a ON a.job_id = j.id
WHERE a.id IS NOT NULL
GROUP BY c.id, date_trunc('month', a.applied_at);


-- ───────── D-3. ビュー: ow_business_job_performance ─────────
-- 求人別パフォーマンス: 閲覧数・応募数・応募率(%)

CREATE OR REPLACE VIEW ow_business_job_performance AS
SELECT
  j.id AS job_id,
  j.company_id AS tenant_id,
  j.title,
  j.status,
  j.created_at,
  COALESCE(v.view_count, 0)::int AS view_count,
  COALESCE(a.application_count, 0)::int AS application_count,
  CASE WHEN COALESCE(v.view_count, 0) > 0
       THEN ROUND(COALESCE(a.application_count, 0)::numeric
                  / v.view_count * 100, 2)
       ELSE 0 END AS conversion_rate_pct
FROM ow_jobs j
LEFT JOIN (
  SELECT job_id, COUNT(*) AS view_count
  FROM ow_job_views GROUP BY job_id
) v ON v.job_id = j.id
LEFT JOIN (
  SELECT job_id, COUNT(*) AS application_count
  FROM ow_applications GROUP BY job_id
) a ON a.job_id = j.id;


-- ───────── E. RLS (Row Level Security) ─────────

ALTER TABLE ow_job_views     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_tenant_plans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_consultations ENABLE ROW LEVEL SECURITY;

-- 求人閲覧ログ: 誰でもINSERT可、SELECTはなし(集計は service_role か view 経由)
DROP POLICY IF EXISTS "anyone can log views" ON ow_job_views;
CREATE POLICY "anyone can log views" ON ow_job_views
  FOR INSERT WITH CHECK (true);

-- テナントプラン: 自社メンバーのみSELECT
DROP POLICY IF EXISTS "tenant members read plan" ON ow_tenant_plans;
CREATE POLICY "tenant members read plan" ON ow_tenant_plans
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM ow_user_roles
      WHERE user_id = auth.uid()
        AND role = 'company'
        AND tenant_id IS NOT NULL
    )
  );

-- 請求履歴: 自社メンバーのみSELECT
DROP POLICY IF EXISTS "tenant members read invoice" ON ow_invoices;
CREATE POLICY "tenant members read invoice" ON ow_invoices
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM ow_user_roles
      WHERE user_id = auth.uid()
        AND role = 'company'
        AND tenant_id IS NOT NULL
    )
  );

-- 相談履歴: 候補者本人のみSELECT
--   (Phase 6で同意フローを実装後、企業向けポリシーを追加予定)
DROP POLICY IF EXISTS "candidate reads own consultations" ON ow_consultations;
CREATE POLICY "candidate reads own consultations" ON ow_consultations
  FOR SELECT USING (auth.uid() = candidate_id);
