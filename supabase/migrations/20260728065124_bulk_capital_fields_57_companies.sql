-- 57社 資本関係フィールド一括投入
-- capital_type / parent_company_name / parent_company_country のみ設定
-- global_employee_count / capital_notes は個社調査が必要なため含めない
--
-- 対象:
--   55社: capital_type = 'foreign_subsidiary'（外資系日本法人）
--    1社: capital_type = 'japanese_group'（Indeed Japan — 最終親会社: リクルートHD）
--    1社: capital_type = 'foreign_subsidiary'（レノボ — 親会社登記地: 香港だが本社機能は中国）
--
-- 除外済み: 株式会社セールスフォース・ジャパン（migration 20260728061244 で適用済み）
--          伊藤忠テクノソリューションズ（migration 20260728054907 で適用済み）

UPDATE ow_companies AS c
SET
  capital_type           = u.capital_type,
  parent_company_name    = u.parent_company_name,
  parent_company_country = u.parent_company_country
FROM (VALUES
  -- 米国（foreign_subsidiary）
  ('6c218a59-a951-44ee-9003-163956376554', 'foreign_subsidiary', 'Asana, Inc.',                                    '米国'),
  ('c7353772-0c07-4f0d-8d20-294215125303', 'foreign_subsidiary', 'Box, Inc.',                                      '米国'),
  ('87bcae88-2779-4bf7-b461-b3c8661b2764', 'foreign_subsidiary', 'CrowdStrike Holdings, Inc.',                    '米国'),
  ('a5ffac90-70aa-4242-b867-6d9334317851', 'foreign_subsidiary', 'Datadog, Inc.',                                  '米国'),
  ('da8cfab5-f5c2-4648-b866-895be46a1494', 'foreign_subsidiary', 'DocuSign, Inc.',                                 '米国'),
  ('1f73df31-8e55-4e70-a928-afe1150d72d0', 'foreign_subsidiary', 'Dropbox, Inc.',                                  '米国'),
  ('aaaaaaaa-0001-0001-0001-000000000007', 'foreign_subsidiary', 'HubSpot, Inc.',                                  '米国'),
  ('0ece9af4-96cb-443c-b8a8-0f358c8e3a64', 'foreign_subsidiary', 'Meta Platforms, Inc.',                          '米国'),
  ('565b0f13-252d-44d0-8b90-e00acacf4b75', 'foreign_subsidiary', 'MongoDB, Inc.',                                  '米国'),
  ('0d4734e0-0717-475e-a6d1-806aa2cd45ff', 'foreign_subsidiary', 'New Relic, Inc.',                               '米国'),
  ('bf24736f-fa65-4c5a-9764-98c96ace3b07', 'foreign_subsidiary', 'Notion Labs, Inc.',                             '米国'),
  ('4df6e844-74d6-4f50-98f9-08468a12f1dc', 'foreign_subsidiary', 'ServiceNow, Inc.',                              '米国'),
  ('cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16', 'foreign_subsidiary', 'Salesforce, Inc.',                              '米国'),
  ('cb70da1c-4b3b-429b-a06b-cdc2c50172f8', 'foreign_subsidiary', 'Snowflake Inc.',                                '米国'),
  ('88defb4b-b18c-437b-8b7d-d41a43232af4', 'foreign_subsidiary', 'Twilio Inc.',                                   '米国'),
  ('d6650b18-5ef2-40c9-9938-2adbad70fe2b', 'foreign_subsidiary', 'Zendesk, Inc.',                                 '米国'),
  ('6396920c-70d3-47d2-9f4e-67bc2efe262f', 'foreign_subsidiary', 'Akamai Technologies, Inc.',                    '米国'),
  ('dcd2c652-4335-4031-b4d2-a4f22c98182b', 'foreign_subsidiary', 'Apple Inc.',                                    '米国'),
  ('eccd3dfb-decd-4277-a3a4-df489d3b3e5e', 'foreign_subsidiary', 'Adobe Inc.',                                    '米国'),
  ('fc1f7cb7-9530-4d6a-85cf-15196a4b155e', 'foreign_subsidiary', 'Atlassian Corporation',                        '米国'),
  ('08e4aff6-a12c-4963-ad43-960ac9e39967', 'foreign_subsidiary', 'International Business Machines Corporation',  '米国'),
  ('a9de1561-eb91-4ebf-842d-f6d39865b7ef', 'foreign_subsidiary', 'Amazon.com, Inc.',                             '米国'),
  ('3efd857e-315c-4650-9727-1e5aa1245753', 'foreign_subsidiary', 'Arista Networks, Inc.',                        '米国'),
  ('ec97fde1-6f22-4ab5-89ee-9cea0b258f2a', 'foreign_subsidiary', 'Intel Corporation',                            '米国'),
  ('943620b5-0fa2-48b4-a072-d47f900ba9f0', 'foreign_subsidiary', 'Uber Technologies, Inc.',                     '米国'),
  ('7dac3c6e-bc5f-4550-9170-4338ea809be2', 'foreign_subsidiary', 'Broadcom Inc.',                                '米国'),
  ('b8aa0e3d-828c-4bbe-b588-88450aab5739', 'foreign_subsidiary', 'nCino, Inc.',                                  '米国'),
  ('829a1ea9-d577-4404-9ba7-e301680523a8', 'foreign_subsidiary', 'NVIDIA Corporation',                           '米国'),
  ('f8ebbe74-b647-46ea-869f-b126d1c4f316', 'foreign_subsidiary', 'Okta, Inc.',                                   '米国'),
  ('7d186c45-ce23-4d96-8eae-cd6e7c00faee', 'foreign_subsidiary', 'Alphabet Inc.',                               '米国'),
  ('1027a327-18c0-4191-b27b-a28bf5781126', 'foreign_subsidiary', 'Coupa Software Incorporated',                 '米国'),
  ('94edfbe5-0496-4c1d-865c-d2d448232135', 'foreign_subsidiary', 'QUALCOMM Incorporated',                       '米国'),
  ('0a216ebb-c1fa-4d19-b066-f45e45c3ba2e', 'foreign_subsidiary', 'Cloudflare, Inc.',                            '米国'),
  ('9ccf1640-6a5c-42e3-bbcf-4110f715fbf4', 'foreign_subsidiary', 'Confluent, Inc.',                             '米国'),
  ('27988ac1-fd93-445d-a9fd-6dad74c92686', 'foreign_subsidiary', 'Cisco Systems, Inc.',                         '米国'),
  ('dd76b17d-e3c1-44a9-b747-4ecde10b8cec', 'foreign_subsidiary', 'Zscaler, Inc.',                               '米国'),
  ('f4acddc0-c746-4537-9edf-6f3c1f2c90b3', 'foreign_subsidiary', 'Dell Technologies Inc.',                      '米国'),
  ('99132c64-ff07-4945-aeb6-7e21e6c256c9', 'foreign_subsidiary', 'KnowBe4, Inc.',                               '米国'),
  ('be74d989-db8f-4be1-882c-40cf94e07fe2', 'foreign_subsidiary', 'Palantir Technologies Inc.',                  '米国'),
  ('f4a6aa23-3775-4548-981b-156e416ef6f6', 'foreign_subsidiary', 'Palo Alto Networks, Inc.',                    '米国'),
  ('3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2', 'foreign_subsidiary', 'Fortinet, Inc.',                              '米国'),
  ('53ea9a54-feef-413b-8a7c-e31e4def2e11', 'foreign_subsidiary', 'BlackLine, Inc.',                             '米国'),
  ('478a9ede-ea0f-48c1-859c-d47f84d35b6b', 'foreign_subsidiary', 'Braze, Inc.',                                 '米国'),
  ('7baafcb1-d929-46c1-97be-b0fb580b480b', 'foreign_subsidiary', 'PagerDuty, Inc.',                             '米国'),
  ('e4d317d3-48b9-4718-ae3e-8d27147d05f5', 'foreign_subsidiary', 'Adobe Inc.',                                  '米国'),
  ('9ef65fa1-e04b-4098-a7b1-4ee3d535a23a', 'foreign_subsidiary', 'International Business Machines Corporation', '米国'),
  ('1f8010f2-ba3f-4f7a-b7f4-d5b60400e638', 'foreign_subsidiary', 'Oracle Corporation',                          '米国'),
  ('9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6', 'foreign_subsidiary', 'Hewlett Packard Enterprise Company',         '米国'),
  ('40dca29e-aa4b-4654-aada-8e29763f8521', 'foreign_subsidiary', 'Microsoft Corporation',                       '米国'),
  ('8dc04d46-3430-45de-91f8-e37c8880b8a5', 'foreign_subsidiary', 'Workday, Inc.',                               '米国'),
  ('c32027b9-cfbd-4a70-bf4c-464e42790db4', 'foreign_subsidiary', 'HP Inc.',                                     '米国'),
  -- ドイツ（foreign_subsidiary）
  ('bcea5e4e-94ee-4019-8ce3-237a7edf79a7', 'foreign_subsidiary', 'SAP SE',                                      'ドイツ'),
  ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e', 'foreign_subsidiary', 'SAP SE',                                      'ドイツ'),
  ('e3eafa66-02ce-4060-a5fe-57e4317c8e7c', 'foreign_subsidiary', 'SAP SE',                                      'ドイツ'),
  -- オランダ（foreign_subsidiary）
  ('1e541353-c177-40a9-968a-af3af14e1194', 'foreign_subsidiary', 'Elastic N.V.',                                'オランダ'),
  -- 中国（foreign_subsidiary）
  ('f201ed17-a9e2-4859-85aa-474578b2870d', 'foreign_subsidiary', 'Lenovo Group Limited',                        '中国'),
  -- 日本（japanese_group）
  ('e7e9b0be-20c2-4434-afea-7a27c89332e2', 'japanese_group',     '株式会社リクルートホールディングス',              '日本')
) AS u(id, capital_type, parent_company_name, parent_company_country)
WHERE c.id = u.id::uuid;

-- Indeed Japan の capital_notes を別途設定
UPDATE ow_companies
SET capital_notes = '米国 Indeed, Inc. の日本法人。最終親会社は株式会社リクルートホールディングス。'
WHERE id = 'e7e9b0be-20c2-4434-afea-7a27c89332e2';
