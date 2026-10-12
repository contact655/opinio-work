-- ow_candidate_hidden を作る（2026-10-13 / 柴さんの指示。候補者を探すの「見送り」）
--
-- ★候補者を探すの一覧から外す（見送り）。**会社の担当者で共有**し、誰がいつ見送ったかを残す。
--   ⚠️★候補者本人には見せない・通知しない（企業の内部情報）。本人からは読めない（RLS）。
--   ⚠️ 社内メモの「見送り（社内）」（ow_candidate_tracking.stage = 'declined_internal'。CANDIDATE_NOTES_ENABLED のときだけ）とは別物。
--      そちらは使わない（柴さんの判断）。
--   ⚠️ 形は ow_candidate_stars（★）と同じ。列名も揃える（candidate_user_id は ow_users.id の空間）。
--
-- 権限（★のいまのポリシーと同じ。20261012200000_company_roles_four.sql）:
--   - RLS 有効。操作ごとにポリシーを分ける（FOR ALL にしない）
--   - SELECT … auth_company_can(company_id, 'view')
--   - INSERT … auth_company_can(company_id, 'work') かつ hidden_by が自分（auth_ow_user_id()）
--   - DELETE … auth_company_can(company_id, 'work')
--   - anon には何も渡さない。authenticated には SELECT / INSERT / DELETE（UPDATE は無し。付け外しだけ）
--
-- ⚠️ 新しい表なので作業前のダンプは無い（既存の行が無い）。

CREATE TABLE IF NOT EXISTS public.ow_candidate_hidden (
  company_id        uuid NOT NULL REFERENCES public.ow_companies(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL REFERENCES public.ow_users(id) ON DELETE CASCADE,
  hidden_by         uuid REFERENCES public.ow_users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, candidate_user_id)
);

COMMENT ON TABLE public.ow_candidate_hidden IS
  '候補者を探すの「見送り」（一覧から外す）。会社の担当者で共有。hidden_by / created_at が誰がいつ見送ったか。候補者本人には見せない・通知しない。';

ALTER TABLE public.ow_candidate_hidden ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ow_candidate_hidden FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.ow_candidate_hidden TO authenticated;

CREATE POLICY ow_candidate_hidden_select ON public.ow_candidate_hidden
  FOR SELECT TO authenticated
  USING (public.auth_company_can(company_id, 'view'));

CREATE POLICY ow_candidate_hidden_insert ON public.ow_candidate_hidden
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_company_can(company_id, 'work') AND hidden_by = public.auth_ow_user_id());

CREATE POLICY ow_candidate_hidden_delete ON public.ow_candidate_hidden
  FOR DELETE TO authenticated
  USING (public.auth_company_can(company_id, 'work'));

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.ow_candidate_hidden', 'SELECT') THEN
    RAISE EXCEPTION 'anon が ow_candidate_hidden を読める（想定外）';
  END IF;
  IF has_table_privilege('authenticated', 'public.ow_candidate_hidden', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated に UPDATE がある（想定外）';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.ow_candidate_hidden'::regclass) <> 3 THEN
    RAISE EXCEPTION 'ポリシーが3本でない';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.ow_candidate_hidden'::regclass AND polcmd = '*') <> 0 THEN
    RAISE EXCEPTION 'FOR ALL のポリシーがある（想定外）';
  END IF;
  RAISE NOTICE '適用後: ow_candidate_hidden を作成 / RLS 有効・ポリシー3本（select/insert/delete）/ anon は権限なし';
END $$;
