-- 026: avatarsバケットを作成
-- Supabase Dashboard → SQL Editor で実行してください

-- avatarsバケットを作成（公開アクセス可能）
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 誰でも読めるポリシー
CREATE POLICY "Public read avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- 認証済みユーザーがアップロード可能
CREATE POLICY "Auth users upload avatars" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
