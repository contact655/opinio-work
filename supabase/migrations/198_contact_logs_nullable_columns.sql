-- ow_contact_logs の company_id / actor_user_id を nullable に変更
-- コーポレートサイトのお問い合わせフォームは company_id / actor_user_id を持たないため
ALTER TABLE ow_contact_logs
  ALTER COLUMN company_id DROP NOT NULL,
  ALTER COLUMN actor_user_id DROP NOT NULL;
