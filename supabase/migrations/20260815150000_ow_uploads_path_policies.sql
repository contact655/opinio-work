-- ═══════════════════════════════════════════════════════════════════════════
-- ow-uploads の書き込み・削除をパスで縛る
--
-- ── 直す前の状態（2026-08-15 実測）────────────────────────────────────────
--   ow_uploads_auth_insert … `auth.uid() IS NOT NULL` だけ。**パスを見ていない**。
--                            ログイン済みなら `users/avatars/<他人の id>/x.png` にも書けた。
--                            バケットは public read なので、置いた画像は誰でも開ける。
--   ow_uploads_owner_delete … `auth.uid()::text = foldername(name)[1]`。
--                            ⚠️ アプリのパスは `users/avatars/{ow_users.id}/…` なので
--                            [1] は常に 'users'。**利用者は自分の写真すら消せなかった。**
--                            孤児ファイルが積もる直接の原因（2026-08-15 時点 102件 / 13.2MB）。
--
-- ── ★空間の判断（案A を採る）────────────────────────────────────────────
--   このリポジトリは `auth.uid()`（auth.users.id）と `ow_users.id` の取り違えを何度も
--   起こしている。今回のパスは **3つの空間が混在**している:
--     users/{avatars|covers}/{ow_users.id}/…        ← ow_users.id
--     posts/{ow_users.id}/…                          ← ow_users.id
--     {auth.uid()}/experience-stories/…              ← auth.uid()
--     companies/{logos|office-photos|recruiter-avatars}/{company_id}/…  ← 企業
--
--   **案A（ポリシー側で ow_users を引く）を採る。** 理由:
--     ① 企業の画像は company_id ベースで、auth.uid() ベースには**そもそも寄せられない**。
--        案B（パスを auth.uid() に統一）を採っても2空間は残るので、目的を達しない。
--     ② 既存ファイルの URL が変わらない。案B は DB の URL 付け替え（複数テーブル）と
--        ファイル移動が必要で、失敗すると画像が消えたように見える。
--     ③ 既存のポリシー（ow_user_achievements_select_own など）が同じ書き方
--        （`in (select u.id from ow_users u where u.auth_id = auth.uid())`）で動いており、
--        読み方が揃う。
--
-- ⚠️ 判定は関数 `public.ow_uploads_can_write(text)` に1本化する。
--    INSERT / UPDATE / DELETE で同じ条件を3回書き写さない（片方だけ直す事故を防ぐ）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_ins int; v_del int;
BEGIN
  SELECT count(*) INTO v_ins FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects'
     AND policyname IN ('ow_uploads_auth_insert','story_images_auth_insert');
  SELECT count(*) INTO v_del FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects'
     AND policyname IN ('ow_uploads_owner_delete','ow_uploads_owner_update');
  IF v_ins <> 2 OR v_del <> 2 THEN
    RAISE EXCEPTION '想定のポリシーが揃っていない（insert=% / delete+update=%）。中止', v_ins, v_del;
  END IF;
  RAISE NOTICE '適用前: ow-uploads のポリシー4本を確認';
END $$;

-- ── 書き込んでよいパスかを判定する ──────────────────────────────────────────
-- ⚠️ SECURITY INVOKER（既定）のまま。呼び出した人の権限で ow_users を引く。
--    DEFINER にすると「誰の id か」の判定が呼び出し元と食い違う。
CREATE OR REPLACE FUNCTION public.ow_uploads_can_write(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    -- ① プロフィール画像・カバー: users/{avatars|covers}/{ow_users.id}/…
    (
      (storage.foldername(object_name))[1] = 'users'
      AND (storage.foldername(object_name))[2] IN ('avatars','covers')
      AND (storage.foldername(object_name))[3] IN (
        SELECT u.id::text FROM public.ow_users u WHERE u.auth_id = auth.uid()
      )
    )
    -- ② フィード投稿の画像: posts/{ow_users.id}/…
    OR (
      (storage.foldername(object_name))[1] = 'posts'
      AND (storage.foldername(object_name))[2] IN (
        SELECT u.id::text FROM public.ow_users u WHERE u.auth_id = auth.uid()
      )
    )
    -- ③ 経歴ストーリーの画像: {auth.uid()}/experience-stories/…
    --    ⚠️ ここだけ auth.uid() 空間。既存の story_images_auth_insert と同じ規則で、
    --       アプリ側（StoryAccordion）がこのパスで書いている。**揃えず、そのまま許す。**
    OR (
      auth.uid() IS NOT NULL
      AND (storage.foldername(object_name))[1] = auth.uid()::text
      AND (storage.foldername(object_name))[2] = 'experience-stories'
    )
    -- ④ 企業の画像: companies/{logos|office-photos|recruiter-avatars}/{company_id}/…
    --    ⚠️ uuid へのキャストをしない（キャスト失敗は例外になり、書き込みが 500 になる）。
    --       ow_companies と text で突き合わせる。
    OR (
      (storage.foldername(object_name))[1] = 'companies'
      AND (storage.foldername(object_name))[2] IN ('logos','office-photos','recruiter-avatars')
      AND (
        public.auth_is_admin()
        OR EXISTS (
          SELECT 1 FROM public.ow_companies c
           WHERE c.id::text = (storage.foldername(object_name))[3]
             AND public.auth_is_company_admin(c.id)
        )
      )
    );
$$;

COMMENT ON FUNCTION public.ow_uploads_can_write(text) IS
  'ow-uploads バケットで、いま操作している人がそのパスに書いてよいか。INSERT/UPDATE/DELETE の3ポリシーが共有する';

-- ── ポリシーを差し替える ────────────────────────────────────────────────────
DROP POLICY "ow_uploads_auth_insert"   ON storage.objects;
DROP POLICY "story_images_auth_insert" ON storage.objects;  -- ③ に統合した
DROP POLICY "ow_uploads_owner_delete"  ON storage.objects;
DROP POLICY "ow_uploads_owner_update"  ON storage.objects;

CREATE POLICY "ow_uploads_write_own_paths" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ow-uploads' AND public.ow_uploads_can_write(name));

CREATE POLICY "ow_uploads_update_own_paths" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ow-uploads' AND public.ow_uploads_can_write(name))
  WITH CHECK (bucket_id = 'ow-uploads' AND public.ow_uploads_can_write(name));

CREATE POLICY "ow_uploads_delete_own_paths" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ow-uploads' AND public.ow_uploads_can_write(name));

-- ⚠️ 読み取り（ow_uploads_public_read）は**触らない**。
--    バケットが public のうちは、URL を知っていれば誰でも開ける。
--    「削除したのに見え続ける」の本体は**実ファイルを消していないこと**なので、
--    そちらをアプリ側で直す（同じコミット）。

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_new int; v_old int;
BEGIN
  SELECT count(*) INTO v_new FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects'
     AND policyname IN ('ow_uploads_write_own_paths','ow_uploads_update_own_paths','ow_uploads_delete_own_paths');
  IF v_new <> 3 THEN RAISE EXCEPTION '新しいポリシーが % 本（想定3）。ロールバック', v_new; END IF;

  SELECT count(*) INTO v_old FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects'
     AND policyname IN ('ow_uploads_auth_insert','story_images_auth_insert','ow_uploads_owner_delete','ow_uploads_owner_update');
  IF v_old <> 0 THEN RAISE EXCEPTION '古いポリシーが % 本残っている。ロールバック', v_old; END IF;

  -- 公開読み取りは残っていること（消すと全ページの画像が出なくなる）
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='storage' AND tablename='objects'
                    AND policyname='ow_uploads_public_read') THEN
    RAISE EXCEPTION '公開読み取りポリシーまで消えた。ロールバック';
  END IF;

  RAISE NOTICE '完了: write/update/delete はパス判定に統一。public_read は据え置き';
END $$;

COMMIT;
