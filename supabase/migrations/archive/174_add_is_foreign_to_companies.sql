-- Migration 174: ow_companies に is_foreign カラムを追加し、外資系企業を設定
-- 外資系の定義: 本社が海外にある企業の日本法人・支社

ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS is_foreign BOOLEAN NOT NULL DEFAULT false;

-- 外資系企業を is_foreign = true に設定
UPDATE ow_companies SET is_foreign = true WHERE id IN (
  -- アルファベット系社名
  '6c218a59-a951-44ee-9003-163956376554', -- Asana Japan株式会社
  'c7353772-0c07-4f0d-8d20-294215125303', -- Box Japan株式会社
  '87bcae88-2779-4bf7-b461-b3c8661b2764', -- CrowdStrike株式会社
  'ae15610d-477a-410d-b74a-54ab3e351add', -- Databricks Japan株式会社
  'a5ffac90-70aa-4242-b867-6d9334317851', -- Datadog Japan株式会社
  'da8cfab5-f5c2-4648-b866-895be46a1494', -- DocuSign Japan株式会社
  '1f73df31-8e55-4e70-a928-afe1150d72d0', -- Dropbox Japan株式会社
  'aaaaaaaa-0001-0001-0001-000000000007', -- HubSpot Japan株式会社
  'e7e9b0be-20c2-4434-afea-7a27c89332e2', -- Indeed Japan株式会社
  '0ece9af4-96cb-443c-b8a8-0f358c8e3a64', -- Meta日本法人
  '565b0f13-252d-44d0-8b90-e00acacf4b75', -- MongoDB Japan合同会社
  '0d4734e0-0717-475e-a6d1-806aa2cd45ff', -- New Relic株式会社
  'bf24736f-fa65-4c5a-9764-98c96ace3b07', -- Notion Labs Japan合同会社
  'daa558e5-054f-4475-ab00-3817170759ce', -- OpenAI Japan合同会社
  'bcea5e4e-94ee-4019-8ce3-237a7edf79a7', -- SAPジャパン株式会社
  '4df6e844-74d6-4f50-98f9-08468a12f1dc', -- ServiceNow Japan合同会社
  'cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16', -- Slack Japan株式会社
  'cb70da1c-4b3b-429b-a06b-cdc2c50172f8', -- Snowflake Japan株式会社
  '88defb4b-b18c-437b-8b7d-d41a43232af4', -- Twilio Japan合同会社
  'd6650b18-5ef2-40c9-9938-2adbad70fe2b', -- Zendesk株式会社

  -- カタカナ社名（外資系）
  '6396920c-70d3-47d2-9f4e-67bc2efe262f', -- アカマイ・テクノロジーズ合同会社 (Akamai)
  'dcd2c652-4335-4031-b4d2-a4f22c98182b', -- アップルジャパン合同会社 (Apple)
  'eccd3dfb-decd-4277-a3a4-df489d3b3e5e', -- アドビ株式会社 (Adobe)
  'fc1f7cb7-9530-4d6a-85cf-15196a4b155e', -- アトラシアン株式会社 (Atlassian)
  '08e4aff6-a12c-4963-ad43-960ac9e39967', -- アプティオ株式会社 (Apttus/Conga)
  'a9de1561-eb91-4ebf-842d-f6d39865b7ef', -- アマゾン ウェブ サービス ジャパン合同会社 (AWS)
  '3efd857e-315c-4650-9727-1e5aa1245753', -- アリスタネットワークス合同会社 (Arista Networks)
  'f32e6905-f25f-4c01-b64f-c5695fd45a1d', -- アンソロピックジャパン合同会社 (Anthropic)
  'ec97fde1-6f22-4ab5-89ee-9cea0b258f2a', -- インテル株式会社 (Intel)
  '943620b5-0fa2-48b4-a072-d47f900ba9f0', -- ウーバー・ジャパン株式会社 (Uber)
  '7dac3c6e-bc5f-4550-9170-4338ea809be2', -- ヴイエムウェア株式会社 (VMware)
  'e3eafa66-02ce-4060-a5fe-57e4317c8e7c', -- ウォークミー株式会社 (WalkMe)
  'b8aa0e3d-828c-4bbe-b588-88450aab5739', -- エヌシーノ合同会社 (nCino)
  '829a1ea9-d577-4404-9ba7-e301680523a8', -- エヌビディア合同会社 (NVIDIA)
  '1e541353-c177-40a9-968a-af3af14e1194', -- エラスティック株式会社 (Elastic)
  'f8ebbe74-b647-46ea-869f-b126d1c4f316', -- オクタ・ジャパン株式会社 (Okta)
  'a1a7036b-a5c4-4328-b5db-96ac1d5e29df', -- キリバ株式会社 (Kyriba)
  '7d186c45-ce23-4d96-8eae-cd6e7c00faee', -- グーグル合同会社 (Google)
  '1027a327-18c0-4191-b27b-a28bf5781126', -- クーパ・ソフトウェア株式会社 (Coupa Software)
  '94edfbe5-0496-4c1d-865c-d2d448232135', -- クアルコムジャパン合同会社 (Qualcomm)
  '0a216ebb-c1fa-4d19-b066-f45e45c3ba2e', -- クラウドフレア・ジャパン株式会社 (Cloudflare)
  '1413b97e-ef19-4e40-87ae-e31ac8996bdd', -- クリックハウス株式会社 (ClickHouse)
  '4fecbf31-498c-40b0-a04e-3a6cb978433f', -- ゲインサイト・ジャパン株式会社 (Gainsight)
  '91523b3b-15e4-4f6b-8c9b-a90b67552b9e', -- コンカー株式会社 (SAP Concur)
  'e459ac79-5dad-499d-bb65-b758d4281123', -- コング・ジャパン株式会社 (Kong)
  '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4', -- コンフルエント合同会社 (Confluent)
  '1241f8a5-b645-4aa2-9fa1-bbfc573f1774', -- ザクトリー株式会社 (Xactly)
  '27988ac1-fd93-445d-a9fd-6dad74c92686', -- シスコシステムズ合同会社 (Cisco)
  'dd76b17d-e3c1-44a9-b747-4ecde10b8cec', -- ゼットスケーラー株式会社 (Zscaler)
  'f4acddc0-c746-4537-9edf-6f3c1f2c90b3', -- デル・テクノロジーズ株式会社 (Dell)
  'be74d989-db8f-4be1-882c-40cf94e07fe2', -- パランティア・テクノロジーズ (Palantir)
  'f4a6aa23-3775-4548-981b-156e416ef6f6', -- パロアルトネットワークス株式会社 (Palo Alto Networks)
  '3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2', -- フォーティネット株式会社 (Fortinet)
  '53ea9a54-feef-413b-8a7c-e31e4def2e11', -- ブラックライン株式会社 (BlackLine)
  '478a9ede-ea0f-48c1-859c-d47f84d35b6b', -- ブレイズ株式会社 (Braze)
  '7baafcb1-d929-46c1-97be-b0fb580b480b', -- ページャーデューティー株式会社 (PagerDuty)
  'e4d317d3-48b9-4718-ae3e-8d27147d05f5', -- マルケト株式会社 (Marketo/Adobe)
  'f201ed17-a9e2-4859-85aa-474578b2870d', -- レノボ・ジャパン合同会社 (Lenovo)

  -- 日本語「日本XX」社名（外資系の日本法人）
  '9ef65fa1-e04b-4098-a7b1-4ee3d535a23a', -- 日本IBM株式会社 (IBM)
  '1f8010f2-ba3f-4f7a-b7f4-d5b60400e638', -- 日本オラクル株式会社 (Oracle)
  '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6', -- 日本ヒューレット・パッカード合同会社 (HP)
  '40dca29e-aa4b-4654-aada-8e29763f8521', -- 日本マイクロソフト株式会社 (Microsoft)

  -- 株式会社XX（外資系）
  'c3664ef1-5571-4645-b30f-1474e7961c17', -- 株式会社セールスフォース・ジャパン (Salesforce)
  '8dc04d46-3430-45de-91f8-e37c8880b8a5', -- 株式会社ワークデイ (Workday)
  'c32027b9-cfbd-4a70-bf4c-464e42790db4'  -- 株式会社日本HP (HP)
);

-- 確認クエリ
-- SELECT COUNT(*) FROM ow_companies WHERE is_foreign = true;
-- → 67社が外資系として設定される
