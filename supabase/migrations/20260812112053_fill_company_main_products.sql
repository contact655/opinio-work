-- main_products が空だった公開9社に主な製品を投入する
--
-- ── 判定基準 ────────────────────────────────────────────────────────────────
-- `main_products` に入れるのは「**単体で契約・課金できるもの**」のみ。
-- 機能・プラン・構成要素は入れない。
--   例: SmartHR の給与計算・勤怠管理は「機能」であって製品ではない
--       ChatGPT Enterprise は ChatGPT の「プラン」
--       Delta Lake / MLflow は OSS、Unity Catalog は「構成要素」
--
-- ⚠️ 書式は `製品名（説明）` に統一する。**全角括弧。**
--    企業ページの `parseProductName`（companies/[id]/page.tsx）が括弧で分解し、
--    製品名を1行目・説明を2行目としてカードに出す。
--    括弧が無いと1行のカードになり、他社と見た目が揃わない。
--
-- ── 対象9社（すべて公開・すべて main_products が空だったもの）────────────────
--   09d67e54-0381-45c8-b698-568e1fc47033  株式会社PKSHA Technology
--   81aa95dc-2304-4faa-9c4a-f2f5454e8e11  株式会社SmartHR
--   8b9f84b0-b4be-4191-8322-07c6a2e5e91a  Sansan株式会社
--   fb7397eb-a9c7-4ce3-964a-d7a72159847f  Ubie株式会社
--   a5ffac90-70aa-4242-b867-6d9334317851  Datadog Japan株式会社
--   bf24736f-fa65-4c5a-9764-98c96ace3b07  Notion Labs Japan合同会社
--   daa558e5-054f-4475-ab00-3817170759ce  OpenAI Japan合同会社
--   ae15610d-477a-410d-b74a-54ab3e351add  Databricks Japan株式会社
--   aaaaaaaa-0001-0001-0001-000000000007  HubSpot Japan株式会社
--
-- ⚠️ 指示書の社名と DB の登録名が3社で違う（id で解決した）。
--      Datadog Japan「合同会社」→ DB は「株式会社」
--      Notion Labs Japan       → DB は「Notion Labs Japan合同会社」
--      OpenAI Japan            → DB は「OpenAI Japan合同会社」
--    法人格の表記は DB 側を正とし、本migrationでは社名を変更していない。
--
-- ── 出典（2026-08-12 作成）──────────────────────────────────────────────────
-- ⚠️ **各社の公式サイトの製品一覧から作成したものであり、原文のコピーではない。**
--    説明は日本語で統一するために付けたもので、各社の公式表記そのままではない。
--
--   株式会社PKSHA Technology   https://www.pkshatech.com/
--   株式会社SmartHR            https://smarthr.jp/
--   Sansan株式会社             https://jp.corp-sansan.com/
--   Ubie株式会社               https://ubie.app/
--   Datadog Japan株式会社      https://www.datadoghq.com/ja/
--   Notion Labs Japan合同会社  https://www.notion.com/ja
--   OpenAI Japan合同会社       https://openai.com/
--   Databricks Japan株式会社   https://www.databricks.com/jp
--   HubSpot Japan株式会社      https://www.hubspot.jp/
--
-- ⚠️ **`ow_companies` にはまだ出典の列が無い（2026-08-12 時点）。**
--    `source_urls text[]` / `source_verified_at timestamptz` を足すときに、
--    上の対応表（企業 → URL、確認日 2026-08-12）をそのまま移行元として使えるよう
--    この形式を崩さないこと。20260811183953_fill_company_descriptions.sql と同じ形。
--
-- ⚠️ `main_customers` は本migrationでは投入しない。
--    `customer_cases` があると `main_customers` は表示されないフォールバック構造
--    （companies/[id]/page.tsx）のため、先に customer_cases の方針を決める。
--
-- ⚠️ 株式会社タイミーの既存値は変更しない。「BPO事業」は実在するサービス
--    （「Timee BPO」2026年5月正式提供開始）で、削除・改名の対象ではない。

BEGIN;

CREATE TEMP TABLE _targets (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _targets (id) VALUES
  ('09d67e54-0381-45c8-b698-568e1fc47033'),  -- 株式会社PKSHA Technology
  ('81aa95dc-2304-4faa-9c4a-f2f5454e8e11'),  -- 株式会社SmartHR
  ('8b9f84b0-b4be-4191-8322-07c6a2e5e91a'),  -- Sansan株式会社
  ('fb7397eb-a9c7-4ce3-964a-d7a72159847f'),  -- Ubie株式会社
  ('a5ffac90-70aa-4242-b867-6d9334317851'),  -- Datadog Japan株式会社
  ('bf24736f-fa65-4c5a-9764-98c96ace3b07'),  -- Notion Labs Japan合同会社
  ('daa558e5-054f-4475-ab00-3817170759ce'),  -- OpenAI Japan合同会社
  ('ae15610d-477a-410d-b74a-54ab3e351add'),  -- Databricks Japan株式会社
  ('aaaaaaaa-0001-0001-0001-000000000007');  -- HubSpot Japan株式会社

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_exists int;
  v_empty  int;
BEGIN
  SELECT count(*) INTO v_exists FROM _targets t JOIN ow_companies c ON c.id = t.id;
  IF v_exists <> 9 THEN
    RAISE EXCEPTION '対象9社が揃っていない: %', v_exists;
  END IF;

  -- ⚠️ 既に製品が入っている企業を上書きしない
  SELECT count(*) INTO v_empty FROM _targets t JOIN ow_companies c ON c.id = t.id
   WHERE c.main_products IS NULL OR array_length(c.main_products, 1) IS NULL;
  IF v_empty <> 9 THEN
    RAISE EXCEPTION '対象のうち main_products が空なのは % 社。空でないものがあるので止める', v_empty;
  END IF;
END $$;

-- ── 本処理 ──────────────────────────────────────────────────────────────────
UPDATE ow_companies SET main_products = ARRAY[
  'PKSHA AI ヘルプデスク（社内問い合わせ対応）',
  'PKSHA FAQ（FAQシステム）',
  'PKSHA Chatbot（対話エンジン）',
  'PKSHA Voicebot（音声対話）',
  'PKSHA Speech Insight（通話解析）'
], updated_at = now() WHERE id = '09d67e54-0381-45c8-b698-568e1fc47033';

UPDATE ow_companies SET main_products = ARRAY[
  'SmartHR（クラウド人事労務ソフト）',
  'SmartHR Plus（連携アプリストア）'
], updated_at = now() WHERE id = '81aa95dc-2304-4faa-9c4a-f2f5454e8e11';

UPDATE ow_companies SET main_products = ARRAY[
  'Sansan（営業向けビジネスデータベース）',
  'Bill One（インボイス管理）',
  'Contract One（契約・取引管理）',
  'Eight（名刺アプリ）',
  'Sansan Data Intelligence（企業データ整備）'
], updated_at = now() WHERE id = '8b9f84b0-b4be-4191-8322-07c6a2e5e91a';

UPDATE ow_companies SET main_products = ARRAY[
  'ユビー（AI症状検索エンジン）',
  'ユビーメディカルナビ（医療機関向け）',
  'ユビー for Pharma（製薬企業向け）'
], updated_at = now() WHERE id = 'fb7397eb-a9c7-4ce3-964a-d7a72159847f';

UPDATE ow_companies SET main_products = ARRAY[
  'Infrastructure Monitoring（インフラ監視）',
  'APM（アプリケーション性能監視）',
  'Log Management（ログ管理）',
  'Security Monitoring（セキュリティ監視）',
  'Synthetic Monitoring（外形監視）',
  'RUM（ユーザー体験計測）'
], updated_at = now() WHERE id = 'a5ffac90-70aa-4242-b867-6d9334317851';

UPDATE ow_companies SET main_products = ARRAY[
  'Notion（ドキュメント・データベース）',
  'Notion Calendar（カレンダー）',
  'Notion Mail（メール）'
], updated_at = now() WHERE id = 'bf24736f-fa65-4c5a-9764-98c96ace3b07';

UPDATE ow_companies SET main_products = ARRAY[
  'ChatGPT（対話型AIアシスタント）',
  'OpenAI API（開発者向けAPI）',
  'Sora（動画生成）'
], updated_at = now() WHERE id = 'daa558e5-054f-4475-ab00-3817170759ce';

UPDATE ow_companies SET main_products = ARRAY[
  'Data Intelligence Platform（統合データ基盤）',
  'Mosaic AI（生成AI開発）'
], updated_at = now() WHERE id = 'ae15610d-477a-410d-b74a-54ab3e351add';

UPDATE ow_companies SET main_products = ARRAY[
  'Marketing Hub（マーケティング）',
  'Sales Hub（営業支援 / CRM）',
  'Service Hub（カスタマーサービス）',
  'Content Hub（CMS・コンテンツ）',
  'Operations Hub（データ連携）',
  'Smart CRM（統合顧客基盤）'
], updated_at = now() WHERE id = 'aaaaaaaa-0001-0001-0001-000000000007';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_filled  int;
  v_noparen int;
  v_total   int;
BEGIN
  SELECT count(*) INTO v_filled FROM _targets t JOIN ow_companies c ON c.id = t.id
   WHERE array_length(c.main_products, 1) > 0;
  IF v_filled <> 9 THEN
    RAISE EXCEPTION '9社ちょうどが更新されていない: %', v_filled;
  END IF;

  -- ⚠️ 全角括弧が入っていない要素があると、カードが1行になって他社と揃わない
  SELECT count(*) INTO v_noparen
    FROM _targets t JOIN ow_companies c ON c.id = t.id,
         unnest(c.main_products) AS p
   WHERE p !~ '（.+）$';
  IF v_noparen <> 0 THEN
    RAISE EXCEPTION '「製品名（説明）」の形になっていない要素が % 件ある', v_noparen;
  END IF;

  SELECT count(*) INTO v_total FROM ow_companies
   WHERE is_published AND main_products IS NOT NULL AND array_length(main_products, 1) > 0;
  RAISE NOTICE '9社に main_products を投入。公開企業で製品ありは % 社になった。', v_total;
END $$;

COMMIT;
