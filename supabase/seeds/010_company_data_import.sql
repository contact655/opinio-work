-- =============================================================================
-- 企業データ インポート（2026-05-28）
-- 対象: 10社（既存2社UPDATE + 新規8社INSERT）
-- 実行方法: Supabase SQL Editor で実行
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ① 既存2社を更新
-- ─────────────────────────────────────────────────────────────────────────────

-- 株式会社Opinio（id: cf44d740-b835-454d-91a3-f1e2eddc7251）
UPDATE ow_companies SET
  name_en               = 'Opinio Inc.',
  founded_year          = 2023,
  employee_count        = '〜10名',
  location              = '東京都',
  industry              = 'HR Tech',
  funding_stage         = 'seed',
  url                   = 'https://opinio.co.jp/',
  mission               = '信頼経済をつくるTech Company',
  description           = 'IT・SaaS業界に特化したキャリアプラットフォーム「OPINIO」を運営。求職者と企業の双方にとって信頼できる情報をもとに、納得感ある就職・採用を支援する。スカウト不要・透明な情報設計で、本当に合う出会いを実現。',
  tagline               = 'IT/SaaS業界の、信頼できるキャリアプラットフォーム',
  logo_letter           = 'O',
  logo_gradient         = 'linear-gradient(135deg, #002366, #3B5FD9)',
  remote_work_status    = 'hybrid',
  flex_time             = true,
  side_job_ok           = true,
  ceo_name              = '柴 久人',
  has_stock_option      = true,
  why_join              = 'IT・SaaS業界特化のキャリアプラットフォームを少数精鋭で作り上げる経験ができます。プロダクト・ビジネス双方に深く関わりながら、業界の採用・転職の在り方を変えていく仕事です。',
  culture_description   = '徹底した透明性と正直さを大切にする文化。「信頼経済」の実現に向けて、メンバー全員がプロダクトオーナーとして動いています。',
  is_published          = true,
  accepting_casual_meetings = true,
  updated_at            = now()
WHERE id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';

-- 株式会社セールスフォース・ジャパン（id: c3664ef1-5571-4645-b30f-1474e7961c17）
UPDATE ow_companies SET
  name_en               = 'Salesforce Japan Co., Ltd.',
  founded_year          = 2000,
  employee_count        = '3500名以上',
  location              = '東京都',
  industry              = 'SaaS / CRM',
  funding_stage         = 'listed',
  url                   = 'https://www.salesforce.com/jp/',
  mission               = 'We bring companies and customers together.',
  description           = '世界No.1のCRMプラットフォーム「Salesforce」を日本で展開。営業・マーケティング・カスタマーサービス領域のクラウドサービスをエンタープライズから中小企業まで幅広く提供。グローバル83,000名以上が在籍する米国上場企業の日本法人。',
  tagline               = '世界No.1 CRMで、ビジネスの未来を変える',
  logo_letter           = 'S',
  logo_gradient         = 'linear-gradient(135deg, #00A1E0, #0D74B8)',
  remote_work_status    = 'hybrid',
  flex_time             = true,
  side_job_ok           = false,
  ceo_name              = '小出 伸一',
  has_stock_option      = true,
  why_join              = 'グローバルNo.1 SaaSで、最先端のCRM・DX領域に携わることができます。充実した研修制度、明確なキャリアパス、グローバルでの活躍機会が豊富。Ohana文化が根付いており、多様性とインクルージョンを大切にした職場環境です。',
  culture_description   = '平等・信頼・革新・顧客成功を核とした「Ohana（オハナ）」文化。多様性とインクルージョンを大切にし、社員ひとりひとりが地域社会への貢献活動にも積極的に参加します。',
  is_published          = true,
  accepting_casual_meetings = true,
  updated_at            = now()
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';


-- ─────────────────────────────────────────────────────────────────────────────
-- ② 新規8社を挿入
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ow_companies (
  name, name_en, founded_year, employee_count, location, industry, funding_stage,
  url, mission, description, tagline, logo_letter, logo_gradient,
  remote_work_status, flex_time, side_job_ok, ceo_name, has_stock_option,
  why_join, culture_description,
  is_published, accepting_casual_meetings,
  current_member_count, obog_count
) VALUES

-- ① 株式会社タイミー
(
  '株式会社タイミー',
  'Timee, Inc.',
  2017,
  '1600名以上',
  '東京都',
  'HR Tech',
  'listed',
  'https://corp.timee.co.jp/',
  'はたらく体験を、もっと自由に',
  '働きたい時間にすぐ働けるスキマバイトアプリ「タイミー」を運営。登録から最短1時間で働き始められる即時マッチング型の人材サービスで、2024年東証グロース上場。長期就業支援「タイミーキャリアプラス」やBPO事業にも拡大中。',
  '「はたらく」を通じて人生の可能性を広げるインフラへ',
  'タ',
  'linear-gradient(135deg, #7C3AED, #EC4899)',
  'hybrid',
  true,
  false,
  '小川 嶺',
  false,
  '上場スタートアップならではの成長フェーズの中で、事業拡大に直接携わる経験ができます。スキマバイト市場のリーダーとして、日本の働き方そのものを変えるプロダクトを創る仲間を求めています。',
  '「はたらく体験を自由に」というビジョンのもと、多様なバックグラウンドを持つメンバーが集まるチーム。スピードと品質を両立する文化が根付いており、個人の成長が会社の成長と直結しています。',
  true,
  true,
  0,
  0
),

-- ② 株式会社GATARI
(
  '株式会社GATARI',
  'GATARI Inc.',
  2016,
  '〜15名',
  '東京都',
  'XR / MR',
  'seed',
  'https://gatari.co.jp/',
  '現実世界の見え方を変えることで、世界をより良い場所にする',
  '東大発のMixed Realityスタートアップ。スマートフォン1台でノーコードによるMR体験の制作・公開ができるプラットフォーム「Auris（オーリス）」を提供。デジタルとリアルが融合する次世代体験インフラの構築を目指す。',
  '現実世界の見え方を変える、MRスタートアップ',
  'G',
  'linear-gradient(135deg, #0f766e, #0284c7)',
  'hybrid',
  true,
  true,
  '竹下 俊一',
  true,
  'XR/MR領域の最前線で、次世代の現実体験を設計するポジションです。小さなチームだからこそ、エンジニア・デザイナー問わず製品の方向性に深く関わることができます。',
  '東大発スタートアップとしての知的好奇心を大切にする文化。メンバー全員が研究者的な姿勢でプロダクトに向き合い、技術の限界を押し広げることに情熱を持っています。',
  true,
  true,
  0,
  0
),

-- ③ 株式会社irodas
(
  '株式会社irodas',
  'irodas Inc.',
  2017,
  '約270名',
  '大阪府',
  'HR Tech',
  'seed',
  'https://irodas.com/',
  '1億色を創る',
  '新卒採用支援に特化したHR Techスタートアップ。学生のキャリアコミュニティ「irodas SALON」、新卒エージェント、スカウトサービス「イロシル」を提供。年間15,000名以上の学生が利用し、400社以上の企業に採用支援サービスを展開。',
  '1億色のキャリアを、新卒から育てる',
  'i',
  'linear-gradient(135deg, #dc2626, #f97316)',
  'hybrid',
  true,
  false,
  '渡辺 健太',
  false,
  '学生のキャリア支援から企業の採用まで一気通貫で関わることができます。大阪発のスタートアップとして、関西から日本の新卒採用市場を変えていく挑戦に参加できます。',
  '「1億色を創る」というミッションのもと、一人ひとりの個性を尊重する文化。大阪本社ながら全国展開しており、地域に縛られない柔軟な働き方を実現しています。',
  true,
  true,
  0,
  0
),

-- ④ 株式会社シンカ
(
  '株式会社シンカ',
  'Thinca Inc.',
  2014,
  '約65名',
  '東京都',
  'SaaS / 顧客コミュニケーション',
  'listed',
  'https://www.thinca.co.jp/',
  'ITで世界をもっとおもしろく',
  '顧客接点クラウドサービス「カイクラ」を開発・販売。電話・SMS・メール等の顧客コミュニケーションを一元管理するAIコミュニケーション統合プラットフォーム。2024年東証グロース上場、3,100社・6,200拠点以上が導入、継続率99.7%。',
  '電話・SMS・メール、顧客接点をひとつに',
  'シ',
  'linear-gradient(135deg, #059669, #0d9488)',
  'hybrid',
  true,
  false,
  '江尻 高宏',
  false,
  '上場直後のグロースフェーズで、SaaS事業の急拡大に直接貢献できます。顧客継続率99.7%という圧倒的なプロダクト品質を武器に、更なる市場開拓を共に担う仲間を求めています。',
  '「ITで世界をもっとおもしろく」を体現するため、スピード感と品質を大切にする文化。少数精鋭のチームで、一人ひとりの裁量が大きい環境です。',
  true,
  true,
  0,
  0
),

-- ⑤ 株式会社find
(
  '株式会社find',
  'find Inc.',
  2021,
  '約75名',
  '東京都',
  'SaaS / LostTech',
  'series-a',
  'https://www.finds.co.jp/',
  '落とし物をなくす社会をつくる',
  '落とし物管理をDX化するクラウドサービス「落とし物クラウドfind」を提供。AIによる落とし主とのマッチング・管理受託・リユース（循環）事業を展開。ローンチ1年強で全国1,200拠点以上に導入し、Series A 約7億円を調達。',
  '落とし物をDXで解決する、LostTechのパイオニア',
  'f',
  'linear-gradient(135deg, #0369a1, #0891b2)',
  'hybrid',
  true,
  true,
  '高島 彬',
  true,
  '「落とし物」という誰もが経験する社会課題をSaaSで解決する、ユニークな事業領域です。Series A調達後の拡大フェーズで、急成長中のチームに早期から参画できます。',
  '社会課題解決を本気で追求するチーム。スタートアップらしいスピード感と、社会に対するインパクトへの強いこだわりを大切にしています。',
  true,
  true,
  0,
  0
),

-- ⑥ 株式会社Archi Village
(
  '株式会社Archi Village',
  'Archi Village Inc.',
  2022,
  '約72名',
  '東京都',
  'SaaS / ConTech',
  'ipo',
  'https://archi-village.com/',
  '全ての居住環境を快適で安全な空間に',
  '建材業界向けDXプラットフォームを提供するConTechスタートアップ。建材情報を一元管理する「建材サーチ」と建設業務管理システム「アーキLink」を主力製品とし、業界の紙ベース商慣習のデジタル化を推進。IPO準備中、累計調達17億円以上。',
  '建材業界のDXで、全ての居住空間を安全・快適に',
  'A',
  'linear-gradient(135deg, #92400e, #b45309)',
  'full_remote',
  true,
  true,
  '竹内 将高',
  true,
  '建設・建材という巨大伝統産業のDXを、フルリモート環境で推進します。IPO準備中のスタートアップで、上場プロセスを間近で経験できる貴重なポジションが揃っています。',
  'フルリモートを前提とした、自律・自走型の働き方を大切にする文化。建設業界という伝統的な業界に革新をもたらす使命感が、チームを一つにしています。',
  true,
  true,
  0,
  0
),

-- ⑦ 株式会社Translead
(
  '株式会社Translead',
  'Translead Inc.',
  2023,
  '約73名',
  '東京都',
  'SaaS / Sales Tech',
  'seed',
  'https://translead.jp/',
  '営業を科学する',
  '営業DX領域に特化したSaaS企業。顧客管理・営業支援ツール「Translead CRM」を開発・提供。画面遷移とクリック数を最小限に抑えたUI設計で、営業現場の入力・管理業務の負担を大幅に削減するSFAプラットフォーム。',
  '営業現場の入力負担ゼロへ、Sales Tech SaaS',
  'T',
  'linear-gradient(135deg, #4f46e5, #7c3aed)',
  'hybrid',
  true,
  true,
  '竹内 将高',
  true,
  'Sales Tech領域のSaaSをゼロから作り上げるスタートアップの初期メンバーとして参画できます。BLUEPRINT Foundersグループの支援のもと、スピーディな意思決定と豊富なリソースが揃う環境です。',
  '「営業を科学する」ために、データドリブンな意思決定を大切にする文化。スタートアップの初期フェーズだからこそ、一人ひとりの行動が事業の成否に直結します。',
  true,
  true,
  0,
  0
),

-- ⑧ AnyTrail株式会社
(
  'AnyTrail株式会社',
  'AnyTrail Inc.',
  2023,
  '〜10名',
  '東京都',
  'HR Tech',
  'seed',
  'https://anytrail.jp/',
  'エッセンシャル・インフラワーカーのための人材プラットフォームへ',
  'タクシー・ホテルなどのインバウンド×エッセンシャルワーカー領域に特化した人材紹介サービスを展開。タクシー業界専門の企業紹介「タクシーメイト」やM&A・事業承継サポートも提供。訪日客増加を背景に、インフラを支える人材の流通を変える。',
  'エッセンシャルワーカーの「はたらく」を変える',
  'A',
  'linear-gradient(135deg, #166534, #15803d)',
  'hybrid',
  true,
  true,
  '長浜 佑樹',
  true,
  'インバウンド需要が急増する中、タクシー・ホテル業界の人材課題を解決するスタートアップの初期メンバーとして参画できます。市場の追い風を直接受けながら、事業をゼロから作り上げる経験ができます。',
  '「インフラを支える人を大切に」という思想が根底にある、アットホームなチーム。小さなチームだからこそ、代表と近い距離で働きながら事業の全体像を把握できます。',
  true,
  true,
  0,
  0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ③ 確認クエリ（実行後に件数を確認）
-- ─────────────────────────────────────────────────────────────────────────────
SELECT name, industry, funding_stage, location, is_published
FROM ow_companies
WHERE name IN (
  '株式会社Opinio',
  '株式会社セールスフォース・ジャパン',
  '株式会社タイミー',
  '株式会社GATARI',
  '株式会社irodas',
  '株式会社シンカ',
  '株式会社find',
  '株式会社Archi Village',
  '株式会社Translead',
  'AnyTrail株式会社'
)
ORDER BY name;
