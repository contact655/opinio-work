-- ============================================================
-- 042: Multitenant company admins — joined_at + is_default
-- ============================================================

-- ── Step A: カラム追加 ──────────────────────────────────────

ALTER TABLE public.ow_company_admins
  ADD COLUMN IF NOT EXISTS joined_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Step B: partial unique index ──────────────────────────

-- user_id IS NOT NULL の条件で pending 招待レコード (user_id IS NULL) を除外。
-- PostgreSQL は NULL = NULL を false とするため IS NULL 行が複数あっても制約は発動しない。
CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_company_per_user
  ON public.ow_company_admins (user_id)
  WHERE is_default = true AND is_active = true AND user_id IS NOT NULL;

-- ── Step C: joined_at バックフィル (ow_user_roles から) ─────

-- ow_user_roles.role='company' と一致する行に created_at (企業登録日時) をセット。
-- 対象: hshiba/Third Box (2026-04-04 11:58) と 柴久人/フリー株式会社 (2026-04-04 12:44) の 2件。
UPDATE public.ow_company_admins ca
SET joined_at = ur.created_at
FROM ow_user_roles ur
JOIN ow_users ou ON ou.auth_id = ur.user_id
WHERE ur.role = 'company'
  AND ur.tenant_id = ca.company_id
  AND ou.id = ca.user_id
  AND ca.user_id IS NOT NULL
  AND ca.is_active = true;

-- ── Step D: joined_at バックフィル (残り → created_at) ──────

-- Step C で埋まらなかった行 (M-3/シードで追加されたユーザー等) は
-- ow_company_admins.created_at を joined_at として使用。
-- now() ではなく created_at を使うことで「実際の参加登録時刻」を保持する。
UPDATE public.ow_company_admins
SET joined_at = created_at
WHERE joined_at IS NULL
  AND user_id IS NOT NULL
  AND is_active = true;

-- ── Step E: is_default バックフィル ─────────────────────────

-- 各 user_id につき joined_at が最も古い (= 最初に参加した) 企業を
-- is_default=true にする。
-- 注意: joined_at が同値の場合、選ばれる行は不定 (PostgreSQL 内部順序依存)。
-- 今回のデータでは 柴久人/フリー株式会社 (2026-04-04) が確実に最古、
-- hshiba は 1件のみなので問題なし。
WITH oldest AS (
  SELECT DISTINCT ON (user_id) id
  FROM public.ow_company_admins
  WHERE is_active = true AND user_id IS NOT NULL
  ORDER BY user_id, joined_at ASC
)
UPDATE public.ow_company_admins ca
SET is_default = true
FROM oldest
WHERE ca.id = oldest.id;
