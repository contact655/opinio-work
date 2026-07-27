-- Cloud/SaaS → 外資系企業 に一括置換
-- 理由: "Cloud/SaaS" はプラットフォーム全体のコンセプトと同義で情報ゼロ。
--       該当37社はほぼ全て外資系企業のため「外資系企業」が正確かつ意味あるラベル。
UPDATE ow_companies
SET industry = '外資系企業'
WHERE industry = 'Cloud/SaaS';
