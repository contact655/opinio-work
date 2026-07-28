-- phase 修正 5社 / description 修正 2社 / capital_notes 6社
--
-- phase 定義: 「企業グループとしてのステージ」= 最終親会社の状態で判定
--   listed     = 最終親会社が上場中
--   non_listed = 最終親会社が非公開（PE買収等で上場廃止）
--   unicorn    = 最終親会社が未上場ユニコーン
--
-- ヴイエムウェア・ウォークミーは親会社（Broadcom / SAP SE）が上場継続中のため listed のまま
-- capital_notes のみ追加する

-- ── phase: listed → non_listed（4社）─────────────────────────────────

UPDATE ow_companies
SET
  phase         = 'non_listed',
  description   = 'セキュリティ意識向上トレーニング（SAT）のグローバルリーダー「KnowBe4」の日本法人。フィッシング攻撃シミュレーションと教育コンテンツで、従業員のサイバーセキュリティ意識を向上。世界65,000社以上が導入。2023年2月に非公開化（Vista Equity Partners）。',
  capital_notes = '親会社 KnowBe4, Inc. は2023年2月に Vista Equity Partners により非公開化。'
WHERE id = '99132c64-ff07-4945-aeb6-7e21e6c256c9';  -- ノービフォー株式会社

UPDATE ow_companies
SET
  phase         = 'non_listed',
  capital_notes = '親会社 Zendesk, Inc. は2022年11月に Permira / Hellman & Friedman により非公開化。'
WHERE id = 'd6650b18-5ef2-40c9-9938-2adbad70fe2b';  -- Zendesk株式会社

UPDATE ow_companies
SET
  phase         = 'non_listed',
  description   = 'オブザーバビリティ（可観測性）プラットフォームのグローバルリーダー。システムのパフォーマンス・エラー・ログをリアルタイムで可視化し、エンジニアリング組織の意思決定を支援するSaaS。2023年11月に非公開化（Francisco Partners / TPG Capital）。',
  capital_notes = '親会社 New Relic, Inc. は2023年11月に Francisco Partners / TPG Capital により非公開化。'
WHERE id = '0d4734e0-0717-475e-a6d1-806aa2cd45ff';  -- New Relic株式会社

UPDATE ow_companies
SET
  phase         = 'non_listed',
  capital_notes = '親会社 Coupa Software Incorporated は2023年2月に Thoma Bravo により非公開化。'
WHERE id = '1027a327-18c0-4191-b27b-a28bf5781126';  -- クーパ・ソフトウェア株式会社

-- ── phase: listed → unicorn（1社）──────────────────────────────────────

UPDATE ow_companies
SET phase = 'unicorn'
WHERE id = 'bf24736f-fa65-4c5a-9764-98c96ace3b07';  -- Notion Labs Japan合同会社

-- ── capital_notes のみ（phase 変更なし、2社）──────────────────────────

UPDATE ow_companies
SET capital_notes = '2023年11月に Broadcom Inc. が VMware を買収。日本法人も Broadcom グループに移行。'
WHERE id = '7dac3c6e-bc5f-4550-9170-4338ea809be2';  -- ヴイエムウェア株式会社（listed のまま、親: Broadcom NASDAQ上場）

UPDATE ow_companies
SET capital_notes = '2024年8月に SAP SE が WalkMe を買収。日本法人も SAPグループに移行。'
WHERE id = 'e3eafa66-02ce-4060-a5fe-57e4317c8e7c';  -- ウォークミー株式会社（listed のまま、親: SAP SE 上場）
