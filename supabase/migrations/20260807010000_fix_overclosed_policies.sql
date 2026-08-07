-- ═══════════════════════════════════════════════════════════════════════════
-- 「閉じすぎ」ポリシー4件を直す（security-C の結果を受けて）
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- 0件テーブルに1件ずつ投入して4セッションで測ったところ、**開きすぎは0件**だったが、
-- 「誰も読めない」「本人が読めない」ものが4つあった。
-- いずれも該当機能が未実装なので実害は出ていないが、作った瞬間に静かに現れる。
--
--   ow_invoices          admin すら読めない。条件が ow_user_roles.role='company' だが
--                        その行が **0件**（内訳は candidate 22 / admin 2）
--   ow_match_scores      admin すら読めない。user_id に FK が無く空間が不定
--   ow_matches           本人が自分のマッチを読めない（企業側ポリシーしか無い）
--   ow_meeting_feedbacks 運営が読めない（本人ポリシーしか無い）
--
-- ⚠️ 直すと権限が「開く」方向に動く。適用後に4セッションで実測すること。
--    特に ow_invoices は請求データなので、他社テナントが読めないことを必ず確認する。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_company_roles int; v_fk int;
BEGIN
  FOR v_fk IN SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_is_company_admin') LOOP
    RAISE EXCEPTION 'auth_is_company_admin が無い。中止';
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_ow_user_id') THEN
    RAISE EXCEPTION 'auth_ow_user_id が無い。先に 20260806220000 を適用すること。中止';
  END IF;

  -- 'company' ロールが本当に未使用であることを確認してから依存を外す
  SELECT count(*) INTO v_company_roles FROM public.ow_user_roles WHERE role = 'company';
  IF v_company_roles <> 0 THEN
    RAISE EXCEPTION 'ow_user_roles に role=company が % 件ある。依存を外す前提が崩れている。中止', v_company_roles;
  END IF;

  -- ow_match_scores.user_id に FK が無いこと（これから張る）
  SELECT count(*) INTO v_fk FROM pg_constraint
   WHERE conrelid = 'public.ow_match_scores'::regclass AND contype = 'f'
     AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                          WHERE attrelid='public.ow_match_scores'::regclass AND attname='user_id')];
  IF v_fk <> 0 THEN RAISE EXCEPTION 'ow_match_scores.user_id に既に FK がある。中止'; END IF;

  RAISE NOTICE '適用前: role=company % 件 / ow_match_scores.user_id の FK % 本', v_company_roles, v_fk;
END $$;

-- ── ① ow_invoices ──────────────────────────────────────────────────────────
-- 変更前: tenant_id IN (SELECT tenant_id FROM ow_user_roles
--                       WHERE user_id = auth.uid() AND role = 'company' AND tenant_id IS NOT NULL)
-- role='company' が0件なので誰にもマッチしない。会社の判定は auth_is_company_admin に寄せる。
DROP POLICY "tenant members read invoice" ON public.ow_invoices;
CREATE POLICY "company admins read invoice" ON public.ow_invoices
  FOR SELECT USING (public.auth_is_company_admin(tenant_id));
CREATE POLICY "admin reads invoice" ON public.ow_invoices
  FOR SELECT USING (public.auth_is_admin());

-- ── ② ow_match_scores ──────────────────────────────────────────────────────
-- ⚠️ user_id の空間を確定させる。唯一の読み手である cron（weekly-match）は
--    ow_profiles.user_id（= auth 空間）で引いており、既存ポリシーも auth.uid() 比較。
--    よって auth.users を参照する FK を張り、auth 空間として確定させる。
--    0件なので既存行との衝突は無い。
ALTER TABLE public.ow_match_scores
  ADD CONSTRAINT ow_match_scores_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "admin reads match scores" ON public.ow_match_scores
  FOR SELECT USING (public.auth_is_admin());

-- ── ③ ow_matches ───────────────────────────────────────────────────────────
-- ⚠️ ow_matches.user_id は ow_users.id 空間（FK が ow_users を指す）。
--    auth.uid() と直接比べず auth_ow_user_id() を使う。
CREATE POLICY "ow_matches_own_read" ON public.ow_matches
  FOR SELECT USING (user_id = public.auth_ow_user_id());

-- ── ④ ow_meeting_feedbacks ─────────────────────────────────────────────────
CREATE POLICY "admin reads meeting feedbacks" ON public.ow_meeting_feedbacks
  FOR SELECT USING (public.auth_is_admin());

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_bad int; v_names text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ow_invoices'
              AND policyname='tenant members read invoice') THEN
    RAISE EXCEPTION '旧ポリシーが残っている。ロールバック';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='ow_invoices') <> 2 THEN
    RAISE EXCEPTION 'ow_invoices のポリシー数が想定と違う。ロールバック';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname='ow_match_scores_user_id_fkey') THEN
    RAISE EXCEPTION 'ow_match_scores の FK が張られていない。ロールバック';
  END IF;

  -- 新しく足したポリシーに空間取り違えが無いこと
  SELECT count(*), string_agg(policyname, ' / ') INTO v_bad, v_names
    FROM pg_policies
   WHERE schemaname='public'
     AND policyname IN ('ow_matches_own_read','company admins read invoice',
                        'admin reads invoice','admin reads match scores','admin reads meeting feedbacks')
     AND coalesce(qual,'') ~ 'user_id = auth\.uid\(\)';
  IF v_bad <> 0 THEN RAISE EXCEPTION '空間取り違えが % 本（%）。ロールバック', v_bad, v_names; END IF;

  RAISE NOTICE '完了: ow_invoices 2本 / ow_match_scores に FK と admin ポリシー / ow_matches に本人 / ow_meeting_feedbacks に admin';
END $$;

COMMIT;
