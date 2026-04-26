-- メンターのキャリア経歴テキストカラム追加
ALTER TABLE mentors ADD COLUMN IF NOT EXISTS career_history_text text;
