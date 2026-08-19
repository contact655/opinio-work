-- ═══════════════════════════════════════════════════════════════════════════
-- get_blocked_companies(): 空間の取り違えを直し、引数名を規約に合わせる（2026-08-20）
--
-- ── 2つ壊れていた ────────────────────────────────────────────────────────
--   ① **空間の混在**（`can_send_scout` と同じ形）
--        ow_experiences.user_id      … ow_users 空間
--        ow_scout_blocks.candidate_id … auth 空間
--      を**同じ引数**で比べていた。呼び出し側は auth の `user.id` を渡すので、
--      **在籍企業のぶんは一度も返っていなかった。**
--
--   ② **引数名の不一致**
--      アプリは `{ candidate_id: ... }` で呼んでいたが、関数の引数は `p_candidate_id`。
--      PostgREST は関数を見つけられず **404 `PGRST202`** を返していた。
--      ルートは `?? []` で受けているので「ブロック企業0件」として素通りしていた。
--
--   ⚠️ **片方だけ直すと、もう片方が表に出るだけ。同じ migration で両方直す。**
--
-- ── 引数名は規約に合わせる（CLAUDE.md「DB 関数の書き方」①）──────────────
--   `p_candidate_id` → **`p_auth_user_id`**。
--   uuid は型で空間を区別できないので、**名前で示す**。
--   ⚠️ **呼び出し側も同じ名前に変える**（RPC は引数名が違うだけで404になる）。
--
-- ── ★「在籍企業」は現職だけにする ────────────────────────────────────────
--   2026-08-20 に `can_send_scout` を「**現在**その企業に在籍していない」に変えた。
--   この関数は**その結果を利用者に見せる一覧**なので、**同じ基準でなければ嘘になる**。
--     現職   … ブロックされる（一覧に出す）
--     前職   … ブロックされない（出さない。出戻りのスカウトは届く）
--   ⚠️ 片方だけ直すと「ブロック中と表示されているのにスカウトが届く」になる。
--
--   `block_reason` の値は `'experience'` のまま変えない（受け手の型を壊さないため）。
--   画面の文言「在籍企業（自動）」は現職だけを指すので、意味は合っている。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_def text; v_args text;
BEGIN
  SELECT pg_get_functiondef(oid), pg_get_function_identity_arguments(oid)
    INTO v_def, v_args
    FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_blocked_companies';
  IF v_def IS NULL THEN RAISE EXCEPTION 'get_blocked_companies が無い。中止'; END IF;
  IF v_args <> 'p_candidate_id uuid' THEN
    RAISE EXCEPTION '引数が想定と違う（%）。適用済みか、前提が違う。中止', v_args;
  END IF;
  IF v_def ~ '\mow_users\M' THEN
    RAISE EXCEPTION '既に ow_users を join している。中止';
  END IF;
  RAISE NOTICE '適用前: 引数 p_candidate_id / ow_users の join なし';
END $$;

-- 引数名が変わるので、古いシグネチャは落としてから作り直す
DROP FUNCTION IF EXISTS public.get_blocked_companies(uuid);

CREATE FUNCTION public.get_blocked_companies(p_auth_user_id uuid)
RETURNS TABLE(company_id uuid, company_name text, block_reason text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- 現在在籍している企業（company_id で紐づいている）
  -- ⚠️ ow_experiences.user_id は **ow_users 空間**。auth 空間の引数と直接比べない。
  select distinct
    c.id,
    c.name,
    'experience'::text
  from ow_experiences e
  join ow_users u on u.id = e.user_id
  join ow_companies c on c.id = e.company_id
  where u.auth_id = p_auth_user_id
    and e.is_current

  union

  -- 現在在籍している企業（会社名の自由入力から突合）
  select distinct
    c.id,
    c.name,
    'experience'::text
  from ow_experiences e
  join ow_users u on u.id = e.user_id
  join ow_companies c
    on normalize_company_name(e.company_text) = normalize_company_name(c.name)
  where u.auth_id = p_auth_user_id
    and e.is_current
    and e.company_id is null
    and e.company_text is not null

  union

  -- 手動ブロック（ow_scout_blocks.candidate_id は auth 空間なのでそのまま比べる）
  select
    c.id,
    c.name,
    'manual'::text
  from ow_scout_blocks b
  join ow_companies c on c.id = b.company_id
  where b.candidate_id = p_auth_user_id;
$function$;

-- 旧関数と同じ実行権限に戻す（DROP で消えるため）
GRANT EXECUTE ON FUNCTION public.get_blocked_companies(uuid) TO anon, authenticated, service_role;

DO $$
DECLARE v_def text; v_args text;
BEGIN
  SELECT pg_get_functiondef(oid), pg_get_function_identity_arguments(oid)
    INTO v_def, v_args
    FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_blocked_companies';
  IF v_args <> 'p_auth_user_id uuid' THEN
    RAISE EXCEPTION '引数名が変わっていない（%）。中止', v_args;
  END IF;
  IF v_def !~ 'join ow_users u on u.id = e.user_id' THEN
    RAISE EXCEPTION 'ow_users の join が入っていない。中止';
  END IF;
  IF v_def !~ 'u.auth_id = p_auth_user_id' THEN
    RAISE EXCEPTION 'auth_id で引いていない。中止';
  END IF;
  IF v_def !~ 'e.is_current' THEN
    RAISE EXCEPTION 'is_current の条件が入っていない（can_send_scout と基準がずれる）。中止';
  END IF;
  RAISE NOTICE '適用後: p_auth_user_id / ow_users を join / 現職のみ';
END $$;

COMMIT;
