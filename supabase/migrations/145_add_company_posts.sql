-- Migration 145: 企業ストーリー投稿（Wantedly Stories相当）
-- 企業担当者がタイトル・本文・カテゴリを自由に投稿できる

CREATE TABLE IF NOT EXISTS ow_company_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  author_user_id  UUID REFERENCES ow_users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'culture',
  -- category: culture / interview / event / product / hiring / other
  cover_image_url TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_company_posts_company_id ON ow_company_posts(company_id);
CREATE INDEX IF NOT EXISTS idx_company_posts_published ON ow_company_posts(is_published, published_at DESC);

-- RLS
ALTER TABLE ow_company_posts ENABLE ROW LEVEL SECURITY;

-- 公開された投稿は全員が閲覧可能
CREATE POLICY "public_read_published_posts"
  ON ow_company_posts FOR SELECT
  USING (is_published = true);

-- 企業管理者は自社の全投稿を閲覧・編集可能
CREATE POLICY "company_admin_all"
  ON ow_company_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ow_user_roles ur
      WHERE ur.user_id = (
        SELECT ou.id FROM ow_users ou WHERE ou.auth_id = auth.uid() LIMIT 1
      )
      AND ur.tenant_id = ow_company_posts.company_id
      AND ur.role IN ('admin', 'editor', 'recruiter')
    )
  );
