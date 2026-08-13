-- `name_en` が空の5社を埋める（公開79社中この5社だけが未設定だった）
--
-- ── なぜ埋めるか ────────────────────────────────────────────────────────────
-- `name_en` が空だと、企業詳細ページの `<h1>` が**素の `name` に倒れる**。
-- そのため一覧カードでは「SmartHR」なのに、詳細ページでは「株式会社SmartHR」と
-- **同じ会社が経路によって違う名前で出ていた**。
--
-- 0b21ce18 で表示名の組み立てを `lib/companies/displayName.ts` に集約したが、
-- h1 の「name_en が無ければ name に倒す」だけは残っている
-- （そこで法人格を落とすと、副題が出ないぶん**正式名称が h1 から完全に消える**ため）。
-- `name_en` を入れれば h1 が英語表記になり、副題に正式名称が出て解消する。
--
-- ── 表示のされ方（`displayName.ts` の除去ルールを通ったあと）──────────────
-- | slug    | 投入する name_en   | h1               | 副題                     |
-- |---------|--------------------|------------------|--------------------------|
-- | hubspot | HubSpot Japan      | HubSpot          | HubSpot Japan株式会社     |
-- | sansan  | Sansan             | Sansan           | Sansan株式会社            |
-- | ubie    | Ubie               | Ubie             | Ubie株式会社              |
-- | pksha   | PKSHA Technology   | PKSHA Technology | 株式会社PKSHA Technology  |
-- | smarthr | SmartHR            | SmartHR          | 株式会社SmartHR           |
--
-- ⚠️ hubspot だけ "Japan" を含めているのは、他の外資系日本法人
--    （HPE Japan / Datadog Japan / OpenAI Japan）と**登録の形を揃えるため**。
--    表示上は末尾 " Japan" の除去ルールで「HubSpot」になる。
--    日系4社は Japan が付かないのでそのまま。
--
-- ⚠️ 一覧カードの表示は変わらない。すでに `stripLegalSuffix(name)` で
--    正しく除去できていた（SmartHR / Sansan / Ubie / PKSHA Technology / HubSpot Japan）。
--
-- 旧値: 5社とも name_en = NULL

UPDATE ow_companies SET name_en = 'HubSpot Japan'
WHERE id = 'aaaaaaaa-0001-0001-0001-000000000007';   -- HubSpot Japan株式会社

UPDATE ow_companies SET name_en = 'Sansan'
WHERE id = '8b9f84b0-b4be-4191-8322-07c6a2e5e91a';   -- Sansan株式会社

UPDATE ow_companies SET name_en = 'Ubie'
WHERE id = 'fb7397eb-a9c7-4ce3-964a-d7a72159847f';   -- Ubie株式会社

UPDATE ow_companies SET name_en = 'PKSHA Technology'
WHERE id = '09d67e54-0381-45c8-b698-568e1fc47033';   -- 株式会社PKSHA Technology

UPDATE ow_companies SET name_en = 'SmartHR'
WHERE id = '81aa95dc-2304-4faa-9c4a-f2f5454e8e11';   -- 株式会社SmartHR
