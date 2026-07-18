-- Migration 255: Add slug column to ow_jobs + backfill 27 jobs
-- Pattern: {company-slug}-{english-title-words}-{first6-of-uuid}
-- Applied: 2026-07-18

ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE ow_jobs SET slug = 'databricks-enterprise-ae-fcabb1'       WHERE id = 'fcabb160-7fbc-436b-8775-dde831d1d14d';
UPDATE ow_jobs SET slug = 'databricks-solutions-architect-ff8fb0'  WHERE id = 'ff8fb0e7-bf5d-47f3-a041-8dfbfc5191ec';
UPDATE ow_jobs SET slug = 'datadog-enterprise-ae-bcee57'           WHERE id = 'bcee5792-84a6-4738-bcf7-6885391e79d8';
UPDATE ow_jobs SET slug = 'datadog-sales-engineer-7c2a70'          WHERE id = '7c2a70aa-4788-44a2-ab3d-0246c5f40cf5';
UPDATE ow_jobs SET slug = 'hubspot-account-executive-12d08d'        WHERE id = '12d08d2f-0142-43c0-a171-c1a4307001ac';
UPDATE ow_jobs SET slug = 'hubspot-csm-7544bc'                     WHERE id = '7544bcef-19a8-4bca-9ca4-39ff175943a1';
UPDATE ow_jobs SET slug = 'hubspot-solutions-engineer-c18b31'      WHERE id = 'c18b3155-47d4-4517-ace7-40f129ce9e14';
UPDATE ow_jobs SET slug = 'notion-ae-smb-317675'                   WHERE id = '317675a9-82f2-486f-84b3-742dda710a15';
UPDATE ow_jobs SET slug = 'notion-solutions-engineer-289823'       WHERE id = '28982315-1f3c-48c6-86a0-ba336b7683ec';
UPDATE ow_jobs SET slug = 'openai-enterprise-ae-6d8afa'            WHERE id = '6d8afa7d-10ab-422d-ba86-ce54a67e8944';
UPDATE ow_jobs SET slug = 'openai-solutions-architect-044f7a'      WHERE id = '044f7a66-a0b6-42b2-b196-1d986966f913';
UPDATE ow_jobs SET slug = 'sansan-rails-engineer-e890f5'           WHERE id = 'e890f554-efd4-40f2-9a7a-a93502933eaf';
UPDATE ow_jobs SET slug = 'sansan-customer-success-6a6a0d'         WHERE id = '6a6a0d23-239e-48a2-b376-9270eccaaa97';
UPDATE ow_jobs SET slug = 'smarthr-ruby-engineer-310848'           WHERE id = '31084829-1422-40a0-b20e-562469e8af46';
UPDATE ow_jobs SET slug = 'smarthr-customer-success-a6524d'        WHERE id = 'a6524df1-4e3e-474f-a9b1-08c7f19e8894';
UPDATE ow_jobs SET slug = 'smarthr-product-designer-326b14'        WHERE id = '326b1409-5d13-410e-aef7-9e16023c680e';
UPDATE ow_jobs SET slug = 'ubie-software-engineer-c58858'          WHERE id = 'c58858b6-0f09-4cbb-aed3-996ddd90aab5';
UPDATE ow_jobs SET slug = 'ubie-product-manager-882277'            WHERE id = '8822778f-cda9-4009-8f6b-c1a01773f91f';
UPDATE ow_jobs SET slug = 'opinio-test-6b18cf'                     WHERE id = '6b18cfad-6c3f-41ca-b0eb-3da7230572dc';
UPDATE ow_jobs SET slug = 'opinio-test-94c4d5'                     WHERE id = '94c4d533-8413-4f94-bd1d-53cc0ace3d39';
UPDATE ow_jobs SET slug = 'pksha-ai-research-engineer-8899c9'      WHERE id = '8899c9e8-8c6a-4cd5-b1c4-5caafb5c0653';
UPDATE ow_jobs SET slug = 'pksha-ml-engineer-dd4755'               WHERE id = 'dd4755ac-c224-43ee-aac8-c8b7990ea323';
UPDATE ow_jobs SET slug = 'salesforce-ae-mulesoft-ad7ba4'          WHERE id = 'ad7ba4b6-64af-4a5c-a4df-e94def9f6262';
UPDATE ow_jobs SET slug = 'salesforce-ase-tableau-8e64f7'          WHERE id = '8e64f7be-888a-4bac-af6e-02f8286ff91d';
UPDATE ow_jobs SET slug = 'salesforce-biz-ops-ai-351aa1'           WHERE id = '351aa137-9fe2-4702-99dd-b06049450eaf';
UPDATE ow_jobs SET slug = 'salesforce-csm-director-cffdb2'         WHERE id = 'cffdb2da-9c2f-4795-a338-a584d9129844';
UPDATE ow_jobs SET slug = 'salesforce-lead-se-tableau-c7e717'      WHERE id = 'c7e71739-0886-40ef-aae2-6ebd6e101bf6';

CREATE UNIQUE INDEX IF NOT EXISTS ow_jobs_slug_idx ON ow_jobs(slug) WHERE slug IS NOT NULL;

-- SELECT COUNT(*) FROM ow_jobs WHERE slug IS NULL;  -- should be 0
