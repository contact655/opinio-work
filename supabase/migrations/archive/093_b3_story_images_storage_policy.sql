-- ν-8 段階6-3-3 Phase 3 B-3: story images の Storage INSERT パス制限ポリシー
--
-- 警告(B-3 着手時点で発覚した既存セキュリティ負債):
-- allow_all_storage ポリシー(qual="true", with_check="true")が全バケット・全操作を許可するため、
-- 本ポリシーは allow_all_storage が削除されるまで実質的にバイパスされる(forward-compatible policy)。
--
-- 加えて、現状はバケット ow-uploads の file_size_limit / allowed_mime_types も NULL のため、
-- フロントエンドのバリデーション(5MB、image/jpeg|png|webp|gif)が
-- 唯一のサーバーサイド外の防御線となっている。
--
-- 本番運用拡大前に、別 Issue で以下を対処すること:
--   1. allow_all_storage ポリシーの削除(既存アップロード機能の影響範囲調査込み)
--   2. バケット設定の file_size_limit / allowed_mime_types の適切化
--   3. 本ポリシーの動作検証(allow_all_storage 削除後)
--
-- パス命名規則: {auth_uid}/experience-stories/{uuid}.{ext}
--   auth_uid を第1セグメントにすることで、既存の ow_uploads_owner_delete / ow_uploads_owner_update
--   ポリシー(foldername(name)[1] = auth.uid())が story images の DELETE/UPDATE にも適用される。
--   (allow_all_storage 削除後に自動的に有効化)
--
-- 意図的にやらないこと:
--   - allow_all_storage ポリシーの削除: 既存ロゴ・写真アップロードへの影響調査が必要、別 Issue
--   - ow-uploads バケットの file_size_limit / allowed_mime_types 変更: 既存ファイルへの影響不確か
--   - バケット新規作成: ow-uploads 再利用で十分(企業ロゴ・オフィス写真と同バケット)

CREATE POLICY "story_images_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ow-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'experience-stories'
);
