-- Add tagged_user_id to link a person in the photo to their OPINIO user profile
ALTER TABLE ow_company_office_photos
ADD COLUMN IF NOT EXISTS tagged_user_id uuid REFERENCES ow_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN ow_company_office_photos.tagged_user_id IS '写真に写っているユーザーのID（ow_users.id）。プロフィールリンクに使用';
