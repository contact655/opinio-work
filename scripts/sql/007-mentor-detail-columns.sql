-- Add detail columns to mentors table
ALTER TABLE mentors ADD COLUMN IF NOT EXISTS career_history jsonb;
ALTER TABLE mentors ADD COLUMN IF NOT EXISTS consultation_cases jsonb;

-- Seed 柴さんの詳細データ
UPDATE mentors
SET
  bio = 'Recruit・Salesforce Japanで10年間、法人営業・インサイドセールスを経験。2023年にOpinioを創業。国家資格キャリアコンサルタント・ICFコーチング資格を保有。「転職すべきか」から「どう交渉するか」まで、本音で話せる場を作りたいと思ってメンターをしています。',
  career_history = '[
    {"year": "2014", "company": "株式会社リクルート", "role": "法人営業", "duration": "4年"},
    {"year": "2018", "company": "Salesforce Japan", "role": "インサイドセールス → フィールドセールス", "duration": "6年"},
    {"year": "2023", "company": "Opinio株式会社", "role": "CEO・創業", "duration": "現在"}
  ]',
  consultation_cases = '[
    {"category": "キャリアチェンジ", "situation": "SIer営業5年目。SaaSに転職したいが未経験で不安。", "comment": "SIer営業の提案力はSaaSエンタープライズ営業でそのまま活きます。むしろSIer出身者を求めている企業が多い。"},
    {"category": "年収交渉", "situation": "CS5年目。転職で年収を上げたいが相場がわからない。", "comment": "SaaS CS5年・エンプラ対応経験ありなら600〜750万が相場。今の480万は明らかに低い。"}
  ]'
WHERE name LIKE '%柴%';

-- 田中さん
UPDATE mentors
SET
  career_history = '[
    {"year": "2016", "company": "株式会社キーエンス", "role": "法人営業", "duration": "3年"},
    {"year": "2019", "company": "Salesforce Japan", "role": "エンタープライズ営業", "duration": "現在"}
  ]',
  consultation_cases = '[
    {"category": "外資転職", "situation": "日系メーカー営業3年。外資SaaSに挑戦したいが英語力が不安。", "comment": "Salesforceの日本法人は日本語メインです。英語より大事なのはエンプラ提案力。"}
  ]'
WHERE name LIKE '%田中%';

-- 佐藤さん
UPDATE mentors
SET
  career_history = '[
    {"year": "2017", "company": "株式会社リクルート", "role": "カスタマーサクセス", "duration": "3年"},
    {"year": "2020", "company": "HubSpot Japan", "role": "カスタマーサクセスマネージャー", "duration": "現在"}
  ]',
  consultation_cases = '[
    {"category": "キャリアチェンジ", "situation": "営業5年目。CSに興味があるが未経験でも転職できるか。", "comment": "営業経験者のCS転職は非常に相性がいい。顧客理解力がそのまま活きます。"}
  ]'
WHERE name LIKE '%佐藤%';
