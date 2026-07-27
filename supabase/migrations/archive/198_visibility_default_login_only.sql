-- Migration 198: ow_users.visibility デフォルトを login_only に変更
-- 背景: /u/[id] と /people をログイン必須にしたため、
--       デフォルト public のまま登録したユーザーを全員 login_only に変更。
--       本人が明示的に public を選んだかどうかは判別できないため、
--       既存全ユーザーを login_only に変更し、設定画面から public に戻せる。

-- 1. カラムのデフォルト値を変更
ALTER TABLE ow_users
  ALTER COLUMN visibility SET DEFAULT 'login_only';

-- 2. 既存ユーザー（public のまま）を全員 login_only に変更
UPDATE ow_users
  SET visibility = 'login_only'
  WHERE visibility = 'public';
