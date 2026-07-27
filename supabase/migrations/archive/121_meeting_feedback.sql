-- Migration 121: カジュアル面談フィードバック
-- 面談完了後の内部評価データ収集（運営のみ閲覧可能）

CREATE TABLE IF NOT EXISTS ow_meeting_feedbacks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id    uuid NOT NULL,           -- ow_casual_meetings.id を参照
  user_id       uuid NOT NULL,           -- フィードバックを送ったユーザー
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  -- 1=とても残念 2=やや残念 3=普通 4=良かった 5=とても良かった
  comment       text,                   -- 自由記述（任意）
  helpful_tags  text[] DEFAULT '{}',    -- 例: {"情報量が多かった","フレンドリーだった"}
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (meeting_id, user_id)          -- 同一面談に同一ユーザーは1回のみ
);

-- RLS: 自分のフィードバックのみ読み書き可、管理者は全件読み取り可
ALTER TABLE ow_meeting_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can insert own feedback"
  ON ow_meeting_feedbacks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = (SELECT auth_id FROM ow_users WHERE id = user_id));

CREATE POLICY "users can read own feedback"
  ON ow_meeting_feedbacks FOR SELECT
  TO authenticated
  USING (auth.uid() = (SELECT auth_id FROM ow_users WHERE id = user_id));

-- 管理者ポリシー（auth_is_admin() 関数が既存と仮定）
-- CREATE POLICY "admins can read all feedback" ON ow_meeting_feedbacks FOR SELECT USING (auth_is_admin());

COMMENT ON TABLE ow_meeting_feedbacks IS 'カジュアル面談後のフィードバック（内部用）';
