-- 027: 既存メンターに仮のアバター画像URLを設定
-- Supabase Dashboard → SQL Editor で実行してください
-- 後で実写真に差し替えてください

UPDATE mentors SET avatar_url =
  'https://api.dicebear.com/7.x/initials/svg?seed=' || name || '&backgroundColor=1a9e75&textColor=ffffff'
WHERE avatar_url IS NULL;
