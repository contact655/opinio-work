-- Migration 216: ow_company_reviews に評価軸3カラム追加
-- 既存5軸: rating_overall, rating_culture, rating_growth, rating_wlb, rating_compensation
-- 追加3軸: rating_leadership, rating_business, rating_welfare

ALTER TABLE ow_company_reviews
  ADD COLUMN IF NOT EXISTS rating_leadership SMALLINT CHECK (rating_leadership BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_business   SMALLINT CHECK (rating_business   BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_welfare    SMALLINT CHECK (rating_welfare    BETWEEN 1 AND 5);

COMMENT ON COLUMN ow_company_reviews.rating_leadership IS 'リーダーシップ：経営・マネジメントの質（1-5, nullable）';
COMMENT ON COLUMN ow_company_reviews.rating_business   IS 'ビジネス展望：将来性・成長性（1-5, nullable）';
COMMENT ON COLUMN ow_company_reviews.rating_welfare    IS '福利厚生：制度と実際の活用（1-5, nullable）';
