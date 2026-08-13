-- HPE の製品8件と、HPE・OpenAI の導入事例を投入する
--
-- ⚠️ 対象は2社のみ（hp / openai）。他の企業の main_products / customer_cases は触らない。
--
-- ── Datadog に customer_cases を入れないこと（2026-08-13 判断）────────────
-- `main_customers` は **`customer_cases` が空のときだけ**表示されるフォールバック
-- （companies/[id]/page.tsx の hasCases 分岐）。Datadog に事例を入れると、
-- 先に投入した顧客7社のリストが**画面から消える**。
-- 裏の取れた詳細事例が2件程度しかなく、7社リストを残すほうが情報量が多いため、
-- **Datadog の customer_cases は空のままにする。**

-- ── 日本ヒューレット・パッカード合同会社: main_products ─────────────────────
-- 旧値: NULL（9社中、唯一 main_products が空だった）
-- 出典: https://www.hpe.com/jp/ja/
--
-- ⚠️ 書式は既存9社と同じ `製品名（説明）`（全角括弧）。括弧を外さないこと
--    （CLAUDE.md「main_products の書式」。外すと説明文が製品名として1行に出る）。
-- ⚠️ 判定基準は「単体で契約・課金できるか」。料金プラン・機能・構成要素は入れない。
-- ⚠️ 製品名は description 本文の表記と揃えてある
--    （本文に出る ProLiant / Alletra / GreenLake の3つが製品カードと一致する）。
UPDATE ow_companies SET main_products = ARRAY[
  'HPE ProLiant（x86サーバー）',
  'HPE Alletra（ストレージ）',
  'HPE Aruba Networking（ネットワーク機器）',
  'HPE GreenLake（従量課金型のITインフラ）',
  'HPE Private Cloud AI（オンプレミス型のAI基盤）',
  'HPE Cray（スーパーコンピューター・HPC）',
  'HPE Ezmeral（データ分析・コンテナ基盤ソフトウェア）',
  'HPE Tech Care Service（保守・サポート）'
]
WHERE id = '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6';

-- ── 日本ヒューレット・パッカード合同会社: customer_cases ────────────────────
-- 旧値: NULL
-- 構造は Salesforce の既存データと同じ name / industry / usecase / result / products。
--
-- ⚠️ KDDI の `products` は**意図的に空配列**。プレスリリースで具体的な製品名まで
--    特定できなかったため。**推測で埋めないこと。**
--    描画側（CustomerCasesClient.tsx）は `c.products.map(...)` なので、
--    空配列ならピルが0個になるだけでカードは崩れない（キー自体は必ず入れる。
--    キーが無いと `undefined.map` で落ちる）。
UPDATE ow_companies SET customer_cases = $json$[
  {
    "name": "株式会社SUBARU",
    "industry": "自動車",
    "usecase": "次世代アイサイトのAI開発基盤として、NVIDIA H200を8基搭載した直接液冷サーバー「HPE Cray XD670」を導入。",
    "result": "既存システムの約2倍の演算性能（2025年7月発表）。",
    "products": ["HPE Cray"]
  },
  {
    "name": "Sky株式会社",
    "industry": "ソフトウェア",
    "usecase": "機密データを社外に出さずに生成AIを利用するため、オンプレミス型のAI基盤「HPE Private Cloud AI」を導入。",
    "result": "約1か月で社内向けのAI基盤を展開（2026年6月発表）。",
    "products": ["HPE Private Cloud AI"]
  },
  {
    "name": "KDDI株式会社",
    "industry": "通信",
    "usecase": "AIデータセンター向けに、NVIDIA Blackwellを搭載したHPEの直接液冷サーバーを採用。",
    "result": "2026年初頭の稼働を予定（2025年6月発表）。",
    "products": []
  }
]$json$::jsonb
WHERE id = '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6';

-- ── OpenAI Japan合同会社: customer_cases ────────────────────────────────────
-- 旧値: NULL
--
-- ⚠️ `products` の "ChatGPT" は main_products の
--    'ChatGPT（対話型AIアシスタント）' の製品名部分と一致することを確認済み
--    （描画側の parseProductName が全角括弧の前を製品名として扱う）。
UPDATE ow_companies SET customer_cases = $json$[
  {
    "name": "株式会社NTTデータグループ",
    "industry": "ITサービス・SI",
    "usecase": "日本初の販売代理店として、大手企業向けにChatGPT Enterpriseの提供を開始。",
    "result": "大手企業100社への提供を計画（2025年5月開始）。",
    "products": ["ChatGPT"]
  },
  {
    "name": "ソフトバンク株式会社",
    "industry": "通信",
    "usecase": "合弁会社「SB OAI Japan合同会社」を通じ、企業向けAI「クリスタル・インテリジェンス」を展開。",
    "result": "2025年11月に合弁会社を設立し、ソフトバンクが最初の導入企業となる。",
    "products": ["ChatGPT"]
  }
]$json$::jsonb
WHERE id = 'daa558e5-054f-4475-ab00-3817170759ce';
