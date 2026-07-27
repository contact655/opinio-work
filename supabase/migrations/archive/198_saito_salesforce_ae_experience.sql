-- 生藤弘樹のセールスフォース・ジャパン在籍を SDR→AE の2ポジションに分割
-- 同一企業グループ表示（career-same-company）の動作検証用サンプルデータ

-- 既存 SDR レコードの在職期間を 2022-07 〜 2023-05 に短縮
UPDATE ow_experiences
SET ended_at = '2023-05-31'
WHERE id = 'dddea6da-2d51-4edc-8070-541ab4a4d7d7';

-- AE レコードを追加（2023-06 〜 2024-01）
INSERT INTO ow_experiences (
  user_id,
  company_id,
  role_title,
  role_category_id,
  started_at,
  ended_at,
  is_current
) VALUES (
  '0c99e403-7540-4cf9-8bb1-67571af4f2b6',  -- 生藤 弘樹
  'c3664ef1-5571-4645-b30f-1474e7961c17',  -- セールスフォース・ジャパン
  'Account Executive',
  '133c74c0-e432-4c52-8235-7ad9bc7d96b8',  -- フィールドセールス
  '2023-06-01',
  '2024-01-31',
  false
);
