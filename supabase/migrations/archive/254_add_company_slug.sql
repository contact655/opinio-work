-- Migration 254: Add slug column to ow_companies + backfill 84 companies
-- Purpose: Enable human-readable URLs (/companies/salesforce instead of /companies/{uuid})
-- Applied: 2026-07-18

ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS slug TEXT;

-- ── English-named companies ───────────────────────────────────────────────────
UPDATE ow_companies SET slug = 'asana'       WHERE id = '6c218a59-a951-44ee-9003-163956376554';
UPDATE ow_companies SET slug = 'box'         WHERE id = 'c7353772-0c07-4f0d-8d20-294215125303';
UPDATE ow_companies SET slug = 'crowdstrike' WHERE id = '87bcae88-2779-4bf7-b461-b3c8661b2764';
UPDATE ow_companies SET slug = 'databricks'  WHERE id = 'ae15610d-477a-410d-b74a-54ab3e351add';
UPDATE ow_companies SET slug = 'datadog'     WHERE id = 'a5ffac90-70aa-4242-b867-6d9334317851';
UPDATE ow_companies SET slug = 'docusign'    WHERE id = 'da8cfab5-f5c2-4648-b866-895be46a1494';
UPDATE ow_companies SET slug = 'dropbox'     WHERE id = '1f73df31-8e55-4e70-a928-afe1150d72d0';
UPDATE ow_companies SET slug = 'hubspot'     WHERE id = 'aaaaaaaa-0001-0001-0001-000000000007';
UPDATE ow_companies SET slug = 'indeed'      WHERE id = 'e7e9b0be-20c2-4434-afea-7a27c89332e2';
UPDATE ow_companies SET slug = 'meta'        WHERE id = '0ece9af4-96cb-443c-b8a8-0f358c8e3a64';
UPDATE ow_companies SET slug = 'mongodb'     WHERE id = '565b0f13-252d-44d0-8b90-e00acacf4b75';
UPDATE ow_companies SET slug = 'new-relic'   WHERE id = '0d4734e0-0717-475e-a6d1-806aa2cd45ff';
UPDATE ow_companies SET slug = 'notion'      WHERE id = 'bf24736f-fa65-4c5a-9764-98c96ace3b07';
UPDATE ow_companies SET slug = 'openai'      WHERE id = 'daa558e5-054f-4475-ab00-3817170759ce';
UPDATE ow_companies SET slug = 'sansan'      WHERE id = '8b9f84b0-b4be-4191-8322-07c6a2e5e91a';
UPDATE ow_companies SET slug = 'sap'         WHERE id = 'bcea5e4e-94ee-4019-8ce3-237a7edf79a7';
UPDATE ow_companies SET slug = 'servicenow'  WHERE id = '4df6e844-74d6-4f50-98f9-08468a12f1dc';
UPDATE ow_companies SET slug = 'slack'       WHERE id = 'cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16';
UPDATE ow_companies SET slug = 'smarthr'     WHERE id = '81aa95dc-2304-4faa-9c4a-f2f5454e8e11';
UPDATE ow_companies SET slug = 'snowflake'   WHERE id = 'cb70da1c-4b3b-429b-a06b-cdc2c50172f8';
UPDATE ow_companies SET slug = 'twilio'      WHERE id = '88defb4b-b18c-437b-8b7d-d41a43232af4';
UPDATE ow_companies SET slug = 'ubie'        WHERE id = 'fb7397eb-a9c7-4ce3-964a-d7a72159847f';
UPDATE ow_companies SET slug = 'zendesk'     WHERE id = 'd6650b18-5ef2-40c9-9938-2adbad70fe2b';

-- ── Katakana → English brand names ───────────────────────────────────────────
UPDATE ow_companies SET slug = 'akamai'             WHERE id = '6396920c-70d3-47d2-9f4e-67bc2efe262f';
UPDATE ow_companies SET slug = 'asahi-beer'         WHERE id = '60304f29-e070-4ef6-9b44-8a899a411a8d';
UPDATE ow_companies SET slug = 'apple'              WHERE id = 'dcd2c652-4335-4031-b4d2-a4f22c98182b';
UPDATE ow_companies SET slug = 'adobe'              WHERE id = 'eccd3dfb-decd-4277-a3a4-df489d3b3e5e';
UPDATE ow_companies SET slug = 'atlassian'          WHERE id = 'fc1f7cb7-9530-4d6a-85cf-15196a4b155e';
UPDATE ow_companies SET slug = 'aptio'              WHERE id = '08e4aff6-a12c-4963-ad43-960ac9e39967';
UPDATE ow_companies SET slug = 'aws'                WHERE id = 'a9de1561-eb91-4ebf-842d-f6d39865b7ef';
UPDATE ow_companies SET slug = 'arista'             WHERE id = '3efd857e-315c-4650-9727-1e5aa1245753';
UPDATE ow_companies SET slug = 'anthropic'          WHERE id = 'f32e6905-f25f-4c01-b64f-c5695fd45a1d';
UPDATE ow_companies SET slug = 'intel'              WHERE id = 'ec97fde1-6f22-4ab5-89ee-9cea0b258f2a';
UPDATE ow_companies SET slug = 'uber'               WHERE id = '943620b5-0fa2-48b4-a072-d47f900ba9f0';
UPDATE ow_companies SET slug = 'vmware'             WHERE id = '7dac3c6e-bc5f-4550-9170-4338ea809be2';
UPDATE ow_companies SET slug = 'walkme'             WHERE id = 'e3eafa66-02ce-4060-a5fe-57e4317c8e7c';
UPDATE ow_companies SET slug = 'ncino'              WHERE id = 'b8aa0e3d-828c-4bbe-b588-88450aab5739';
UPDATE ow_companies SET slug = 'nvidia'             WHERE id = '829a1ea9-d577-4404-9ba7-e301680523a8';
UPDATE ow_companies SET slug = 'elastic'            WHERE id = '1e541353-c177-40a9-968a-af3af14e1194';
UPDATE ow_companies SET slug = 'okta'               WHERE id = 'f8ebbe74-b647-46ea-869f-b126d1c4f316';
UPDATE ow_companies SET slug = 'kyriba'             WHERE id = 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df';
UPDATE ow_companies SET slug = 'google'             WHERE id = '7d186c45-ce23-4d96-8eae-cd6e7c00faee';
UPDATE ow_companies SET slug = 'coupa'              WHERE id = '1027a327-18c0-4191-b27b-a28bf5781126';
UPDATE ow_companies SET slug = 'qualcomm'           WHERE id = '94edfbe5-0496-4c1d-865c-d2d448232135';
UPDATE ow_companies SET slug = 'cloudflare'         WHERE id = '0a216ebb-c1fa-4d19-b066-f45e45c3ba2e';
UPDATE ow_companies SET slug = 'clickhouse'         WHERE id = '1413b97e-ef19-4e40-87ae-e31ac8996bdd';
UPDATE ow_companies SET slug = 'gainsight'          WHERE id = '4fecbf31-498c-40b0-a04e-3a6cb978433f';
UPDATE ow_companies SET slug = 'concur'             WHERE id = '91523b3b-15e4-4f6b-8c9b-a90b67552b9e';
UPDATE ow_companies SET slug = 'kong'               WHERE id = 'e459ac79-5dad-499d-bb65-b758d4281123';
UPDATE ow_companies SET slug = 'confluent'          WHERE id = '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4';
UPDATE ow_companies SET slug = 'zactory'            WHERE id = '1241f8a5-b645-4aa2-9fa1-bbfc573f1774';
UPDATE ow_companies SET slug = 'cisco'              WHERE id = '27988ac1-fd93-445d-a9fd-6dad74c92686';
UPDATE ow_companies SET slug = 'zscaler'            WHERE id = 'dd76b17d-e3c1-44a9-b747-4ecde10b8cec';
UPDATE ow_companies SET slug = 'dell'               WHERE id = 'f4acddc0-c746-4537-9edf-6f3c1f2c90b3';
UPDATE ow_companies SET slug = 'nobefore'           WHERE id = '99132c64-ff07-4945-aeb6-7e21e6c256c9';
UPDATE ow_companies SET slug = 'palantir'           WHERE id = 'be74d989-db8f-4be1-882c-40cf94e07fe2';
UPDATE ow_companies SET slug = 'palo-alto-networks' WHERE id = 'f4a6aa23-3775-4548-981b-156e416ef6f6';
UPDATE ow_companies SET slug = 'fortinet'           WHERE id = '3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2';
UPDATE ow_companies SET slug = 'blackline'          WHERE id = '53ea9a54-feef-413b-8a7c-e31e4def2e11';
UPDATE ow_companies SET slug = 'braze'              WHERE id = '478a9ede-ea0f-48c1-859c-d47f84d35b6b';
UPDATE ow_companies SET slug = 'pagerduty'          WHERE id = '7baafcb1-d929-46c1-97be-b0fb580b480b';
UPDATE ow_companies SET slug = 'marketo'            WHERE id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5';
UPDATE ow_companies SET slug = 'miracle'            WHERE id = '355ce5c6-0412-4512-8864-1d477c97c917';
UPDATE ow_companies SET slug = 'lenovo'             WHERE id = 'f201ed17-a9e2-4859-85aa-474578b2870d';

-- ── Japanese companies with English brand names ───────────────────────────────
UPDATE ow_companies SET slug = 'ctc'         WHERE id = '138ff010-8671-414a-ab06-752d61f50dd7';
UPDATE ow_companies SET slug = 'fujifilm-bi' WHERE id = 'b8b7a2d4-20a8-4fe1-8651-61a6503f762e';
UPDATE ow_companies SET slug = 'ibm'         WHERE id = '9ef65fa1-e04b-4098-a7b1-4ee3d535a23a';
UPDATE ow_companies SET slug = 'oracle'      WHERE id = '1f8010f2-ba3f-4f7a-b7f4-d5b60400e638';
UPDATE ow_companies SET slug = 'hp'          WHERE id = '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6';
UPDATE ow_companies SET slug = 'microsoft'   WHERE id = '40dca29e-aa4b-4654-aada-8e29763f8521';
UPDATE ow_companies SET slug = 'hp-jp'       WHERE id = 'c32027b9-cfbd-4a70-bf4c-464e42790db4';

-- ── Mixed / Japanese-origin companies ────────────────────────────────────────
UPDATE ow_companies SET slug = 'irodas'      WHERE id = '63d390da-e8c4-464a-8c30-e112fcd2709c';
UPDATE ow_companies SET slug = 'opinio'      WHERE id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';
UPDATE ow_companies SET slug = 'pksha'       WHERE id = '09d67e54-0381-45c8-b698-568e1fc47033';
UPDATE ow_companies SET slug = 'test-co'     WHERE id = '4039a638-229d-421c-b8be-c2835bf0b9c7';
UPDATE ow_companies SET slug = 'third-box'   WHERE id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d';
UPDATE ow_companies SET slug = 'translead'   WHERE id = 'd1c26664-5643-42bc-84e4-6f0c940bb39d';
UPDATE ow_companies SET slug = 'agent-inc'   WHERE id = '7a048a8e-2c44-4f09-a727-8d7e6350851c';
UPDATE ow_companies SET slug = 'shinka'      WHERE id = '28b826eb-fb86-4124-aa08-c489cad662f1';
UPDATE ow_companies SET slug = 'salesforce'  WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
UPDATE ow_companies SET slug = 'timee'       WHERE id = '2e54ff06-2f4d-420c-9a5c-9a80a85ca55a';
UPDATE ow_companies SET slug = 'flyle'       WHERE id = 'cb386dd2-427c-49d1-b3f8-1e1d3a921fd8';
UPDATE ow_companies SET slug = 'workday'     WHERE id = '8dc04d46-3430-45de-91f8-e37c8880b8a5';
UPDATE ow_companies SET slug = 'kaikou-dengyou' WHERE id = 'fde6f9c3-e2a5-457f-a6f1-e184b3a57682';

-- ── Unique index ──────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS ow_companies_slug_idx ON ow_companies(slug) WHERE slug IS NOT NULL;

-- ── Verify ────────────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM ow_companies WHERE slug IS NULL;  -- should be 0
