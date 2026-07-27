-- Migration 260: ow_jobs.role_category_id を全件埋める
-- ow_roles の親カテゴリ UUID:
--   営業            : 6938712f-0b29-4682-ac6e-ad112734a3f1
--   エンジニア       : c8140123-e29a-43b3-9dbf-1a3d21a68966
--   カスタマーサクセス : ad47e554-e328-4aec-abd1-dab9953ddf9d
--   事業開発         : b49b9bc8-488b-47a5-80b0-9eba4869e910

-- 1. null → 適切なロールを設定
UPDATE ow_jobs SET role_category_id = 'c8140123-e29a-43b3-9dbf-1a3d21a68966'
WHERE job_category = 'エンジニア' AND role_category_id IS NULL;

UPDATE ow_jobs SET role_category_id = 'ad47e554-e328-4aec-abd1-dab9953ddf9d'
WHERE job_category = 'カスタマーサクセス' AND role_category_id IS NULL;

UPDATE ow_jobs SET role_category_id = '6938712f-0b29-4682-ac6e-ad112734a3f1'
WHERE job_category IN ('セールス', 'セールスエンジニア') AND role_category_id IS NULL;

UPDATE ow_jobs SET role_category_id = 'b49b9bc8-488b-47a5-80b0-9eba4869e910'
WHERE job_category = 'ビジネスオペレーション' AND role_category_id IS NULL;

-- 2. セールスエンジニア / ソリューションエンジニア / ソリューションズアーキテクトは
--    SaaS の文脈でプリセールス職（営業側）なので 営業 に修正
UPDATE ow_jobs SET role_category_id = '6938712f-0b29-4682-ac6e-ad112734a3f1'
WHERE job_category IN (
  'セールスエンジニア',
  'ソリューションエンジニア',
  'ソリューションズアーキテクト'
);
