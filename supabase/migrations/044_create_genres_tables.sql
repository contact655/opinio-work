-- 044_create_genres_tables.sql
-- 企業ジャンル機能：マスターテーブルと中間テーブルを作成
-- 段階：genres-feature Phase A

CREATE TABLE IF NOT EXISTS ow_genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ow_genres_active_order
  ON ow_genres(is_active, display_order)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS ow_company_genres (
  company_id uuid NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  genre_id   uuid NOT NULL REFERENCES ow_genres(id)   ON DELETE CASCADE,
  ai_confidence    numeric(3,2),
  is_ai_suggested  boolean NOT NULL DEFAULT false,
  is_human_approved boolean NOT NULL DEFAULT false,
  approved_by  uuid REFERENCES ow_users(id),
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, genre_id)
);

CREATE INDEX idx_ow_company_genres_genre_approved
  ON ow_company_genres(genre_id, is_human_approved)
  WHERE is_human_approved = true;

CREATE INDEX idx_ow_company_genres_company
  ON ow_company_genres(company_id);

ALTER TABLE ow_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_company_genres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active genres"
  ON ow_genres FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can read approved company genres"
  ON ow_company_genres FOR SELECT
  USING (is_human_approved = true);

-- update_updated_at_column は既存 DB に定義済み（pg_proc 確認済み）
CREATE TRIGGER set_updated_at_ow_genres
  BEFORE UPDATE ON ow_genres
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
