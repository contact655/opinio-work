-- Migration 164: company_features データ投入
-- ow_companies.company_features (JSONB) に業種別カルチャータグを設定
-- 手動適用: Supabase ダッシュボード → SQL Editor で実行

-- Step 1: 業種ベースの一括設定
UPDATE ow_companies SET company_features = CASE
  WHEN industry = 'AI Tech'
    THEN to_jsonb(ARRAY['AIファースト', 'グローバル企業', '英語環境', 'テックリード'])
  WHEN industry IN ('CRM', 'CRM/SaaS')
    THEN to_jsonb(ARRAY['グローバル企業', '英語必須', '顧客成功文化', '成果主義'])
  WHEN industry = 'HR Tech'
    THEN to_jsonb(ARRAY['HR領域特化', 'データ活用', '人材市場', 'SaaS'])
  WHEN industry = 'セキュリティ'
    THEN to_jsonb(ARRAY['サイバーセキュリティ', 'グローバル', '技術力重視', '英語環境'])
  WHEN industry = 'コラボレーション'
    THEN to_jsonb(ARRAY['非同期文化', 'リモートワーク推進', 'グローバル', 'コラボ重視'])
  WHEN industry = 'クラウドインフラ'
    THEN to_jsonb(ARRAY['クラウドネイティブ', 'インフラ専門', 'グローバル', '技術力重視'])
  WHEN industry = 'DevTools'
    THEN to_jsonb(ARRAY['開発者向け', 'OSS文化', 'アジャイル', 'グローバル'])
  WHEN industry = 'FinTech/SaaS'
    THEN to_jsonb(ARRAY['フィンテック', 'グローバル', '金融×テック', 'SaaS'])
  WHEN industry = 'エンタープライズIT'
    THEN to_jsonb(ARRAY['大企業向け', 'ERP/基幹系', 'グローバル', 'コンサル色'])
  WHEN industry = 'ハードウェア'
    THEN to_jsonb(ARRAY['グローバル最大手', 'ハードウェア', 'デバイス', '安定基盤'])
  WHEN industry = 'Sales Tech'
    THEN to_jsonb(ARRAY['営業特化', 'SaaS', 'データドリブン', '成長市場'])
  WHEN industry IN ('データベース', 'データベース・ERP')
    THEN to_jsonb(ARRAY['データエンジニアリング', 'クラウド', 'グローバル', '技術力重視'])
  WHEN industry = 'データストリーミング'
    THEN to_jsonb(ARRAY['リアルタイムデータ', 'Kafka', 'グローバル', 'データパイプライン'])
  WHEN industry = 'ワークフロー自動化'
    THEN to_jsonb(ARRAY['業務自動化', 'DX推進', 'ローコード', 'グローバル'])
  WHEN industry = 'ConTech'
    THEN to_jsonb(ARRAY['建設×テック', 'スタートアップ', '現場改革', '国内先行'])
  WHEN industry = '顧客コミュニケーション'
    THEN to_jsonb(ARRAY['顧客対応', 'CX改善', 'SaaS', 'カスタマーサクセス'])
  WHEN industry = 'クリエイティブ'
    THEN to_jsonb(ARRAY['クリエイター向け', 'デザイン重視', 'グローバル', 'クリエイティブ'])
  WHEN industry = '半導体'
    THEN to_jsonb(ARRAY['半導体専門', 'グローバル', 'ハードウェア', 'R&D重視'])
  WHEN industry LIKE '%SNS%' OR industry LIKE '%メタバース%'
    THEN to_jsonb(ARRAY['グローバル最大規模', 'ソーシャルメディア', 'メタバース', 'AI投資中'])
  WHEN industry = 'モビリティ'
    THEN to_jsonb(ARRAY['シェアリングエコノミー', 'グローバル', 'MaaS', 'プラットフォーム'])
  WHEN industry = 'プロジェクト管理'
    THEN to_jsonb(ARRAY['コラボ重視', 'リモートワーク可', 'グローバル', '生産性向上'])
  WHEN industry = 'MAツール'
    THEN to_jsonb(ARRAY['マーケティング自動化', 'B2B SaaS', 'グローバル', '英語環境'])
  WHEN industry IN ('コンテンツ管理', 'ファイル共有')
    THEN to_jsonb(ARRAY['クラウドストレージ', 'コラボレーション', 'グローバル', 'リモートワーク可'])
  WHEN industry = '電子署名'
    THEN to_jsonb(ARRAY['デジタル変革', '契約DX', 'グローバル', 'コンプライアンス'])
  WHEN industry LIKE '%オブザーバビリティ%'
    THEN to_jsonb(ARRAY['オブザーバビリティ', 'DevOps/SRE', 'グローバル', 'エンジニアリング重視'])
  WHEN industry = 'デジタルアダプション'
    THEN to_jsonb(ARRAY['DAP', 'デジタル採用支援', 'グローバル', 'SaaS'])
  WHEN industry IN ('財務会計', '財務・ERP')
    THEN to_jsonb(ARRAY['財務・会計', 'ERP', 'グローバル', '大企業向け'])
  WHEN industry = 'インシデント管理'
    THEN to_jsonb(ARRAY['インシデント対応', 'DevOps', 'グローバル', 'SRE'])
  WHEN industry = '調達管理'
    THEN to_jsonb(ARRAY['調達・購買管理', 'グローバル', '大企業向け', 'SaaS'])
  WHEN industry = '経費精算'
    THEN to_jsonb(ARRAY['経費管理', 'T&E管理', 'グローバル', 'SaaS'])
  WHEN industry = 'API管理'
    THEN to_jsonb(ARRAY['API管理', '開発者向け', 'グローバル', 'プラットフォーム'])
  ELSE to_jsonb(ARRAY['グローバル企業', 'SaaS', 'テック', '英語環境'])
END
WHERE is_published = true;

-- Step 2: 主要企業の個別上書き（カルチャーが有名な企業）
UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['オハナ文化', 'CRM世界最大手', '英語必須', '成果主義', 'V2MOM'])
WHERE name ILIKE '%セールスフォース%' OR name ILIKE '%Salesforce%';

UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['HEART文化', 'インバウンドマーケ', '透明性重視', '英語環境', '成長機会多い'])
WHERE name ILIKE '%HubSpot%';

UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['20%ルール', 'データドリブン', 'AI最先端', 'グローバル最大手', '採用基準高め'])
WHERE name ILIKE '%グーグル%' OR name ILIKE '%Google%';

UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['Growth Mindset', 'クラウドリーダー', 'DX支援', 'グローバル', '安定大手'])
WHERE name ILIKE '%マイクロソフト%' OR name ILIKE '%Microsoft%';

UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['AI安全研究', '最先端AI', 'ミッション重視', '少数精鋭', 'グローバル'])
WHERE name ILIKE '%アンソロピック%' OR name ILIKE '%Anthropic%';

UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['AGI開発', 'AI最前線', 'グローバル', 'スーパーユニコーン', 'ミッション重視'])
WHERE name ILIKE '%OpenAI%';

UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['NVIDIA', 'GPU/AIチップ', 'データセンター', 'グローバル', '急成長'])
WHERE name ILIKE '%エヌビディア%' OR name ILIKE '%NVIDIA%';

UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['Zero Trust', 'SASEリーダー', 'グローバル', 'セキュリティ最前線', '急成長上場'])
WHERE name ILIKE '%ゼットスケーラー%' OR name ILIKE '%Zscaler%';

UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['スポーツ好き歓迎', '営業起点カルチャー', 'CSM重視', 'グローバル', 'B2B SaaS'])
WHERE name ILIKE '%ゲインサイト%' OR name ILIKE '%Gainsight%';

UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['クラウドデータウェアハウス', 'AI/ML', 'グローバル', '上場後も急成長', 'データ経済'])
WHERE name ILIKE '%スノーフレーク%' OR name ILIKE '%Snowflake%';

UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['ユニコーン', 'Building Platform', 'API経済', 'グローバル', 'データドリブン'])
WHERE name ILIKE '%ダタブリックス%' OR name ILIKE '%Databricks%';

-- Step 3: 日本国内スタートアップ
UPDATE ow_companies SET company_features =
  to_jsonb(ARRAY['国内スタートアップ', '急成長', 'ミッションドリブン', 'フラット組織', 'SaaS'])
WHERE is_published = true AND (phase IS NULL OR phase NOT IN ('listed', '上場'));

-- 確認
SELECT name, company_features FROM ow_companies WHERE is_published = true ORDER BY name LIMIT 10;
