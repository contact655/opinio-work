-- Migration 137: Enrich company data for Salesforce, Timee, Thinca

-- Salesforce Japan
UPDATE ow_companies SET
  avg_salary    = '900万円〜',
  fit_positives = '["グローバルキャリア", "Ohana文化", "充実した研修制度", "高い報酬水準"]'::jsonb,
  fit_negatives = '["外資系カルチャー", "目標管理が厳格", "英語力が求められる場面あり"]'::jsonb
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';

-- Timee
UPDATE ow_companies SET
  avg_salary    = '600万円〜',
  fit_positives = '["上場スタートアップ", "急成長SaaS", "裁量が大きい", "社会インパクト大"]'::jsonb,
  fit_negatives = '["変化が激しい", "制度整備中の部分あり"]'::jsonb
WHERE id = '2e54ff06-2f4d-420c-9a5c-9a80a85ca55a';

-- Thinca (シンカ)
UPDATE ow_companies SET
  avg_salary    = '500万円〜',
  fit_positives = '["上場直後グロース", "顧客継続率99.7%", "小規模で裁量大きい"]'::jsonb,
  fit_negatives = '["知名度がまだ低め", "小規模組織"]'::jsonb
WHERE id = '28b826eb-fb86-4124-aa08-c489cad662f1';
