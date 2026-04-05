-- ============================================================
-- mentorsテーブル作成 + サンプルデータ
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

CREATE TABLE IF NOT EXISTS mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  avatar_initial text,
  avatar_color text DEFAULT '#1D9E75',
  current_company text,
  current_role text,
  previous_career text,
  current_career text,
  roles text[],
  worries text[],
  bio text,
  concerns text[],
  calendly_url text,
  is_available boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE mentors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mentors' AND policyname='public_read_mentors') THEN
    CREATE POLICY public_read_mentors ON mentors FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mentors' AND policyname='service_role_all_mentors') THEN
    CREATE POLICY service_role_all_mentors ON mentors FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- サンプルデータ（10名）
INSERT INTO mentors (name, avatar_initial, avatar_color, current_company, current_role, previous_career, current_career, roles, worries, bio, concerns, calendly_url, is_available, display_order) VALUES
('田中 美咲', '田', '#1D9E75', 'Salesforce Japan', 'エンタープライズ営業', '大手メーカー営業', '外資SaaS営業', ARRAY['営業'], ARRAY['転職タイミング','年収交渉','外資転職'], '外資SaaSへの転職で年収300万円アップを経験。エンタープライズ営業歴5年。外資転職のリアルを詳しく話せます。', ARRAY['外資SaaSへの転職の進め方','年収交渉で失敗したくない','転職のタイミングがわからない'], 'https://calendly.com/dummy/30min', true, 1),
('佐藤 健', '佐', '#00A1E0', 'HubSpot Japan', 'カスタマーサクセス', 'SIer営業', 'SaaS CS', ARRAY['CS'], ARRAY['キャリアチェンジ','転職タイミング','スタートアップ'], 'SIer営業からSaaS CSへのキャリアチェンジを経験。CSとして3年、現在はチームリード。', ARRAY['営業からCSに転身できるの？','CSのキャリアパスが知りたい','SaaS CSの実際の仕事内容'], 'https://calendly.com/dummy/30min', true, 2),
('鈴木 陽子', '鈴', '#FF7A59', 'Zoho Japan', 'インサイドセールス', '人材業界IS', 'SaaS IS', ARRAY['営業'], ARRAY['転職タイミング','スタートアップ','年収交渉'], '人材業界ISからSaaS ISに転職。BDRチームのリードとして活躍中。', ARRAY['IS経験でSaaSに転職できる？','ベンチャーと大手どっちがいい？','年収を維持しながら転職したい'], 'https://calendly.com/dummy/30min', true, 3),
('高橋 翔太', '高', '#7C3AED', 'SmartHR', 'BizDev / 事業開発', '総合商社', 'SaaS事業開発', ARRAY['事業開発'], ARRAY['キャリアチェンジ','スタートアップ','転職タイミング'], '総合商社からSaaSスタートアップへ転身。事業開発として新規プロダクトの立ち上げを担当。', ARRAY['商社からSaaSに行けるの？','スタートアップの働き方のリアル','事業開発の仕事内容を知りたい'], 'https://calendly.com/dummy/30min', true, 4),
('山田 恵理', '山', '#EC4899', 'HubSpot Japan', 'マーケティングマネージャー', '広告代理店', 'SaaSマーケ', ARRAY['マーケ'], ARRAY['キャリアチェンジ','年収交渉','外資転職'], '広告代理店からSaaSマーケへ。デマンドジェネレーション領域で5年の経験。', ARRAY['代理店経験はSaaSで活かせる？','マーケのキャリアパス','外資SaaSマーケの実際'], 'https://calendly.com/dummy/30min', true, 5),
('中村 大輔', '中', '#F97316', 'マネーフォワード', 'フィールドセールス', '金融機関営業', 'SaaS営業', ARRAY['営業'], ARRAY['転職タイミング','年収交渉','キャリアチェンジ'], '銀行の法人営業からSaaS営業に転職。金融知識を活かしてFinTech SaaSで活躍中。', ARRAY['金融業界からSaaSに転職できる？','年収は下がる？','30代でも転職できる？'], 'https://calendly.com/dummy/30min', true, 6),
('伊藤 麻衣', '伊', '#14B8A6', 'Ubie', 'カスタマーサクセス', 'コンサル', 'SaaS CS', ARRAY['CS'], ARRAY['外資転職','キャリアチェンジ','スタートアップ'], 'コンサルファームからヘルステックSaaSのCSに転身。スタートアップでのCS立ち上げ経験あり。', ARRAY['コンサルからCSへの転身','スタートアップCSの立ち上げ方','CS組織のキャリアパス'], 'https://calendly.com/dummy/30min', true, 7),
('小林 慎一', '小', '#6366F1', 'LayerX', 'インサイドセールス', 'IT営業', 'SaaS IS', ARRAY['営業'], ARRAY['スタートアップ','転職タイミング','年収交渉'], 'IT企業の営業からSaaSスタートアップのISへ。急成長フェーズでのIS組織構築を経験。', ARRAY['スタートアップISのリアル','IS→AEへのキャリアパス','急成長企業で働く面白さ'], 'https://calendly.com/dummy/30min', true, 8),
('渡辺 あかり', '渡', '#F43F5E', 'Sansan', 'コンテンツマーケティング', '出版業界', 'SaaSマーケ', ARRAY['マーケ'], ARRAY['キャリアチェンジ','転職タイミング'], '出版社の編集者からSaaSコンテンツマーケへ転身。ライティングスキルを活かした転職事例。', ARRAY['編集経験はSaaSで活かせる？','コンテンツマーケの具体的な仕事','異業種からSaaSへの転職方法'], 'https://calendly.com/dummy/30min', true, 9),
('柴 久人', '柴', '#1D9E75', 'Opinio株式会社', 'CEO / キャリアコンサルタント', 'Recruit · Salesforce', '起業', ARRAY['営業','CS','事業開発'], ARRAY['転職タイミング','年収交渉','外資転職','キャリアチェンジ','スタートアップ'], 'Recruit4年・Salesforce 6年を経て独立。国家資格キャリアコンサルタント・ICFコーチ。IT/SaaS転職全般の相談を受付。', ARRAY['転職すべきか迷っている','どの会社が自分に合うか','年収を大幅に上げたい'], 'https://calendly.com/hshiba/30min', true, 10);
