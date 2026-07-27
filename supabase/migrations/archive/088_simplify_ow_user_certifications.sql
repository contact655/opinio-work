-- ν-8 段階6-2 コミット D-2: ow_user_certifications を「資格名のみ」に簡素化
-- 削除カラム: issuer, issued_at, expires_at, no_expiry
-- 残すカラム: id, user_id, name, sort_order, created_at
-- ロールバック:
--   ALTER TABLE ow_user_certifications ADD COLUMN issuer text;
--   ALTER TABLE ow_user_certifications ADD COLUMN issued_at date;
--   ALTER TABLE ow_user_certifications ADD COLUMN expires_at date;
--   ALTER TABLE ow_user_certifications ADD COLUMN no_expiry boolean NOT NULL DEFAULT false;
-- ※ データはすでに 0 件（D-1 完了後 Hisato が追加前）、データ消失リスクなし

ALTER TABLE ow_user_certifications DROP COLUMN IF EXISTS issuer;
ALTER TABLE ow_user_certifications DROP COLUMN IF EXISTS issued_at;
ALTER TABLE ow_user_certifications DROP COLUMN IF EXISTS expires_at;
ALTER TABLE ow_user_certifications DROP COLUMN IF EXISTS no_expiry;

COMMENT ON TABLE ow_user_certifications IS
  '求職者の保有資格（資格名のみ）。1ユーザー = 0..N レコード、sort_order で表示順管理。';
