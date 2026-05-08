-- ν-8 段階1: SNS 連携テーブル新規作成
-- ν-8 では URL 貼付のみ、ν-9 以降で OAuth 連携を検討（verified / oauth_token 伏線）

CREATE TABLE ow_user_socials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  username TEXT,
  custom_label TEXT,
  sort_order INTEGER NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  oauth_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ow_user_socials_platform_check
    CHECK (platform IN ('note', 'x', 'github', 'linkedin', 'other'))
);

CREATE INDEX ow_user_socials_user_id_idx ON ow_user_socials(user_id);

COMMENT ON TABLE ow_user_socials IS 'ユーザーのSNS連携。ν-8 ではURL貼付のみ、ν-9 以降でOAuth連携を検討（verified/oauth_token 伏線）。';
COMMENT ON COLUMN ow_user_socials.platform IS 'プラットフォーム種別。note/x/github/linkedin の4種固定 + その他枠。';
COMMENT ON COLUMN ow_user_socials.url IS '生 URL。ユーザーが直接貼り付け。';
COMMENT ON COLUMN ow_user_socials.username IS '@hisato_shiba 等のハンドル。URLから自動抽出（フロント実装）。';
COMMENT ON COLUMN ow_user_socials.custom_label IS 'platform=other のときの表示名（任意）。例: Wantedly, YouTube';
COMMENT ON COLUMN ow_user_socials.sort_order IS '表示順制御。ν-8 では platform 固定順 + その他枠は入力順。';
COMMENT ON COLUMN ow_user_socials.verified IS 'ν-9 で OAuth 連携時に true。ν-8 では常に false。';
COMMENT ON COLUMN ow_user_socials.oauth_token IS 'ν-9 以降で OAuth 連携時に保存。ν-8 では常に null。暗号化推奨。';

ALTER TABLE ow_user_socials ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが閲覧可能（公開プロフィール）
CREATE POLICY "ow_user_socials_select_all"
  ON ow_user_socials FOR SELECT USING (true);

-- 自分のレコードのみ INSERT 可
-- 既存パターン: user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
CREATE POLICY "ow_user_socials_insert_own"
  ON ow_user_socials FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

-- 自分のレコードのみ UPDATE 可
CREATE POLICY "ow_user_socials_update_own"
  ON ow_user_socials FOR UPDATE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

-- 自分のレコードのみ DELETE 可
CREATE POLICY "ow_user_socials_delete_own"
  ON ow_user_socials FOR DELETE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));
