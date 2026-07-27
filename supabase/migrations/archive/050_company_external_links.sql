-- ============================================================================
-- 050: ow_company_external_links — 企業発信リンク機能
-- ============================================================================
-- 目的: 各企業に紐づく外部発信コンテンツを管理するテーブル
--       BIZ admin と Opinio 編集部 (admin) の両方が独立して登録可能
--
-- 設計判断:
--   - type カラム: article / video / audio / social / event / other で区別
--   - created_by_role: 'company'(BIZ admin) / 'editor'(Opinio 編集部) でバッジ制御
--   - RLS: auth_is_company_member() / auth_is_admin() を再利用 (migration 037/036 定義)
--   - updated_at trigger: 既存テーブルは DEFAULT NOW() のみのため個別に作成
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trigger_update_ow_company_external_links_updated_at ON ow_company_external_links;
--   DROP FUNCTION IF EXISTS update_ow_company_external_links_updated_at();
--   DROP TABLE IF EXISTS ow_company_external_links;
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. テーブル作成
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE ow_company_external_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,

  -- コンテンツ識別
  url             text NOT NULL,
  type            text NOT NULL
    CHECK (type IN ('article', 'video', 'audio', 'social', 'event', 'other')),

  -- 表示情報 (OGP 自動取得 + 編集可能)
  title           text NOT NULL,
  description     text,
  thumbnail_url   text,
  source_name     text,
  published_at    timestamptz,

  -- 投稿者情報
  created_by_role    text NOT NULL
    CHECK (created_by_role IN ('company', 'editor')),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- メタ
  is_published    boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. インデックス
-- ─────────────────────────────────────────────────────────────────────────────

-- 企業ごとに公開日順で取得する高頻度クエリに最適化
-- (企業詳細ページの「発信リンク」セクション)
CREATE INDEX idx_ow_company_external_links_company_published
  ON ow_company_external_links(company_id, is_published, published_at DESC NULLS LAST);

-- 全社横断の発信一覧 (Phase C 別タスク向け、今は使わないが将来用)
CREATE INDEX idx_ow_company_external_links_published_at
  ON ow_company_external_links(is_published, published_at DESC NULLS LAST)
  WHERE is_published = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. updated_at 自動更新 trigger
-- ─────────────────────────────────────────────────────────────────────────────
-- 既存テーブルは DEFAULT NOW() のみでアプリ側更新に依存しているが、
-- 本テーブルは BIZ / admin 双方から更新されるため trigger で保証する。

CREATE OR REPLACE FUNCTION update_ow_company_external_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ow_company_external_links_updated_at
  BEFORE UPDATE ON ow_company_external_links
  FOR EACH ROW
  EXECUTE FUNCTION update_ow_company_external_links_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
-- RLS ヘルパー関数の利用:
--   auth_is_company_member(uuid) — migration 037 定義 (SECURITY DEFINER, row_security=off)
--   auth_is_admin()              — migration 036 定義 (SECURITY DEFINER, row_security=off)

ALTER TABLE ow_company_external_links ENABLE ROW LEVEL SECURITY;

-- 求職者・未認証: is_published = true のリンクは SELECT 可
CREATE POLICY "company_external_links_public_read"
  ON ow_company_external_links
  FOR SELECT
  USING (is_published = true);

-- 企業 admin (permission='admin'): 自社のリンクは全アクション可
--   auth_is_company_admin() が ow_company_admins JOIN ow_users で permission='admin' AND auth_id = auth.uid() を照合
--   (会社情報・オフィス写真 migration 038 と同じ admin 限定方針)
CREATE POLICY "company_external_links_company_manage"
  ON ow_company_external_links
  FOR ALL
  USING (auth_is_company_admin(company_id))
  WITH CHECK (auth_is_company_admin(company_id));

-- Opinio 編集部 (ow_user_roles.role='admin'): 全企業のリンクを全アクション可
--   auth_is_admin() が ow_user_roles.user_id = auth.uid() AND role='admin' を照合
CREATE POLICY "company_external_links_editor_manage"
  ON ow_company_external_links
  FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. コメント
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE ow_company_external_links IS
  '企業発信リンク: 各企業に紐づく外部発信コンテンツ。BIZ admin と Opinio 編集部が独立して登録可能。';
COMMENT ON COLUMN ow_company_external_links.type IS
  'article | video | audio | social | event | other';
COMMENT ON COLUMN ow_company_external_links.created_by_role IS
  'company (BIZ admin が登録) | editor (Opinio 編集部が登録)';
COMMENT ON COLUMN ow_company_external_links.thumbnail_url IS
  'OGP 画像 URL。元サイトの URL を直接保存 (Storage コピーは将来対応)';
COMMENT ON COLUMN ow_company_external_links.sort_order IS
  '手動並び順。0 = デフォルト。published_at と組み合わせて表示順を制御';
