-- 025: 画像アップロード機能のセットアップ
-- Supabase Dashboard → SQL Editor で実行してください

-- ═══ バケット作成 ═══
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('mentor-avatars',  'mentor-avatars',  true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('company-covers',  'company-covers',  true, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('user-avatars',    'user-avatars',    true, 3145728,  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ═══ RLSポリシー ═══

-- mentor-avatars
CREATE POLICY "Public read mentor-avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'mentor-avatars');
CREATE POLICY "Auth upload mentor-avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'mentor-avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update mentor-avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'mentor-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- company-covers
CREATE POLICY "Public read company-covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-covers');
CREATE POLICY "Auth upload company-covers" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'company-covers' AND auth.role() = 'authenticated');

-- user-avatars
CREATE POLICY "Public read user-avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-avatars');
CREATE POLICY "Auth upload user-avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update user-avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ═══ DBカラム追加 ═══
ALTER TABLE mentors
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS cover_image_url text;
