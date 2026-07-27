-- migration: 110_consultation_requests.sql
-- 相談リクエストテーブルを作成する
-- 運用フロー: ユーザー送信 → pending → 編集部がメンターをアサイン → matched → completed

CREATE TABLE ow_consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ow_users(id),
  mentor_user_id UUID REFERENCES ow_users(id) NULL,  -- 指名なしも可
  consultation_message TEXT NOT NULL,
  contact_info TEXT NOT NULL,  -- メール/電話/Slack 等
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  matched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_consultation_requests_status ON ow_consultation_requests(status);
CREATE INDEX idx_consultation_requests_user   ON ow_consultation_requests(user_id);
