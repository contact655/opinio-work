-- 企業コンテンツ管理テーブル（AI一括インポート用）
CREATE TABLE company_contents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  company_id uuid REFERENCES ow_companies(id) ON DELETE CASCADE NOT NULL,

  -- 12項目のカテゴリ
  category text NOT NULL CHECK (category IN (
    'overview',
    'numbers',
    'culture',
    'job_description',
    'hiring_flow',
    'ideal_person',
    'interview',
    'voices',
    'daily_schedule',
    'benefits',
    'salary',
    'training'
  )),

  -- コンテンツ本体
  content jsonb NOT NULL DEFAULT '{}',

  -- 出所
  source text NOT NULL CHECK (source IN ('ai', 'manual')),
  source_file text,

  -- ステータス
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'published')),

  -- 公開設定
  auto_publish boolean DEFAULT false,

  UNIQUE(company_id, category)
);

-- RLS
ALTER TABLE company_contents ENABLE ROW LEVEL SECURITY;

-- 公開済みコンテンツは誰でも閲覧可能
CREATE POLICY "Published contents viewable by all"
  ON company_contents FOR SELECT
  USING (status = 'published');

-- 認証済みユーザーは全操作可能（企業管理者チェックはアプリ側で実施）
CREATE POLICY "Authenticated users can manage contents"
  ON company_contents FOR ALL
  USING (auth.uid() IS NOT NULL);
