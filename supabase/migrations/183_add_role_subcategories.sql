-- Migration 183: コーポレートにサブカテゴリ追加 + 営業にSDR/BDR追加
-- コーポレート ID: 23e79605-332b-485d-98c2-d162a491a409
-- 営業 ID: 6938712f-0b29-4682-ac6e-ad112734a3f1

INSERT INTO ow_roles (id, name, parent_id, display_order) VALUES
  (gen_random_uuid(), 'HR・人事',       '23e79605-332b-485d-98c2-d162a491a409', 1),
  (gen_random_uuid(), '財務・経理',     '23e79605-332b-485d-98c2-d162a491a409', 2),
  (gen_random_uuid(), '法務・リーガル', '23e79605-332b-485d-98c2-d162a491a409', 3),
  (gen_random_uuid(), '総務',           '23e79605-332b-485d-98c2-d162a491a409', 4),
  (gen_random_uuid(), '広報・PR',       '23e79605-332b-485d-98c2-d162a491a409', 5),
  (gen_random_uuid(), 'SDR/BDR',        '6938712f-0b29-4682-ac6e-ad112734a3f1', 3);
