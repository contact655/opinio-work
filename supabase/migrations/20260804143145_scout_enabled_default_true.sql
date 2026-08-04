-- ═══════════════════════════════════════════════════════════════════════════
-- スカウトの初期設定を「受け取る」にする
--
--   ① ow_profiles.user_id に UNIQUE を張る（トリガーの ON CONFLICT に必要）
--   ② ow_profiles.scout_enabled に DEFAULT true
--   ③ handle_new_ow_user が ow_profiles の行も作るようにする
--   ④ 列の COMMENT を新しい方針に合わせる
--
-- ── なぜ列の DEFAULT だけでは足りないか ─────────────────────────────────────
-- ow_profiles の行を作る経路は2つしかない。
--   onboarding/OnboardingClient.tsx … 既存行を確認してから INSERT（列を省略）
--   api/jobseeker/scout-settings    … 既存行を確認してから INSERT（値を明示）
-- どちらも「登録した後で何かをした人」にしか走らない。
-- 登録しただけで離脱した人は行が無く、can_send_scout の
-- coalesce(scout_enabled, false) で受け取らない扱いのままになる。
-- そのため登録時点で行を作る（③）。
--
-- ⚠️ handle_new_ow_user は 2026-08-03 に visibility のハードコードを外したばかりの
--    トリガー。責務を広げるので、以下を守ること。
--      ・ow_users の INSERT は一切変えない（列リストも ON CONFLICT も従来どおり）
--      ・ow_profiles の INSERT でサインアップを落とさない
--        （ON CONFLICT DO NOTHING。①の UNIQUE があって初めて成立する）
--      ・scout_enabled は**書かない**。列の既定値に任せる。
--        ここに true を書くと、既定値を変えたときに二重管理になる。
--        2026-08-03 に visibility で起きたのと同じ失敗。
--
-- ⚠️ トリガーが落ちると auth.users の INSERT ごと失敗し、**サインアップ全体が止まる**。
--    そのため「INSERT が失敗しうる条件」を事前に潰す（下の前提③④⑤）。
--
-- ── 既存行は遡って変えない ──────────────────────────────────────────────────
-- 2026-08-04 実測: 全39行のうち true 3 / false 0 / null 36。
-- null は仕様上「未選択」であって「デフォルトのまま」ではない
-- （旧 COMMENT と can_send_scout の coalesce(..., false) が根拠）。
-- 遡って true にすると「本人が一度も選んでいない状態」を
-- 「受け取る」と解釈して企業に開示することになる。
-- 2026-08-03 に visibility で 14名を login_only へ戻したのと同じ性質なので行わない。
-- 既存の未選択者には /mypage の「スカウト設定が未完了です」バナーで選ばせる
-- （バナーの条件は onboarding_completed = true AND scout_enabled IS NULL。
--  新規は行こそ出来るが onboarding_completed が false なのでバナーは出ない）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 適用前の分布を控える（事後チェックで「既存行が動いていない」ことを確かめるため）。
-- DO ブロックの変数はブロックをまたげないので一時表に置く。
-- 件数をベタ書きしないので、適用までの間に誰かが設定を変えても誤爆しない。
CREATE TEMP TABLE _scout_before ON COMMIT DROP AS
SELECT
  count(*)                                        AS rows_all,
  count(*) FILTER (WHERE scout_enabled IS TRUE)   AS n_true,
  count(*) FILTER (WHERE scout_enabled IS FALSE)  AS n_false,
  count(*) FILTER (WHERE scout_enabled IS NULL)   AS n_null
FROM public.ow_profiles;

DO $$
DECLARE
  v_rows      int;
  v_distinct  int;
  v_null_uid  int;
  v_default   text;
  v_bad       text;
  b           record;
BEGIN
  -- ── 前提① UNIQUE を張れる状態か ────────────────────────────────────────
  SELECT count(*), count(DISTINCT user_id), count(*) FILTER (WHERE user_id IS NULL)
    INTO v_rows, v_distinct, v_null_uid
    FROM public.ow_profiles;

  IF v_null_uid > 0 THEN
    RAISE EXCEPTION 'ow_profiles.user_id が NULL の行が % 件ある。UNIQUE を張れない。中止', v_null_uid;
  END IF;
  IF v_rows <> v_distinct THEN
    RAISE EXCEPTION 'ow_profiles.user_id が重複している（% 行 / distinct %）。中止', v_rows, v_distinct;
  END IF;

  -- ── 前提② 既定値がまだ付いていないこと（適用済みの検出）──────────────
  SELECT column_default INTO v_default
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles' AND column_name='scout_enabled';
  IF v_default IS NOT NULL THEN
    RAISE EXCEPTION 'scout_enabled に既に既定値がある（%）。適用済みの可能性。中止', v_default;
  END IF;

  -- ── 前提③ user_id の FK が auth.users を指していること ─────────────────
  --    トリガーが渡すのは NEW.id（auth.users.id）。ow_users.id ではない。
  --    ここが張り替わっていたら FK 違反でサインアップごと落ちる。
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid  = 'public.ow_profiles'::regclass
       AND contype   = 'f'
       AND confrelid = 'auth.users'::regclass
       AND conkey    = ARRAY[(SELECT attnum FROM pg_attribute
                               WHERE attrelid='public.ow_profiles'::regclass AND attname='user_id')]
  ) THEN
    RAISE EXCEPTION 'ow_profiles.user_id の FK が auth.users を指していない。トリガーが落ちる。中止';
  END IF;

  -- ── 前提④ user_id だけの INSERT が通ること ──────────────────────────────
  --    NOT NULL かつ既定値なしの列が増えていると
  --    INSERT INTO ow_profiles (user_id) が失敗し、**サインアップ全体が止まる**。
  --    列が追加されたときにここで気づけるようにしておく。
  SELECT string_agg(column_name, ', ') INTO v_bad
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles'
     AND is_nullable='NO' AND column_default IS NULL
     AND column_name <> 'user_id';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'ow_profiles に NOT NULL かつ既定値なしの列がある（%）。user_id だけの INSERT が落ちる。中止', v_bad;
  END IF;

  -- ── 前提⑤ RLS がトリガーを止めないこと ──────────────────────────────────
  --    SECURITY DEFINER は所有者権限で走り、所有者は RLS を迂回する。
  --    ただし FORCE ROW LEVEL SECURITY が付いていると所有者にも適用され、
  --    ポリシー次第で INSERT が弾かれてサインアップが止まる。
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE oid='public.ow_profiles'::regclass AND relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'ow_profiles に FORCE ROW LEVEL SECURITY が付いている。トリガーが弾かれる。中止';
  END IF;

  SELECT * INTO b FROM _scout_before;
  RAISE NOTICE '適用前: 全 % 行（true % / false % / null %）', b.rows_all, b.n_true, b.n_false, b.n_null;
END $$;

-- ── ① UNIQUE ──────────────────────────────────────────────────────────────
--    トリガーの ON CONFLICT (user_id) DO NOTHING を成立させるために要る。
--    同時に、同じ人の profile が2行できる事故も塞ぐ。
ALTER TABLE public.ow_profiles
  ADD CONSTRAINT ow_profiles_user_id_key UNIQUE (user_id);

-- ── ② 既定値 ──────────────────────────────────────────────────────────────
--    ⚠️ 既存行は変わらない。SET DEFAULT は今後の INSERT にだけ効く。
ALTER TABLE public.ow_profiles
  ALTER COLUMN scout_enabled SET DEFAULT true;

-- ── ③ トリガー ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_ow_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- ow_users（従来どおり。ここは変えない）
  INSERT INTO public.ow_users (
    auth_id, email, name, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    NOW(), NOW()
  )
  -- email が既にある = 運営が先に作った行が存在する。ここでは紐付けず callback に任せる。
  ON CONFLICT (email) DO NOTHING;

  -- ow_profiles（2026-08-04 追加）
  -- スカウトの既定を「受け取る」にするため、登録時点で行を作る。
  -- ⚠️ scout_enabled は書かない。列の既定値に任せる。
  --    ここに true を書くと既定値との二重管理になり、片方だけ変えたときにずれる。
  -- ⚠️ user_id は auth.users.id（ow_users.id ではない）。FK もそちらを向いている。
  -- ⚠️ ここが例外を投げると auth.users の INSERT ごと失敗し、サインアップが止まる。
  --    ow_profiles に NOT NULL かつ既定値なしの列を足さないこと。
  INSERT INTO public.ow_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ── ④ COMMENT ─────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.ow_profiles.scout_enabled IS
  'スカウトを受け取るか。2026-08-04 から新規は既定 true（/auth の登録画面と LP の FAQ で告知している）。'
  ' null は 2026-08-04 以前に作られた行の「未選択」で、can_send_scout の coalesce(...,false) により'
  ' 受け取らない扱いのまま。本人が選んでいないため遡って true にはしない。'
  ' 未選択者には /mypage のバナーで選択を促す。';

-- ── ⑤ 事後チェック ────────────────────────────────────────────────────────
DO $$
DECLARE
  b     record;
  a_rows int; a_t int; a_f int; a_n int;
  v_src  text;
  v_code text;
BEGIN
  IF (SELECT column_default FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ow_profiles' AND column_name='scout_enabled') IS NULL THEN
    RAISE EXCEPTION '既定値が設定されていない。ロールバック';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ow_profiles_user_id_key' AND conrelid = 'public.ow_profiles'::regclass
  ) THEN
    RAISE EXCEPTION 'user_id の UNIQUE が作られていない。ロールバック';
  END IF;

  -- 既存行が1件も書き換わっていないこと（適用前に控えた実測値と突き合わせる）
  SELECT * INTO b FROM _scout_before;
  SELECT count(*),
         count(*) FILTER (WHERE scout_enabled IS TRUE),
         count(*) FILTER (WHERE scout_enabled IS FALSE),
         count(*) FILTER (WHERE scout_enabled IS NULL)
    INTO a_rows, a_t, a_f, a_n FROM public.ow_profiles;

  IF (a_rows, a_t, a_f, a_n) IS DISTINCT FROM (b.rows_all, b.n_true, b.n_false, b.n_null) THEN
    RAISE EXCEPTION
      '既存行が変化した（適用前 % 行 %/%/% → 適用後 % 行 %/%/%）。ロールバック',
      b.rows_all, b.n_true, b.n_false, b.n_null, a_rows, a_t, a_f, a_n;
  END IF;

  SELECT prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='handle_new_ow_user';

  -- ⚠️ prosrc にはコメントも含まれる。
  --    「scout_enabled は書かない」という注意書き自体が LIKE に引っかかるため、
  --    列名の有無を見る検査は行コメントを落としたものに対して行う。
  --    （2026-08-04 初回適用時にこれで転けた。素の prosrc で照合しないこと）
  v_code := regexp_replace(v_src, '--[^' || chr(10) || ']*', '', 'g');

  -- トリガーが ow_profiles を作るようになったこと
  IF v_code NOT LIKE '%ow_profiles%' THEN
    RAISE EXCEPTION 'トリガーに ow_profiles の INSERT が入っていない。ロールバック';
  END IF;
  -- ow_users 側を壊していないこと
  IF v_code NOT LIKE '%ow_users%' OR v_code NOT LIKE '%ON CONFLICT (email) DO NOTHING%' THEN
    RAISE EXCEPTION 'トリガーの ow_users 側が変わっている。ロールバック';
  END IF;
  -- 既定値との二重管理になっていないこと
  IF v_code LIKE '%scout_enabled%' THEN
    RAISE EXCEPTION 'トリガーが scout_enabled を明示している。既定値に任せること。ロールバック';
  END IF;
  -- 2026-08-03 に外した visibility のハードコードが復活していないこと
  IF v_code LIKE '%visibility%' THEN
    RAISE EXCEPTION 'トリガーに visibility が復活している。ロールバック';
  END IF;

  -- auth.users にトリガーが張られたままであること
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE t.tgrelid = 'auth.users'::regclass
       AND p.proname = 'handle_new_ow_user'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'auth.users に handle_new_ow_user のトリガーが無い。ロールバック';
  END IF;

  RAISE NOTICE
    '完了: 既定値 true / user_id UNIQUE / トリガーが ow_profiles を作成。既存 % 行は据え置き（true % / false % / null %）',
    a_rows, a_t, a_f, a_n;
END $$;

COMMIT;
