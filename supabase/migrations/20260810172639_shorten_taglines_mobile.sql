-- 企業カードの tagline を短縮する 第2弾（モバイル対象・2026-08-11）
--
-- 背景:
--   前回（20260810165357）で35文字以上の31社を短縮し、1440px の省略は 27社 → 0社になった。
--   しかし 375px（カード内寸 **309px**）では 32/76社 が省略されたままだった。
--
-- ⚠️ 基準を「字数」から「実描画幅」に変えた。
--    ラテン文字は1字あたり約7px、日本語は約12.5px。字数と省略は一致しない。
--    実例: Meta「Facebook・Instagram・WhatsAppを運営」は30字でも 309px に収まり、
--          コンフルエント「Kafkaを基盤に、…流す」は27字で 331px と溢れる。
--    目標は **300px 以下**（1文字ぶんの余裕を見る）。全案をブラウザで実測して確定した。
--
-- 対象（30社）:
--   書き直し22社 … 実描画幅の広い順。事業内容から書き直した
--   微調整6社   … 語や助詞を落として309px以内に収めただけ。文言は作り直していない
--   代案2社     … ページャーデューティー / レノボ。前回 migration で反映済みだが、
--                  最終確認で「精度が上がる」と判断して差し替える
--
-- ⚠️ 意図的に変更しない3社（375pxで省略が残る）:
--   グーグル「世界中の情報を整理し、誰もがアクセスできる有益なものにする」
--   日本マイクロソフト「すべての人と組織が、より多くのことを達成できるようにする」
--   OpenAI Japan「AGI（汎用人工知能）を通じ、全人類に利益をもたらすことを目指す」
--   いずれも公式ミッションで、かつ**それ単体で事業が読み取れる**ため短縮しない。
--   アトラシアンの「あらゆるチームの可能性を解き放つ」も公式だが、単体では事業が
--   読み取れないため対象に含めた（デルの「人類の進歩を促進する」と同じ判断）。
--
-- ⚠️ `mission` / `description` / `industry` は触らない。
-- ⚠️ 旧値は各 UPDATE の直前にコメントで残してある。

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(n, ', ') INTO v_missing
  FROM unnest(ARRAY[
    'フォーティネット株式会社',
    'HubSpot Japan株式会社',
    'Datadog Japan株式会社',
    'CrowdStrike株式会社',
    'Asana Japan株式会社',
    'クアルコムジャパン合同会社',
    'クリックハウス株式会社',
    'エヌシーノ合同会社',
    'Zendesk株式会社',
    'ブラックライン株式会社',
    'Indeed Japan株式会社',
    '日本ヒューレット・パッカード合同会社',
    'エヌビディア合同会社',
    'Slack Japan株式会社',
    'オクタ・ジャパン株式会社',
    'Databricks Japan株式会社',
    'Box Japan株式会社',
    'インテル株式会社',
    'DocuSign Japan株式会社',
    'ヴイエムウェア株式会社',
    'アトラシアン株式会社',
    'アドビ株式会社',
    'SAPジャパン株式会社',
    'ServiceNow Japan合同会社',
    '株式会社ワークデイ',
    '日本オラクル株式会社',
    'ブレイズ株式会社',
    'パランティア・テクノロジーズ',
    'ページャーデューティー株式会社',
    'レノボ・ジャパン合同会社'
  ]) AS n
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ow_companies c WHERE c.name = n AND c.is_published = true
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '想定外: 対象企業が見つからないか非公開です: %', v_missing;
  END IF;
END $$;

-- ── 更新 ────────────────────────────────────────────────────────────────────

-- フォーティネット株式会社
--   旧(34字): ネットワークセキュリティのリーダーとして、サイバー脅威から企業を守る
--   新(22字): ファイアウォールを軸に企業ネットワークを守る
UPDATE public.ow_companies SET tagline = 'ファイアウォールを軸に企業ネットワークを守る', updated_at = now() WHERE id = '3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2';

-- HubSpot Japan株式会社
--   旧(34字): 顧客を中心に据えたCRM・マーケティングプラットフォームで成長を加速
--   新(18字): 集客から顧客管理までを1つにまとめる
UPDATE public.ow_companies SET tagline = '集客から顧客管理までを1つにまとめる', updated_at = now() WHERE id = 'aaaaaaaa-0001-0001-0001-000000000007';

-- Datadog Japan株式会社
--   旧(33字): クラウドアプリケーションの監視・セキュリティ・分析プラットフォーム
--   新(19字): サーバーやアプリの稼働状況を可視化する
UPDATE public.ow_companies SET tagline = 'サーバーやアプリの稼働状況を可視化する', updated_at = now() WHERE id = 'a5ffac90-70aa-4242-b867-6d9334317851';

-- CrowdStrike株式会社
--   旧(34字): AIネイティブのエンドポイントセキュリティで、サイバー脅威を阻止する
--   新(19字): PCやサーバーへの侵入を検知し、止める
UPDATE public.ow_companies SET tagline = 'PCやサーバーへの侵入を検知し、止める', updated_at = now() WHERE id = '87bcae88-2779-4bf7-b461-b3c8661b2764';

-- Asana Japan株式会社
--   旧(33字): チームの仕事を可視化・自動化するワークマネジメントプラットフォーム
--   新(17字): チームの作業を割り当て、進捗を追う
UPDATE public.ow_companies SET tagline = 'チームの作業を割り当て、進捗を追う', updated_at = now() WHERE id = '6c218a59-a951-44ee-9003-163956376554';

-- クアルコムジャパン合同会社
--   旧(34字): モバイル・IoT・自動車向け半導体で、コネクテッドワールドを実現する
--   新(16字): スマホや車向けのチップを設計する
UPDATE public.ow_companies SET tagline = 'スマホや車向けのチップを設計する', updated_at = now() WHERE id = '94edfbe5-0496-4c1d-865c-d2d448232135';

-- クリックハウス株式会社
--   旧(34字): 超高速リアルタイム分析に特化したOLAPデータベースプラットフォーム
--   新(19字): 大量データの集計に特化したデータベース
UPDATE public.ow_companies SET tagline = '大量データの集計に特化したデータベース', updated_at = now() WHERE id = '1413b97e-ef19-4e40-87ae-e31ac8996bdd';

-- エヌシーノ合同会社
--   旧(33字): クラウド型統合銀行業務プラットフォームで、金融機関のDXを加速する
--   新(18字): 銀行の融資業務をクラウドで一元化する
UPDATE public.ow_companies SET tagline = '銀行の融資業務をクラウドで一元化する', updated_at = now() WHERE id = 'b8aa0e3d-828c-4bbe-b588-88450aab5739';

-- Zendesk株式会社
--   旧(33字): カスタマーサービスを、企業の競争優位に変えるCRMプラットフォーム
--   新(19字): 顧客からの問い合わせ対応を一元管理する
UPDATE public.ow_companies SET tagline = '顧客からの問い合わせ対応を一元管理する', updated_at = now() WHERE id = 'd6650b18-5ef2-40c9-9938-2adbad70fe2b';

-- ブラックライン株式会社
--   旧(32字): 経理業務の自動化・変革クラウドで、財務チームの生産性を最大化する
--   新(17字): 決算・照合など経理業務を自動化する
UPDATE public.ow_companies SET tagline = '決算・照合など経理業務を自動化する', updated_at = now() WHERE id = '53ea9a54-feef-413b-8a7c-e31e4def2e11';

-- Indeed Japan株式会社
--   旧(31字): 求人情報の集約と求職活動支援で、働くことをもっとシンプルにする
--   新(17字): 求人情報を集約し、仕事探しを支える
UPDATE public.ow_companies SET tagline = '求人情報を集約し、仕事探しを支える', updated_at = now() WHERE id = 'e7e9b0be-20c2-4434-afea-7a27c89332e2';

-- 日本ヒューレット・パッカード合同会社
--   旧(32字): エッジからクラウドまで、ITインフラのハイブリッドソリューション
--   新(19字): 企業向けサーバーとストレージを手がける
UPDATE public.ow_companies SET tagline = '企業向けサーバーとストレージを手がける', updated_at = now() WHERE id = '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6';

-- エヌビディア合同会社
--   旧(32字): AIと高性能コンピューティングの基盤となるGPUプラットフォーム
--   新(15字): AI計算を担うGPUを設計する
UPDATE public.ow_companies SET tagline = 'AI計算を担うGPUを設計する', updated_at = now() WHERE id = '829a1ea9-d577-4404-9ba7-e301680523a8';

-- Slack Japan株式会社
--   旧(30字): チームのコミュニケーションを、ビジネスの加速エンジンに変える
--   新(17字): チャットで社内のやりとりをまとめる
UPDATE public.ow_companies SET tagline = 'チャットで社内のやりとりをまとめる', updated_at = now() WHERE id = 'cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16';

-- オクタ・ジャパン株式会社
--   旧(30字): アイデンティティ管理クラウドで、セキュアなアクセスを実現する
--   新(17字): 社員のIDとログインを一元管理する
UPDATE public.ow_companies SET tagline = '社員のIDとログインを一元管理する', updated_at = now() WHERE id = 'f8ebbe74-b647-46ea-869f-b126d1c4f316';

-- Databricks Japan株式会社
--   旧(31字): データ・AI・ガバナンスを統合したレイクハウスプラットフォーム
--   新(19字): データ分析とAI開発を1つの基盤で行う
UPDATE public.ow_companies SET tagline = 'データ分析とAI開発を1つの基盤で行う', updated_at = now() WHERE id = 'ae15610d-477a-410d-b74a-54ab3e351add';

-- Box Japan株式会社
--   旧(29字): 企業のコンテンツ管理とコラボレーションをクラウドで変革する
--   新(20字): 企業のファイルをクラウドで共有・管理する
UPDATE public.ow_companies SET tagline = '企業のファイルをクラウドで共有・管理する', updated_at = now() WHERE id = 'c7353772-0c07-4f0d-8d20-294215125303';

-- インテル株式会社
--   旧(29字): 半導体・プロセッサ技術でコンピューティングの未来を切り拓く
--   新(21字): PCやサーバー向けのCPUを設計・製造する
UPDATE public.ow_companies SET tagline = 'PCやサーバー向けのCPUを設計・製造する', updated_at = now() WHERE id = 'ec97fde1-6f22-4ab5-89ee-9cea0b258f2a';

-- DocuSign Japan株式会社
--   旧(29字): 電子署名・契約管理クラウドで、ビジネスプロセスを自動化する
--   新(15字): 契約書の締結と管理を電子化する
UPDATE public.ow_companies SET tagline = '契約書の締結と管理を電子化する', updated_at = now() WHERE id = 'da8cfab5-f5c2-4648-b866-895be46a1494';

-- ヴイエムウェア株式会社
--   旧(30字): マルチクラウド環境の基盤ソフトウェアで、IT変革を加速させる
--   新(20字): サーバーを仮想化し、複数クラウドを束ねる
UPDATE public.ow_companies SET tagline = 'サーバーを仮想化し、複数クラウドを束ねる', updated_at = now() WHERE id = '7dac3c6e-bc5f-4550-9170-4338ea809be2';

-- アトラシアン株式会社
--   旧(31字): チームの可能性を解き放つ、コラボレーションとDevOpsの基盤
--   新(29字): Jira・Confluenceで開発の課題と文書を管理する
UPDATE public.ow_companies SET tagline = 'Jira・Confluenceで開発の課題と文書を管理する', updated_at = now() WHERE id = 'fc1f7cb7-9530-4d6a-85cf-15196a4b155e';

-- アドビ株式会社
--   旧(29字): クリエイティビティとデジタル体験を変革するプラットフォーム
--   新(29字): Photoshop・Acrobatと顧客体験基盤を手がける
UPDATE public.ow_companies SET tagline = 'Photoshop・Acrobatと顧客体験基盤を手がける', updated_at = now() WHERE id = 'eccd3dfb-decd-4277-a3a4-df489d3b3e5e';

-- SAPジャパン株式会社
--   旧(28字): ERPクラウドで、エンタープライズ企業のDXを加速させる
--   新(20字): ERPクラウドで、企業のDXを加速させる
UPDATE public.ow_companies SET tagline = 'ERPクラウドで、企業のDXを加速させる', updated_at = now() WHERE id = 'bcea5e4e-94ee-4019-8ce3-237a7edf79a7';

-- ServiceNow Japan合同会社
--   旧(26字): ワークフロー自動化で、企業全体の仕事の流れを変革する
--   新(24字): ワークフロー自動化で、企業の仕事の流れを変革する
UPDATE public.ow_companies SET tagline = 'ワークフロー自動化で、企業の仕事の流れを変革する', updated_at = now() WHERE id = '4df6e844-74d6-4f50-98f9-08468a12f1dc';

-- 株式会社ワークデイ
--   旧(26字): 人事・財務クラウドで、企業のスマートワークを実現する
--   新(23字): 人事・財務クラウドで、スマートワークを実現する
UPDATE public.ow_companies SET tagline = '人事・財務クラウドで、スマートワークを実現する', updated_at = now() WHERE id = '8dc04d46-3430-45de-91f8-e37c8880b8a5';

-- 日本オラクル株式会社
--   旧(25字): データドリブンなビジネス変革を、クラウドで実現する
--   新(21字): データドリブンな変革を、クラウドで実現する
UPDATE public.ow_companies SET tagline = 'データドリブンな変革を、クラウドで実現する', updated_at = now() WHERE id = '1f8010f2-ba3f-4f7a-b7f4-d5b60400e638';

-- ブレイズ株式会社
--   旧(25字): アプリやメールで顧客へのメッセージ配信を自動化する
--   新(23字): アプリやメールで顧客メッセージ配信を自動化する
UPDATE public.ow_companies SET tagline = 'アプリやメールで顧客メッセージ配信を自動化する', updated_at = now() WHERE id = '478a9ede-ea0f-48c1-859c-d47f84d35b6b';

-- パランティア・テクノロジーズ
--   旧(25字): 散在するデータを統合し、意思決定に使えるようにする
--   新(20字): 散在するデータを統合し、意思決定に使える
UPDATE public.ow_companies SET tagline = '散在するデータを統合し、意思決定に使える', updated_at = now() WHERE id = 'be74d989-db8f-4be1-882c-40cf94e07fe2';

-- ページャーデューティー株式会社
--   旧(22字): システム障害の検知から復旧までを一元管理する
--   新(19字): システム障害を検知し、担当者を呼び出す
UPDATE public.ow_companies SET tagline = 'システム障害を検知し、担当者を呼び出す', updated_at = now() WHERE id = '7baafcb1-d929-46c1-97be-b0fb580b480b';

-- レノボ・ジャパン合同会社
--   旧(21字): PCとサーバーを開発し、企業と個人に届ける
--   新(18字): PCからサーバーまでを開発・製造する
UPDATE public.ow_companies SET tagline = 'PCからサーバーまでを開発・製造する', updated_at = now() WHERE id = 'f201ed17-a9e2-4859-85aa-474578b2870d';


-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_long bigint;
  v_max  bigint;
BEGIN
  SELECT count(*) INTO v_long
  FROM public.ow_companies
  WHERE is_published = true
    AND char_length(btrim(tagline, '「」')) >= 26
    AND name NOT IN ('グーグル合同会社', '日本マイクロソフト株式会社', 'OpenAI Japan合同会社');

  IF v_long > 0 THEN
    RAISE NOTICE '26文字以上が % 件残っている（ラテン文字主体なら実描画は収まるため異常ではない）', v_long;
  END IF;

  SELECT max(char_length(btrim(tagline, '「」'))) INTO v_max
  FROM public.ow_companies WHERE is_published = true;
  RAISE NOTICE '公開企業の tagline 最大文字数: %', v_max;
END $$;

COMMIT;
