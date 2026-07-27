-- Migration 278: 追加テストアカウント 3件を is_test=true に設定
-- 対象:
--   hshiba+01@third-box.jp  (柴 久人 / テスト用)
--   hshiba+03@third-box.jp  (山田 太郎 / テスト用)
--   d1872303951587@gmail.com (鈴木 太郎 / テスト用)
-- 保留: s.hisato1020@gmail.com (柴さん確認中)

UPDATE ow_users
SET is_test = true
WHERE email IN (
  'hshiba+01@third-box.jp',
  'hshiba+03@third-box.jp',
  'd1872303951587@gmail.com'
);
