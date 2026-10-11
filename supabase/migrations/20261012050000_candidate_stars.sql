-- ow_candidate_stars を作る（2026-10-12 / 柴さんの指示）
--
-- ★候補者を探すの「★」（気になる）。**会社の管理者で共有**し、誰がいつ保存したかを残す。
--   ⚠️ 候補者本人には見せない・通知しない（本人からは読めない。RLS は会社の現役管理者だけ）。
--   ⚠️ 社内メモの「気になる」（ow_candidate_tracking の stage=interested。CANDIDATE_NOTES_ENABLED のときだけ）とは別物。
--
-- 権限:
--   - RLS 有効。SELECT / INSERT / DELETE とも `auth_is_active_company_admin(company_id)`（その会社の現役の管理者）だけ
--   - INSERT は starred_by が自分（auth_ow_user_id()）であること
--   - anon には何も渡さない。authenticated には SELECT / INSERT / DELETE（UPDATE は無し。付け外しだけ）
--
-- ⚠️ 新しい表なので作業前のダンプは無い（既存の行が無い）。

CREATE TABLE IF NOT EXISTS public.ow_candidate_stars (
  company_id        uuid NOT NULL REFERENCES public.ow_companies(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL REFERENCES public.ow_users(id) ON DELETE CASCADE,
  starred_by        uuid REFERENCES public.ow_users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, candidate_user_id)
);

COMMENT ON TABLE public.ow_candidate_stars IS
  '候補者を探すの「★」（気になる）。会社の管理者で共有。starred_by / created_at が誰がいつ保存したか。候補者本人には見せない・通知しない。';

ALTER TABLE public.ow_candidate_stars ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ow_candidate_stars FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.ow_candidate_stars TO authenticated;

CREATE POLICY ow_candidate_stars_select ON public.ow_candidate_stars
  FOR SELECT TO authenticated
  USING (public.auth_is_active_company_admin(company_id));

CREATE POLICY ow_candidate_stars_insert ON public.ow_candidate_stars
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_active_company_admin(company_id) AND starred_by = public.auth_ow_user_id());

CREATE POLICY ow_candidate_stars_delete ON public.ow_candidate_stars
  FOR DELETE TO authenticated
  USING (public.auth_is_active_company_admin(company_id));

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.ow_candidate_stars', 'SELECT') THEN
    RAISE EXCEPTION 'anon が ow_candidate_stars を読める（想定外）';
  END IF;
  IF has_table_privilege('authenticated', 'public.ow_candidate_stars', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated に UPDATE がある（想定外）';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.ow_candidate_stars'::regclass) <> 3 THEN
    RAISE EXCEPTION 'ポリシーが3本でない';
  END IF;
  RAISE NOTICE '適用後: ow_candidate_stars を作成 / RLS 有効・ポリシー3本 / anon は権限なし';
END $$;
