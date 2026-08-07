-- ═══════════════════════════════════════════════════════════════════════════
-- 希望職種を中間テーブル化し、希望勤務スタイルを配列にする
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- 希望条件が「幅」を表現できなかった。
--   希望職種       … text 1つ。キャリアチェンジ希望が2つ書けない
--   希望勤務スタイル … text 1つ。「フルリモート希望」と「週2出社まで可」が並べられない
-- 希望職種は ow_roles を参照する中間テーブルにする。理由:
--   ① 求人側が既に ow_job_roles（求人 × ロール）で同じ形。突き合わせられる
--   ② 手書きの対応表（scoreJob の JOB_TYPE_CATEGORY_MAP 27行、
--      JobsClient の JOB_TYPE_TO_ROLE_NAME 18行）を両方消せる
--   ③ 職種の統合・改名に FK で追随できる
-- 勤務スタイルは4値の閉じた列挙で FK 先が無いため text[] で足りる
-- （desired_phase が既に text[] なので形も揃う）。
--
-- ⚠️ 既存列（job_type / desired_work_style）は**削除しない**。
--    読み書きの書き換え（B-2）が終わって実測するまで残す。
--
-- ⚠️ ow_profile_desired_roles.user_id は **auth 空間**。
--    親の ow_profiles.user_id が auth.users を指しているので揃える。
--    docs/user-id-spaces.md に追記済み。
--
-- ⚠️ GRANT を明示的に絞る。この DB は public スキーマの既定 ACL が
--    **anon にも arwdDxtm（全権限）を付ける**設定になっている（pg_default_acl 実測）。
--    CREATE TABLE しただけだと未ログインから読み書きできる状態になる。
--    2026-08-06 に anon の書き込みを94テーブルから剥がしたばかりなので、
--    ここで作り直さない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_rows int; v_jt int; v_ws int; v_unresolved int; v_names text; v_cols int;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='ow_profile_desired_roles') THEN
    RAISE EXCEPTION 'ow_profile_desired_roles が既にある。中止';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='ow_profiles'
                AND column_name='desired_work_styles') THEN
    RAISE EXCEPTION 'desired_work_styles が既にある。中止';
  END IF;

  SELECT count(*), count(job_type), count(desired_work_style) INTO v_rows, v_jt, v_ws
    FROM public.ow_profiles;
  IF v_rows <> 39 THEN RAISE EXCEPTION 'ow_profiles が % 件（想定39）。中止', v_rows; END IF;
  IF v_jt   <> 6  THEN RAISE EXCEPTION 'job_type が % 件（想定6）。中止', v_jt; END IF;
  IF v_ws   <> 2  THEN RAISE EXCEPTION 'desired_work_style が % 件（想定2）。中止', v_ws; END IF;

  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles';
  IF v_cols <> 22 THEN RAISE EXCEPTION 'ow_profiles の列数が %（想定22）。中止', v_cols; END IF;

  -- ⚠️ 1件でも ow_roles に解決できないものがあれば中止する。推測で寄せない。
  SELECT count(*), string_agg(DISTINCT p.job_type, ' / ') INTO v_unresolved, v_names
    FROM public.ow_profiles p
   WHERE p.job_type IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.ow_roles r WHERE r.name = p.job_type)
     AND NOT EXISTS (SELECT 1 FROM public.ow_role_aliases a WHERE a.alias = p.job_type);
  IF v_unresolved > 0 THEN
    RAISE EXCEPTION 'ow_roles に解決できない job_type が % 件（%）。中止', v_unresolved, v_names;
  END IF;

  RAISE NOTICE '適用前: ow_profiles % 件 / job_type % 件 / desired_work_style % 件 / 未解決 0 件',
    v_rows, v_jt, v_ws;
END $$;

-- ── ① 中間テーブル ─────────────────────────────────────────────────────────
CREATE TABLE public.ow_profile_desired_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    uuid NOT NULL REFERENCES public.ow_roles(id),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

COMMENT ON TABLE public.ow_profile_desired_roles IS
  '求職者の希望職種（複数可）。ow_profiles.job_type の後継。'
  ' ⚠️ user_id は auth.users.id（ow_users.id ではない）。親の ow_profiles に揃えている。';
COMMENT ON COLUMN public.ow_profile_desired_roles.is_primary IS
  '第1希望。2026-08-07 時点で UI から設定せず、全行 false。'
  ' 移行した6行も false（単一選択だった当時「第1希望」という概念が無く、'
  ' true を入れると本人が表明していない順位を作ることになるため）。';

CREATE INDEX ow_profile_desired_roles_user_id_idx ON public.ow_profile_desired_roles (user_id);
CREATE INDEX ow_profile_desired_roles_role_id_idx ON public.ow_profile_desired_roles (role_id);

-- ── ② GRANT（既定 ACL を打ち消す）───────────────────────────────────────────
-- ⚠️ CREATE TABLE の時点で anon に arwdDxtm が付いている。まず全部剥がす。
REVOKE ALL ON TABLE public.ow_profile_desired_roles FROM PUBLIC;
REVOKE ALL ON TABLE public.ow_profile_desired_roles FROM anon;
REVOKE ALL ON TABLE public.ow_profile_desired_roles FROM authenticated;

-- 本人が自分の行を CRUD する。行の絞り込みは RLS。
-- 機微列は無いので列単位にはしない。
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ow_profile_desired_roles TO authenticated;
GRANT ALL ON TABLE public.ow_profile_desired_roles TO service_role;

-- ── ③ RLS（ow_profiles と同じ扱い：本人 ＋ admin のみ）──────────────────────
ALTER TABLE public.ow_profile_desired_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ow_profile_desired_roles_own_all" ON public.ow_profile_desired_roles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ow_profile_desired_roles_admin_read" ON public.ow_profile_desired_roles
  FOR SELECT USING (public.auth_is_admin());

-- ── ④ 希望勤務スタイルの配列列 ─────────────────────────────────────────────
ALTER TABLE public.ow_profiles ADD COLUMN desired_work_styles text[];

COMMENT ON COLUMN public.ow_profiles.desired_work_styles IS
  '希望勤務スタイル（複数可）。desired_work_style（単数）の後継。'
  ' ⚠️ 単数の列は B-2 の書き換えが終わるまで残してある。';

-- ── ⑤ 移行 ────────────────────────────────────────────────────────────────
-- job_type → 中間テーブル。名前一致を優先し、無ければ別名で引く。
INSERT INTO public.ow_profile_desired_roles (user_id, role_id)
SELECT p.user_id,
       coalesce(
         (SELECT r.id FROM public.ow_roles r WHERE r.name = p.job_type LIMIT 1),
         (SELECT a.role_id FROM public.ow_role_aliases a WHERE a.alias = p.job_type LIMIT 1)
       )
  FROM public.ow_profiles p
 WHERE p.job_type IS NOT NULL;

-- desired_work_style → 1要素の配列。
-- ⚠️ "flexible" は選択肢から外した値だが、そのまま包む。値を消さない。
UPDATE public.ow_profiles
   SET desired_work_styles = ARRAY[desired_work_style]
 WHERE desired_work_style IS NOT NULL;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_new int; v_users int; v_jt int; v_ws int; v_wss int; v_pol int;
  v_anon int; v_auth text; v_rls bool; v_primary int; v_cols int; v_mismatch int;
BEGIN
  -- 移行件数が元と一致すること（ユーザー単位）
  SELECT count(*), count(DISTINCT user_id) INTO v_new, v_users
    FROM public.ow_profile_desired_roles;
  SELECT count(job_type) INTO v_jt FROM public.ow_profiles;
  IF v_new <> v_jt THEN RAISE EXCEPTION '移行先 % 行 / 移行元 % 件。不一致。ロールバック', v_new, v_jt; END IF;
  IF v_users <> v_jt THEN RAISE EXCEPTION '移行先のユーザー数 % / 移行元 % 件。ロールバック', v_users, v_jt; END IF;

  -- job_type を持つユーザーが全員1行以上持っていること
  SELECT count(*) INTO v_mismatch FROM public.ow_profiles p
   WHERE p.job_type IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.ow_profile_desired_roles d WHERE d.user_id = p.user_id);
  IF v_mismatch <> 0 THEN RAISE EXCEPTION '移行漏れが % 件。ロールバック', v_mismatch; END IF;

  -- role_id がすべて実在すること（FK があるので冗長だが明示する）
  IF EXISTS (SELECT 1 FROM public.ow_profile_desired_roles d
              WHERE NOT EXISTS (SELECT 1 FROM public.ow_roles r WHERE r.id = d.role_id)) THEN
    RAISE EXCEPTION '存在しない role_id がある。ロールバック';
  END IF;

  -- is_primary は全行 false（順位を勝手に作っていないこと）
  SELECT count(*) INTO v_primary FROM public.ow_profile_desired_roles WHERE is_primary;
  IF v_primary <> 0 THEN RAISE EXCEPTION 'is_primary が % 行 true。ロールバック', v_primary; END IF;

  -- 勤務スタイルの配列化
  SELECT count(desired_work_style), count(desired_work_styles) INTO v_ws, v_wss FROM public.ow_profiles;
  IF v_ws <> 2 THEN RAISE EXCEPTION '既存 desired_work_style が % 件（想定2）。ロールバック', v_ws; END IF;
  IF v_wss <> v_ws THEN RAISE EXCEPTION '配列化が % 件（元 % 件）。ロールバック', v_wss, v_ws; END IF;
  IF EXISTS (SELECT 1 FROM public.ow_profiles
              WHERE desired_work_style IS NOT NULL
                AND desired_work_styles <> ARRAY[desired_work_style]) THEN
    RAISE EXCEPTION '配列の中身が元の値と違う。ロールバック';
  END IF;

  -- 既存列が無傷であること
  IF v_jt <> 6 THEN RAISE EXCEPTION 'job_type が % 件（想定6）。ロールバック', v_jt; END IF;
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles';
  IF v_cols <> 23 THEN RAISE EXCEPTION 'ow_profiles の列数が %（想定23）。ロールバック', v_cols; END IF;

  -- ⚠️ GRANT: anon に1つも権限が残っていないこと
  SELECT count(*) INTO v_anon FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_profile_desired_roles' AND grantee='anon';
  IF v_anon <> 0 THEN RAISE EXCEPTION 'anon に権限が % 件残っている。ロールバック', v_anon; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.column_privileges
              WHERE table_schema='public' AND table_name='ow_profile_desired_roles' AND grantee='anon') THEN
    RAISE EXCEPTION 'anon に列単位の権限が残っている。ロールバック';
  END IF;

  -- authenticated はちょうど4種
  SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) INTO v_auth
    FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_profile_desired_roles' AND grantee='authenticated';
  IF v_auth IS DISTINCT FROM 'DELETE,INSERT,SELECT,UPDATE' THEN
    RAISE EXCEPTION 'authenticated の権限が %（想定 DELETE,INSERT,SELECT,UPDATE）。ロールバック', v_auth;
  END IF;

  -- RLS が有効で、ポリシーが2本
  SELECT relrowsecurity INTO v_rls FROM pg_class WHERE oid='public.ow_profile_desired_roles'::regclass;
  IF NOT v_rls THEN RAISE EXCEPTION 'RLS が有効になっていない。ロールバック'; END IF;
  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_profile_desired_roles';
  IF v_pol <> 2 THEN RAISE EXCEPTION 'ポリシーが % 本（想定2）。ロールバック', v_pol; END IF;

  RAISE NOTICE '完了: 希望職種 % 行（% 名）を移行 / 勤務スタイル % 件を配列化 / anon 権限 0 / ポリシー 2 本',
    v_new, v_users, v_wss;
END $$;

COMMIT;
