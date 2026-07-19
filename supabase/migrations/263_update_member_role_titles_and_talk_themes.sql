-- Migration 263: role_title を職種名に更新 + 生藤さんの talk_themes 設定

-- 生藤 弘樹（Salesforce）: 既に職種名 + talk_themes を設定
UPDATE ow_company_members
SET talk_themes = ARRAY[
  'エンタープライズ営業のキャリア',
  '外資系IT企業への転職',
  'Salesforceの仕事・職場環境',
  'SaaS営業スキルの磨き方'
]
WHERE id = '2f28115a-f62f-4896-b368-250438647a1f'; -- 生藤 弘樹

-- 福永陽貴（HP）: 部門名 → 職種名
UPDATE ow_company_members
SET role_title = 'セールス（デジタルセールス）'
WHERE id = 'b045aa0c-d297-4d1c-bbda-277098765425'; -- 福永陽貴

-- 大塚悠貴（海光電業）: 部門名 → 職種名
UPDATE ow_company_members
SET role_title = '営業'
WHERE id = '0243cf79-2e06-4e92-842d-2aae06e9000c'; -- 大塚悠貴

-- 木村雅樹（CTC）: 部門名 → 職種名
UPDATE ow_company_members
SET role_title = '営業（金融ソリューション）'
WHERE id = '89639006-033b-44bc-8c32-121adc2437e0'; -- 木村雅樹
