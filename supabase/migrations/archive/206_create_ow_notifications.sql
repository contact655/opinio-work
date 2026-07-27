-- Migration 206: ow_notifications テーブル作成
-- アプリ内通知（いいね・コメント）の土台

CREATE TABLE IF NOT EXISTS ow_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  actor_user_id     UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('like', 'comment')),
  post_id           UUID NOT NULL REFERENCES ow_posts(id) ON DELETE CASCADE,
  comment_id        UUID REFERENCES ow_post_comments(id) ON DELETE CASCADE,
  is_read           BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 未読通知の取得が多いため、受信者 + 未読フラグ + 日時 の複合インデックス
CREATE INDEX IF NOT EXISTS idx_ow_notifications_recipient
  ON ow_notifications(recipient_user_id, is_read, created_at DESC);

-- RLS 有効化
ALTER TABLE ow_notifications ENABLE ROW LEVEL SECURITY;

-- 本人（recipient_user_id）だけ自分の通知を閲覧できる
CREATE POLICY "notifications_select_own"
  ON ow_notifications
  FOR SELECT
  USING (
    recipient_user_id = (
      SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

-- 本人（recipient_user_id）だけ既読更新できる（is_read の更新用）
CREATE POLICY "notifications_update_own"
  ON ow_notifications
  FOR UPDATE
  USING (
    recipient_user_id = (
      SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1
    )
  )
  WITH CHECK (
    recipient_user_id = (
      SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

-- INSERT は API 側の service role (admin client) 経由のみ
-- anon / authenticated には INSERT 権限を与えない（RLS ポリシーなし = 拒否）
