-- ═══════════════════════════════════════════════════════════════════════════
-- ポリシーの「空間取り違え」を直す（7本）
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- user_id 系の列がどの空間かはテーブルごとに違う。
--   auth.uid() 空間     … ow_user_roles / ow_profiles / ow_terms_agreements
--   ow_users.id 空間    … ow_experiences / ow_user_educations
--                         ow_company_members / ow_company_admins
-- ow_users.id 空間の列を auth.uid() と直接比較しているポリシーが7本あり、
-- **常に false**（＝誰にもマッチしない）になっていた。実測で確認済み:
--   企業担当者（非admin・自社メンバー0件）が ow_company_members を 4件読めていたが、
--   その4件は is_public AND display_consent の行数と一致し、
--   company_admin_read_members / own_member_read は1行も寄与していなかった。
--
-- ⚠️ すべて**拒否側**に倒れているので事故は起きていない。
--    直すと権限が「開く」方向に動く。範囲を実測してから入れること。
-- ⚠️ 7本とも現在は使われていない機能に付いている
--    （メンバー掲載の本人同意UI・企業側のメンバー管理はいずれも admin クライアント経由）。
--    将来その機能を session 経由で作ったときに、静かに「操作できない」として現れる。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_pol int; v_mem int; v_pub int;
BEGIN
  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_company_members';
  IF v_pol <> 8 THEN RAISE EXCEPTION 'ow_company_members のポリシーが % 本（想定8）。中止', v_pol; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_is_company_admin') THEN
    RAISE EXCEPTION 'auth_is_company_admin が無い。中止';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_is_admin') THEN
    RAISE EXCEPTION 'auth_is_admin が無い。中止';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE is_public AND display_consent) INTO v_mem, v_pub
    FROM public.ow_company_members;
  RAISE NOTICE '適用前: ow_company_members % 件（うち公開 % 件）', v_mem, v_pub;
END $$;

-- ── ① ヘルパー ─────────────────────────────────────────────────────────────
-- ⚠️ 自前 JOIN を各ポリシーに散らさない。ここ1本に閉じる。
--    既存の auth_is_admin / auth_is_company_admin と同じ作り
--    （SECURITY DEFINER / STABLE / search_path 固定 / row_security off）。
--    row_security off が要る: ow_users 自身の RLS を評価すると再帰しうるため。
CREATE OR REPLACE FUNCTION public.auth_ow_user_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $$
  SELECT u.id FROM public.ow_users u WHERE u.auth_id = auth.uid();
$$;

COMMENT ON FUNCTION public.auth_ow_user_id() IS
  'ログイン中のユーザーの ow_users.id を返す（未ログインなら NULL）。'
  ' ⚠️ user_id が ow_users.id 空間のテーブルでポリシーを書くときは、'
  ' auth.uid() と直接比較せずこれを使う。空間の取り違えで常に false になる事故が'
  ' 2026-08-06 時点で7本あった。どちらの空間かは docs/user-id-spaces.md を見ること。';

ALTER FUNCTION public.auth_ow_user_id() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.auth_ow_user_id() FROM PUBLIC;
-- ⚠️ anon にも EXECUTE が要る。下の own 系ポリシーは TO 句が無く
--    anon にも評価されるため、EXECUTE が無いとクエリ自体がエラーになる。
--    anon では auth.uid() が NULL なので戻り値も NULL で、何も開かない。
GRANT EXECUTE ON FUNCTION public.auth_ow_user_id() TO anon, authenticated, service_role;

-- ── ② ow_company_members（本人系3本）────────────────────────────────────────
DROP POLICY "own_member_read" ON public.ow_company_members;
CREATE POLICY "own_member_read" ON public.ow_company_members
  FOR SELECT USING (user_id = public.auth_ow_user_id());

DROP POLICY "own_member_consent" ON public.ow_company_members;
CREATE POLICY "own_member_consent" ON public.ow_company_members
  FOR UPDATE TO authenticated
  USING (user_id = public.auth_ow_user_id())
  WITH CHECK (user_id = public.auth_ow_user_id());

DROP POLICY "member_delete" ON public.ow_company_members;
CREATE POLICY "member_delete" ON public.ow_company_members
  FOR DELETE TO authenticated
  USING (user_id = public.auth_ow_user_id() OR public.auth_is_company_admin(company_id));

-- ── ③ ow_company_members（企業admin系3本）──────────────────────────────────
-- ⚠️ 既存の auth_is_company_admin() に寄せる。この関数は
--      permission = 'admin' AND is_active = true
--    まで見る。壊れていた元の条件式は company_id の一致しか見ておらず、
--    permission も is_active も見ていなかった。
--    どちらも「壊れていて誰にもマッチしない」状態だったので実挙動の後退は無い。
--    /biz 側の他の判定（requireAdmin）と揃うほうを採った。
DROP POLICY "company_admin_read_members" ON public.ow_company_members;
CREATE POLICY "company_admin_read_members" ON public.ow_company_members
  FOR SELECT TO authenticated
  USING (public.auth_is_company_admin(company_id));

DROP POLICY "company_admin_invite_member" ON public.ow_company_members;
CREATE POLICY "company_admin_invite_member" ON public.ow_company_members
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_company_admin(company_id) AND display_consent = false);

DROP POLICY "company_admin_update_member" ON public.ow_company_members;
CREATE POLICY "company_admin_update_member" ON public.ow_company_members
  FOR UPDATE TO authenticated
  USING (public.auth_is_company_admin(company_id));

-- ── ④ ow_career_profiles（自前JOINをやめる）────────────────────────────────
DROP POLICY "career_profiles_admin_all" ON public.ow_career_profiles;
CREATE POLICY "career_profiles_admin_all" ON public.ow_career_profiles
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_pol int; v_bad int; v_names text; v_mem int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_ow_user_id') THEN
    RAISE EXCEPTION 'auth_ow_user_id が作られていない。ロールバック';
  END IF;

  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_company_members';
  IF v_pol <> 8 THEN RAISE EXCEPTION 'ポリシー数が % 本（想定8）。ロールバック', v_pol; END IF;

  -- 直した7本に auth.uid() との直接比較が残っていないこと
  SELECT count(*), string_agg(policyname, ' / ') INTO v_bad, v_names
    FROM pg_policies
   WHERE schemaname='public'
     AND policyname IN ('own_member_read','own_member_consent','member_delete',
                        'company_admin_read_members','company_admin_invite_member',
                        'company_admin_update_member','career_profiles_admin_all')
     AND (coalesce(qual,'') ~ 'user_id = auth\.uid\(\)'
       OR coalesce(with_check,'') ~ 'user_id = auth\.uid\(\)'
       OR coalesce(qual,'') ~ 'ow_users'          -- 自前 JOIN の残骸
       OR coalesce(with_check,'') ~ 'ow_users');
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '空間取り違えが % 本残っている（%）。ロールバック', v_bad, v_names;
  END IF;

  -- 公開読み取り（public_members_read）を壊していないこと
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='ow_company_members'
                    AND policyname='public_members_read') THEN
    RAISE EXCEPTION 'public_members_read が消えた。ロールバック';
  END IF;

  -- データを触っていないこと
  SELECT count(*) INTO v_mem FROM public.ow_company_members;
  IF v_mem <> 6 THEN RAISE EXCEPTION 'ow_company_members が % 件（想定6）。ロールバック', v_mem; END IF;

  RAISE NOTICE '完了: 7本を書き直し / auth_ow_user_id を作成 / ow_company_members % 件は変更なし', v_mem;
END $$;

COMMIT;
