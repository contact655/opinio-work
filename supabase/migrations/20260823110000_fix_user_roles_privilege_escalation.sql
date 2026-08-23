-- ============================================================================
-- ow_user_roles の権限昇格を塞ぐ
--
-- 2026-08-23。**ログイン中の誰でも自分に運営権限を付けられる形になっていた。**
--
--   INSERT INTO ow_user_roles (user_id, role) VALUES (auth.uid(), 'admin')
--
-- `ow_user_roles_own_insert` の WITH CHECK は `auth.uid() = user_id` だけで、
-- **`role` の値を見ていなかった。** CHECK 制約は
-- `role IN ('candidate','company','admin')` なので 'admin' は通る。
-- `ow_user_roles_own_update` も同じ式で、既存行の role を書き換えられた。
--
-- ⚠️ **`auth_is_admin()` はこの表を `SET row_security = off` で読む。**
--    通れば `/admin` 全画面・`ow_settings`・求人の公開承認・企業の承認が開く。
-- ⚠️ 2026-08-23 に入れた求人の公開ガード `trg_guard_job_status` も
--    `auth_is_admin()` を通す作りなので、**この穴が開いている限り迂回できた。**
--
-- ── アプリ側は既に正しい ────────────────────────────────────────────────
-- `POST /api/roles` には許可リストがあり、**自己付与できるのは 'candidate' のみ**
-- （`SELF_ASSIGNABLE_ROLES = ["candidate"]`）。`'company'` は明示的に拒否し、
-- 「`ow_company_admins` で管理する」とコメントにある（`lib/roles.ts` も同じ）。
-- **穴はアプリではなく、PostgREST を直接叩く経路。** `ow_jobs` と同じ形。
--
-- → **RLS をアプリの規則に揃える。自己付与は 'candidate' のみ。**
--    'company' を自己申告で付けられるようにはしない（アプリが既に禁じている）。
--
-- ── ⚠️ `auth_is_admin()` を条件に使わないこと ──────────────────────────
-- この表は `auth_is_admin()` の**根拠**なので、ポリシーに書くと循環する
-- （admin 行を作れた人が admin 判定を通り、さらに admin 行を作れる）。
-- **運営による付与は service_role 経由（`/admin` 画面）に限る。**
-- service_role は RLS を迂回するのでポリシーを書く必要がない。
--
-- ── 既存行の監査（塞ぐ前に実施）────────────────────────────────────────
-- **不審な行なし。** 36行 / 34人 / admin 2行 / company 0行 / candidate 34行。
--   ・admin 2行はいずれも `admin + candidate` の組み合わせで、
--     「求職者として登録 → 後から運営を付与」の形と整合する
--   ・36行すべて created_at が異なる秒（一括投入の痕跡なし）
--   ・2026-04〜08 に分散（登録のたびに candidate が1行増える動きと一致）
--   ・`role='company'` は0行（アプリが禁じているとおり）
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- DROP POLICY ow_user_roles_own_insert ON public.ow_user_roles;
-- CREATE POLICY ow_user_roles_own_insert ON public.ow_user_roles
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY ow_user_roles_own_update ON public.ow_user_roles
--   FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- DROP POLICY ow_user_roles_own_delete ON public.ow_user_roles;
-- CREATE POLICY ow_user_roles_own_delete ON public.ow_user_roles
--   FOR DELETE USING (auth.uid() = user_id);
-- GRANT UPDATE ON TABLE public.ow_user_roles TO authenticated;
-- 作業前ダンプ: .dumps/20260823-*-ow_user_roles.sql（36行）
-- ============================================================================

-- ── ① 適用前の検算 ──────────────────────────────────────────────────────
DO $$
DECLARE v_rows int; v_admin int; v_company int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE role='admin'), count(*) FILTER (WHERE role='company')
    INTO v_rows, v_admin, v_company FROM public.ow_user_roles;

  IF v_rows <> 36 OR v_admin <> 2 OR v_company <> 0 THEN
    RAISE EXCEPTION
      '監査時と行数が違う（%行 / admin % / company %）。再監査してから適用すること',
      v_rows, v_admin, v_company;
  END IF;
  RAISE NOTICE '適用前: %行 / admin %行 / company %行', v_rows, v_admin, v_company;
END $$;

-- ── ② INSERT は 'candidate' のみに限る ──────────────────────────────────
DROP POLICY ow_user_roles_own_insert ON public.ow_user_roles;

CREATE POLICY ow_user_roles_own_insert ON public.ow_user_roles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    /* ⚠️ **`role` を式に入れることが今回の本題。**
          アプリの許可リスト（`/api/roles` の SELF_ASSIGNABLE_ROLES）と同じ語彙。
          値を増やすときは両方直すこと。 */
    AND role = 'candidate'
  );

-- ── ③ UPDATE のポリシーごと落とす ──────────────────────────────────────
-- ⚠️ **アプリに UPDATE の経路が無い。** `addUserRole` は INSERT のみで、
--    `join-request` の upsert は admin クライアント（service_role）。
--    ポリシーが無ければ RLS は拒否するので、制限を書くより落とすほうが確実。
DROP POLICY ow_user_roles_own_update ON public.ow_user_roles;

-- 表レベルの UPDATE 権限も剥がす（RLS と GRANT の二重で閉じる）
REVOKE UPDATE ON TABLE public.ow_user_roles FROM authenticated;

-- ── ④ DELETE から admin 行を外す ────────────────────────────────────────
-- 他人の行を消せないのは元から（USING が自分の行に限っている）。
-- ⚠️ **自分の admin 行を消す必要も無い。** 消せると、運営が誤って自分の権限を
--    落として `/admin` に入れなくなる（service_role でしか戻せない）。
DROP POLICY ow_user_roles_own_delete ON public.ow_user_roles;

CREATE POLICY ow_user_roles_own_delete ON public.ow_user_roles
  FOR DELETE
  USING (auth.uid() = user_id AND role <> 'admin');

-- ── ⑤ 適用後の検算 ──────────────────────────────────────────────────────
-- ⚠️ catalog を見ているだけ。**実際の応答は適用後に is_test のセッションで
--    PostgREST を叩いて確かめること。**
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_user_roles' AND p.polcmd='w';
  IF v <> 0 THEN RAISE EXCEPTION 'UPDATE のポリシーが%本残っている', v; END IF;

  IF has_table_privilege('authenticated','public.ow_user_roles','UPDATE') THEN
    RAISE EXCEPTION 'authenticated にまだ UPDATE 権限がある';
  END IF;

  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_user_roles' AND p.polname='ow_user_roles_own_insert'
     AND pg_get_expr(p.polwithcheck,p.polrelid) ~ 'candidate';
  IF v <> 1 THEN RAISE EXCEPTION 'INSERT の WITH CHECK に role の制限が入っていない'; END IF;

  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_user_roles' AND p.polname='ow_user_roles_own_delete'
     AND pg_get_expr(p.polqual,p.polrelid) ~ 'admin';
  IF v <> 1 THEN RAISE EXCEPTION 'DELETE の USING に admin の除外が入っていない'; END IF;

  -- ⚠️ ポリシーに auth_is_admin() を書いていないこと（循環の防止）
  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_user_roles'
     AND (coalesce(pg_get_expr(p.polqual,p.polrelid),'')
       || coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')) ~ 'auth_is_admin'
     AND p.polcmd <> 'r';
  IF v <> 0 THEN RAISE EXCEPTION '書き込み系のポリシーに auth_is_admin() が入っている（循環する）'; END IF;

  SELECT count(*) INTO v FROM public.ow_user_roles;
  IF v <> 36 THEN RAISE EXCEPTION 'データが変わっている（%行）', v; END IF;

  RAISE NOTICE 'INSERT は candidate のみ / UPDATE なし / DELETE は admin 除外 / 36行';
END $$;
