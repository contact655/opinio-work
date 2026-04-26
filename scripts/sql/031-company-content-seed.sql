-- 企業のtagline / cover_color / why_join をシードデータとして設定
--
-- 【実行手順】Supabase SQL Editor で以下の順に実行してください：
--   1. 030-company-header-image.sql （カラム追加: header_image_url, logo_url, cover_color, tagline, culture_description, why_join）
--   2. 031-company-content-seed.sql  （本ファイル：シードデータ投入）
-- ※ 030 を先に実行しないとカラムが存在せずエラーになります

UPDATE ow_companies SET
  tagline = 'AI問診エンジンで医療DXを推進するヘルステックスタートアップ',
  cover_color = '#e8426a',
  why_join = '医療という社会課題に直接向き合える仕事です。シリーズCフェーズで組織が急拡大中のため、早期にリーダーポジションを狙えます。フルリモートで成果さえ出せば働く場所・時間の自由度が高く、ストックオプションもあります。'
WHERE name LIKE '%Ubie%';

UPDATE ow_companies SET
  tagline = '名刺管理SaaS「Sansan」でビジネスの出会いをイノベーションに',
  cover_color = '#0066cc',
  why_join = '名刺管理という明確なプロダクトで営業しやすく成果が出やすい環境です。上場企業で安定感があり年収・福利厚生のバランスが良く、EightとSansanで多様なキャリアパスがあります。副業OKでフルリモート勤務も可能です。'
WHERE name LIKE '%Sansan%';

UPDATE ow_companies SET
  tagline = '世界最大の検索・広告プラットフォームを日本から支える',
  cover_color = '#4285f4',
  why_join = 'グローバル最前線のプロダクトに携われる唯一無二の環境です。世界水準の福利厚生と年収、フレックス制度で自律的に働けます。英語を使いながらグローバルなキャリアを積みたい方に最適です。'
WHERE name LIKE '%Google%';

UPDATE ow_companies SET
  tagline = 'バクラクで日本の経理・財務DXをリードするFinTechスタートアップ',
  cover_color = '#6366f1',
  why_join = '急成長中のFinTechスタートアップで、市場拡大フェーズの営業・CS職として成果が出やすい環境です。フルリモート×フラットな組織で自律的に動きたい人に合います。ストックオプションもあります。'
WHERE name LIKE '%LayerX%';

UPDATE ow_companies SET
  tagline = 'CRMで世界No.1、営業DXを日本市場でリードする外資SaaS',
  cover_color = '#00a1e0',
  why_join = '世界No.1 CRMを扱う営業経験はキャリアの強力な武器になります。ハイブリッド勤務で年収600〜1000万のレンジ、充実した研修制度で成長できます。Salesforce認定資格の取得支援もあります。'
WHERE name LIKE '%Salesforce%';

UPDATE ow_companies SET
  tagline = '経費精算・人事労務SaaSで中小企業の会計を革新する',
  cover_color = '#00b900',
  why_join = '上場SaaSで安定した基盤を持ちながら、プロダクト数が多くキャリアパスが豊富です。フルリモート勤務可能で副業もOK。会計・財務知識が活かせるユニークなポジションが多数あります。'
WHERE name LIKE '%freee%' OR name LIKE '%フリー%';

UPDATE ow_companies SET
  tagline = 'クラウド人事労務ソフトでHR Techをリードする急成長SaaS',
  cover_color = '#1a9e75',
  why_join = 'HR Tech領域のトップランナーとして急成長中。フルリモートで働きやすく、若手でもリーダーポジションを狙えます。人事・労務の知識が深まり、市場価値が高まるキャリアを築けます。'
WHERE name LIKE '%SmartHR%';

UPDATE ow_companies SET
  tagline = '自然言語処理・画像認識AIをSaaSで提供する東大発AIベンチャー',
  cover_color = '#2d2d2d',
  why_join = '最先端のAI技術を事業に活かせる希少な環境です。東大発のアカデミックな知見とビジネス実装の両方を学べます。研究開発職からビジネス職まで、AI時代のキャリアを築けます。'
WHERE name LIKE '%PKSHA%';

UPDATE ow_companies SET
  tagline = 'Amazonの多様なクラウド・EC事業を日本市場で展開する',
  cover_color = '#ff9900',
  why_join = 'グローバル最大級の企業で世界水準の経験を積めます。AWSやEC事業など多様なプロダクトに携われ、内部転換でキャリアの幅を広げやすい環境です。'
WHERE name LIKE '%Amazon%';

UPDATE ow_companies SET
  tagline = 'Windowsからクラウドまで、エンタープライズITを支える世界最大のソフトウェア企業',
  cover_color = '#00a4ef',
  why_join = 'Microsoft製品という強力なブランドを背景に大手企業へのエンタープライズ営業ができます。外資ならではのグローバルキャリア、充実した福利厚生が魅力です。'
WHERE name LIKE '%マイクロソフト%' OR name LIKE '%Microsoft%';

UPDATE ow_companies SET
  tagline = 'マネーフォワードクラウドで個人・法人のお金の課題を解決する',
  cover_color = '#e8302c',
  why_join = 'フィンテック×SaaSの成長市場でキャリアを築けます。フルリモート可能でエンジニア・PdM職のポジションが充実。技術力を活かしながら社会インパクトのある仕事ができます。'
WHERE name LIKE '%マネーフォワード%' OR name LIKE '%MoneyForward%';

UPDATE ow_companies SET
  tagline = 'ビジネスチャット「Chatwork」で中小企業のDXを推進する',
  cover_color = '#e8652a',
  why_join = '国内最大級のビジネスチャットツールで中小企業のDX支援に携われます。上場企業の安定感と、まだ成長余地が大きい市場での営業経験を積めます。副業OKでフルリモート可能です。'
WHERE name LIKE '%kubell%' OR name LIKE '%Chatwork%';

-- 残りの企業はcover_colorだけ設定（最低限の見た目改善）
UPDATE ow_companies SET cover_color = '#1d6fa5'
WHERE cover_color IS NULL OR cover_color = '';
