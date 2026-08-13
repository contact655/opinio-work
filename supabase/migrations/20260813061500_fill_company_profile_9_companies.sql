-- 企業詳細ページの「企業情報」サイドバーを埋める（/companies 1ページ目の9社）
--
-- 対象は id で明示列挙する。条件による一括 UPDATE はしない（CLAUDE.md「migration を書くときのルール」）。
-- 旧値は各 UPDATE の直前にコメントで残す。
--
-- ── 事前確認（CLAUDE.md ルール2）────────────────────────────────────────────
-- 同じ列を触った直近の migration を確認した。打ち消しは無い。
--   * archive/171_add_branch_locations.sql
--       branch_locations を全社に一括投入。**出典の記載が無い。**
--       Sansan の「京都」はここが唯一の出所で、公式の会社概要（関西・中部・福岡の3拠点）と
--       合わないため本 migration で落とす。SmartHR・Ubie・Datadog・HubSpot の
--       branch_locations は今回触らない。
--   * 20260728065124_bulk_capital_fields_57_companies.sql
--       Datadog / HubSpot の capital_type・parent_company_* を投入済み（capital_notes は空）。
--       本 migration は capital_notes を足すだけで、投入済みの値は上書きしない。
--   * 20260811183953_fill_company_descriptions.sql / 20260812112053_fill_company_main_products.sql
--       description・main_products を投入。本 migration は description を触らない。
--
-- ── 値の出典 ────────────────────────────────────────────────────────────────
-- 各社の公式サイト会社概要・IR資料・公式リリース。個別の出典は各 UPDATE のコメントに書く。
-- 一次情報で裏が取れなかった項目は**入れない**（空欄のままにする）。
--
-- ⚠️ `listed_exchange` は使わない。**描画先が無い未使用カラム**なので、
--    上場市場・証券コードは capital_notes の文中に書く。
--
-- ⚠️ `founded_year` は integer なので「（日本法人設立）」のような注記が入らない。
--    サイドバーの「設立」は Salesforce（2000 = 日本法人設立年）に合わせ、
--    **日本法人の設立年**で統一する。失われるグローバル創業年は capital_notes の文中に残す。
--
-- ⚠️ is_published / listing_status は変更しない。published_at を動かす経路も通らない。

-- ── 日本ヒューレット・パッカード合同会社 ────────────────────────────────────
-- 出典: https://www.hpe.com/jp/ja/collaterals/collateral.a50011874jpn.html ／ HPE FY2025 Form 10-K
-- 旧値: brand_name='HP' / headquarters_address=NULL / nearest_station=NULL
--       branch_locations={大阪,名古屋,福岡} / global_employee_count=NULL
--       founded_year=2015（HPE Company の設立年） / ceo_name=NULL / capital_notes=NULL
-- ⚠️ brand_name は 'HP' だったが、この行は HPE の日本法人。
--    HP Inc. の日本法人は別レコード（slug='hp-jp' / 株式会社日本HP）。
--    slug='hp' は URL が変わるため据え置き（リダイレクトとセットで別タスク）。
UPDATE ow_companies SET
  brand_name            = 'HPE',
  headquarters_address  = '東京都江東区大島2-2-1',
  nearest_station       = '都営新宿線・東京メトロ半蔵門線「住吉」駅 徒歩7分',
  branch_locations      = ARRAY['大阪', '名古屋', '豊田', '福岡', '仙台', '札幌'],
  global_employee_count = '約67,000名（2025年10月末時点）',
  founded_year          = 1999,
  ceo_name              = '望月 弘一',
  capital_notes         = '親会社 Hewlett Packard Enterprise Company（2015年設立）は米国NYSE上場（ティッカー: HPE）。日本法人は非上場。'
WHERE id = '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6';

-- ── Ubie株式会社 ────────────────────────────────────────────────────────────
-- 旧値: headquarters_address=NULL / nearest_station=NULL
--       employee_count='300〜500名' / capital_type=NULL / capital_notes=NULL
-- ⚠️ employee_count は既存 description 本文と同一の値にする
--    （本文「従業員数220名（2026年4月時点）」と列「300〜500名」が同一ページ内で矛盾していた）。
-- ⚠️ ceo_name は入れない。共同代表2名（阿部 吉倫／久保 恒太）で1列に収まらないため。
-- ⚠️ branch_locations（大阪・福岡）は今回触らない。
UPDATE ow_companies SET
  headquarters_address = '東京都中央区日本橋本町3-8-4 日本橋ライフサイエンスビルディング4 5F',
  nearest_station      = '東京メトロ銀座線・半蔵門線「三越前」駅 徒歩1分',
  employee_count       = '220名（2026年4月時点）',
  capital_type         = 'japanese_independent',
  capital_notes        = '非上場。'
WHERE id = 'fb7397eb-a9c7-4ce3-964a-d7a72159847f';

-- ── OpenAI Japan合同会社 ────────────────────────────────────────────────────
-- 旧値: headquarters_address=NULL / nearest_station=NULL / ceo_name=NULL
--       capital_type=NULL / parent_company_name=NULL / parent_company_country=NULL / capital_notes=NULL
-- ⚠️ founded_year は 2024 のまま変更しない。
--    登記上の2023年8月は二次情報でしか裏が取れていない。
UPDATE ow_companies SET
  headquarters_address   = '東京都港区六本木1-4-5 アークヒルズサウスタワー',
  nearest_station        = '東京メトロ南北線「六本木一丁目」駅',
  ceo_name               = '長﨑 忠雄',
  capital_type           = 'foreign_subsidiary',
  parent_company_name    = 'OpenAI, Inc.',
  parent_company_country = '米国',
  capital_notes          = '親会社 OpenAI, Inc.（2015年設立、米国サンフランシスコ）は非上場。日本法人は2024年4月に設立・事業開始を発表したアジア初の拠点。'
WHERE id = 'daa558e5-054f-4475-ab00-3817170759ce';

-- ── Databricks Japan株式会社 ────────────────────────────────────────────────
-- 旧値: headquarters_address=NULL / nearest_station=NULL
--       founded_year=2013（Databricks, Inc. の創業年） / capital_type=NULL
--       parent_company_name=NULL / parent_company_country=NULL / capital_notes=NULL
-- ⚠️ ceo_name は入れない。報道ベースの情報しか取れなかったため。
UPDATE ow_companies SET
  headquarters_address   = '東京都中央区日本橋3-9-1 日本橋三丁目スクエア11F',
  nearest_station        = '東京メトロ「日本橋」駅 徒歩3分',
  founded_year           = 2018,
  capital_type           = 'foreign_subsidiary',
  parent_company_name    = 'Databricks, Inc.',
  parent_company_country = '米国',
  capital_notes          = '親会社 Databricks, Inc.（2013年設立、米国サンフランシスコ）は非上場。'
WHERE id = 'ae15610d-477a-410d-b74a-54ab3e351add';

-- ── 株式会社SmartHR ────────────────────────────────────────────────────────
-- 旧値: headquarters_address=NULL / nearest_station=NULL
--       employee_count='1000名以上' / ceo_name=NULL / capital_type=NULL / capital_notes=NULL
-- ⚠️ employee_count は既存 description 本文と同一の値
--    （本文「従業員数1,497名（2026年4月末時点、正社員・契約社員・アルバイト等の合計）」）。
UPDATE ow_companies SET
  headquarters_address = '東京都港区六本木3-2-1 住友不動産六本木グランドタワー',
  nearest_station      = '東京メトロ日比谷線・都営大江戸線「六本木」駅',
  employee_count       = '1,497名（2026年4月末時点）',
  ceo_name             = '芹澤 雅人',
  capital_type         = 'japanese_independent',
  capital_notes        = '非上場。2024年6月にシリーズEで約214億円を調達。'
WHERE id = '81aa95dc-2304-4faa-9c4a-f2f5454e8e11';

-- ── Sansan株式会社 ──────────────────────────────────────────────────────────
-- 旧値: headquarters_address=NULL / nearest_station=NULL
--       branch_locations={大阪,名古屋,福岡,京都} / employee_count='1000名以上'
--       ceo_name=NULL / capital_type=NULL / capital_notes=NULL
-- ⚠️ 「京都」を落とす。出所は archive/171_add_branch_locations.sql の一括投入で**出典の記載が無い**。
--    公式の会社概要にある拠点は 関西・中部・福岡 の3つ。
-- ⚠️ employee_count は既存 description 本文と同一の値（本文「単体2,077名・連結2,336名（2026年5月31日時点）」）。
--    連結2,336名はグループ連結の値なので、画面ラベルが「従業員数（世界）」の
--    global_employee_count には**入れない**。
UPDATE ow_companies SET
  headquarters_address = '東京都渋谷区桜丘町1-1 渋谷サクラステージ28F',
  nearest_station      = 'JR「渋谷」駅 新南改札 直結',
  branch_locations     = ARRAY['大阪', '名古屋', '福岡'],
  employee_count       = '2,077名（2026年5月末時点・単体）',
  ceo_name             = '寺田 親弘',
  capital_type         = 'japanese_independent',
  capital_notes        = '東証プライム上場（証券コード: 4443）。'
WHERE id = '8b9f84b0-b4be-4191-8322-07c6a2e5e91a';

-- ── 株式会社PKSHA Technology ────────────────────────────────────────────────
-- 旧値: headquarters_address=NULL / nearest_station=NULL
--       employee_count='100〜300名' / ceo_name=NULL / capital_type=NULL / capital_notes=NULL
-- ⚠️ employee_count は既存 description 本文と同一の値
--    （本文「連結従業員数1,023名・単体382名（2026年2月時点）」）。
UPDATE ow_companies SET
  headquarters_address = '東京都文京区本郷2-35-10 本郷瀬川ビル4F',
  nearest_station      = '東京メトロ丸ノ内線・都営大江戸線「本郷三丁目」駅 徒歩5分',
  employee_count       = '382名（2026年2月時点・単体）',
  ceo_name             = '上野山 勝也',
  capital_type         = 'japanese_independent',
  capital_notes        = '東証プライム上場（証券コード: 3993）。2017年9月に東証マザーズへ上場。'
WHERE id = '09d67e54-0381-45c8-b698-568e1fc47033';

-- ── HubSpot Japan株式会社 ───────────────────────────────────────────────────
-- 旧値: headquarters_address=NULL / nearest_station=NULL / global_employee_count=NULL
--       founded_year=2013（HubSpot, Inc. の創業年ではなく出所不明の値） / ceo_name=NULL
--       capital_notes=NULL / url=NULL
-- ⚠️ url が空でサイドバーに「公式サイト」行が出ていなかった。
-- ⚠️ capital_type / parent_company_* は 20260728065124 で投入済み。触らない。
UPDATE ow_companies SET
  headquarters_address  = '東京都千代田区丸の内1-4-1 丸の内永楽ビル26F',
  nearest_station       = 'JR「東京」駅／東京メトロ「大手町」駅',
  global_employee_count = '8,882名（2025年12月末時点）',
  founded_year          = 2016,
  ceo_name              = '伊佐 裕也',
  capital_notes         = '親会社 HubSpot, Inc.（2006年設立、米国ケンブリッジ）は米国NYSE上場（ティッカー: HUBS）。日本法人は非上場。',
  url                   = 'https://www.hubspot.jp/'
WHERE id = 'aaaaaaaa-0001-0001-0001-000000000007';

-- ── Datadog Japan株式会社 ───────────────────────────────────────────────────
-- 旧値: headquarters_address=NULL / nearest_station=NULL / global_employee_count=NULL
--       founded_year=2010（Datadog, Inc. の創業年） / ceo_name=NULL
--       capital_notes=NULL / main_customers=NULL
-- ⚠️ main_customers は customer_cases が空のときだけ表示されるフォールバック。
--    Datadog は customer_cases が空なので表示される。
-- ⚠️ 社名は登記・公式リリースでは「Datadog Japan合同会社」だが、今回は直さない。
--    他社の登記形態のズレと一度に点検するため別タスク。
-- ⚠️ capital_type / parent_company_* は 20260728065124 で投入済み。触らない。
UPDATE ow_companies SET
  headquarters_address  = '東京都千代田区丸の内2-7-2 JPタワー',
  nearest_station       = 'JR「東京」駅',
  global_employee_count = '8,100名（2025年12月末時点）',
  founded_year          = 2019,
  ceo_name              = '正井 拓己',
  capital_notes         = '親会社 Datadog, Inc.（2010年設立、米国ニューヨーク）は米国NASDAQ上場（ティッカー: DDOG）。日本法人は非上場。',
  main_customers        = ARRAY['NTTドコモ', 'KDDI', 'ソフトバンク', 'ソニー・インタラクティブエンタテインメント', 'ジェーシービー', '大日本印刷', 'サイバーエージェント']
WHERE id = 'a5ffac90-70aa-4242-b867-6d9334317851';
