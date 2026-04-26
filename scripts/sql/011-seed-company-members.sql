-- サンプルデータ: Sansan株式会社の社員・OB
-- ※ UNIQUE(user_id, company_id) 制約があるため、同じユーザーで複数投入する場合は
--    user_id を変えるか、制約を一時的に外す必要がある

-- サンプル1: 現役社員
INSERT INTO company_members
  (user_id, company_id, name, status, role, department, joined_year, left_year, experience, good_points, hard_points, is_public)
VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM ow_companies WHERE name = 'Sansan株式会社' LIMIT 1),
  '田中 拓也',
  'current',
  'エンタープライズ営業',
  '大手企業営業部',
  2021,
  NULL,
  '大手製造業・金融機関へのSansan導入提案を担当。1社あたりの導入規模が大きく、複数部署を巻き込んだ提案が求められる。初年度はインサイドセールスと連携しながら新規開拓を学び、2年目からは自分でターゲット企業を選定して商談を進める形に。決裁者へのアプローチ方法や稟議の通し方など、エンタープライズ特有のスキルが身についた。',
  'プロダクトの知名度が高いので初回アポが取りやすい。上場企業なので福利厚生がしっかりしていて、副業もOKなので副業でスキルアップしながら働けている。チームの雰囲気がフラットで、年次関係なく意見を言いやすい。',
  'ターゲットが大企業に偏るため、スタートアップや中小企業への提案経験は積みにくい。名刺管理というカテゴリ自体の啓蒙が必要な場面もあり、提案に時間がかかることがある。',
  true
);

-- サンプル2: OB（退社済み）
INSERT INTO company_members
  (user_id, company_id, name, status, role, department, joined_year, left_year, experience, good_points, hard_points, is_public)
VALUES (
  (SELECT id FROM auth.users OFFSET 1 LIMIT 1),
  (SELECT id FROM ow_companies WHERE name = 'Sansan株式会社' LIMIT 1),
  '佐藤 美穂',
  'alumni',
  'カスタマーサクセス',
  'CSM（カスタマーサクセスマネージャー）',
  2019,
  2023,
  'SMB〜中堅企業のカスタマーサクセスを担当。オンボーディングから活用支援・契約更新まで一気通貫で対応。担当社数は常時40〜50社で、定期MTGや活用レポートの作成が主な業務。Eightとのクロスセル提案も経験した。退職後はSaaS系スタートアップのCS責任者へ転職。',
  'CSの型が整っていて、入社後すぐに動けるようにオンボーディングプログラムが充実している。CSとしてのキャリアを体系的に学べる環境だった。Eight・Sansanという2つのプロダクトを扱えるのでキャリアの幅が広がる。',
  '担当社数が多いため、一社一社に深く入り込む時間が取りにくい場面もあった。成熟したプロダクトなのでCS施策の新鮮さより運用効率を求められることが多く、新しいことに挑戦したい人には物足りなく感じることも。',
  true
);

-- サンプル3: OB（退社済み）
INSERT INTO company_members
  (user_id, company_id, name, status, role, department, joined_year, left_year, experience, good_points, hard_points, is_public)
VALUES (
  (SELECT id FROM auth.users OFFSET 2 LIMIT 1),
  (SELECT id FROM ow_companies WHERE name = 'Sansan株式会社' LIMIT 1),
  '鈴木 健一',
  'alumni',
  'インサイドセールス',
  'IS（インサイドセールス）',
  2020,
  2022,
  '中堅〜大手企業へのアウトバウンド架電・メール営業を担当。月300〜400件のアプローチで、アポイント獲得率の改善に取り組んだ。SalesforceとMarketoを使いこなす経験ができ、MA・SFAの実務スキルが身についた。フィールドセールスへの異動も視野に入れながら働いていたが、スタートアップへの興味が強くなり退職。',
  'ISとしての基礎力が徹底的に鍛えられる。トークスクリプトのABテストや架電ログの分析など、データドリブンなIS手法を実践できる。ツール環境が整っていて、営業DXの最前線を経験できる。',
  'IS→FSへの異動タイミングは会社の状況に左右されることがある。ルーティン業務が多くなりやすいので、自分から動かないと成長が止まるリスクがある。',
  true
);
