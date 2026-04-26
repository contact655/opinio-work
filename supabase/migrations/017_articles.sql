-- 記事テーブル
CREATE TABLE IF NOT EXISTS ow_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  content text,
  summary text,
  cover_image_url text,
  category text,
  tags text[],
  is_published boolean DEFAULT false,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ow_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read published articles"
  ON ow_articles FOR SELECT
  USING (is_published = true);

-- サンプル記事3件
INSERT INTO ow_articles
  (title, slug, summary, category, tags, is_published, published_at)
VALUES
  (
    'SaaS営業に転職するために必要なスキルとは',
    'saas-sales-skills',
    'SaaS業界の営業職に転職するために必要なスキルと経験を、現役エージェントが解説します。',
    'キャリア',
    ARRAY['SaaS', '営業', '転職'],
    true,
    now()
  ),
  (
    'カスタマーサクセスとは？仕事内容と年収を徹底解説',
    'customer-success-guide',
    'カスタマーサクセス（CS）の仕事内容、求められるスキル、年収相場をわかりやすく解説します。',
    'キャリア',
    ARRAY['カスタマーサクセス', 'SaaS', 'キャリア'],
    true,
    now()
  ),
  (
    'IT転職で失敗しないための3つのポイント',
    'it-career-change-tips',
    '転職活動でよくある失敗パターンと、それを避けるための具体的な対策を紹介します。',
    '転職ノウハウ',
    ARRAY['転職', 'IT', 'ノウハウ'],
    true,
    now()
  )
ON CONFLICT (slug) DO NOTHING;
