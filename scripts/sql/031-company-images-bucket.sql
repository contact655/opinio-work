-- company-images バケットを作成
-- Supabase SQL Editor で実行してください
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-images', 'company-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read company images"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-images');

CREATE POLICY "Auth users upload company images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-images'
  AND auth.role() = 'authenticated'
);
