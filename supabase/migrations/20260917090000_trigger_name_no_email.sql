-- 新規ユーザーの名前をメールアドレスから作らない（2026-09-17）
--
-- ── 何が問題だったか ────────────────────────────────────────────────────────
-- `handle_new_ow_user` は、`raw_user_meta_data` に名前が無いとき
-- `split_part(NEW.email, '@', 1)` を `ow_users.name` に入れていた。
-- `ow_users.name` は /people・企業ページ・/u/[id]・フィードにそのまま出るので、
-- **本人が入力していない個人情報（メールアドレスの一部）を公開する**ことになる。
--
-- ⚠️★CLAUDE.md には「2026-09-14 に塞いだ」とあるが、塞がれたのは**アプリ側だけ**
--    （`lib/auth/linkOwUser.ts` と `/auth` の `signUp`）。**このトリガーは残っていた。**
--
-- ⚠️★**実際に踏む経路は「招待」と「マジックリンク」。**
--      `inviteUserByEmail` は `data: { invited_role, invited_by }` しか渡さず、
--      name も full_name も無い。マジックリンクは metadata そのものが空。
--      ＝ これから声かけで使う経路が、まさにここに落ちる。
--
-- 実測（2026-09-17）: `name = split_part(email,'@',1)` の行は **1件のみ**
-- （`is_test` / 2026-06-28）。**実ユーザーは0人。** 既存行は触らない。
--
-- ── なぜ NULL ではなく 'ユーザー' か ────────────────────────────────────────
-- ★`ow_users.name` は **NOT NULL・既定値なし**。NULL を入れると INSERT が落ち、
--   例外がそのまま上がって **`auth.users` の INSERT ごと失敗＝サインアップが止まる**
--   （この関数に EXCEPTION 句は無い）。
--
-- ⚠️★**'ユーザー' は `src/lib/auth/linkOwUser.ts` と揃えている。**
--    あちらは `(name?.trim() || "ユーザー").slice(0, 100)`。
--    **片方を変えるときは、もう片方も変えること。** 値が割れると
--    「どちらの経路で作られたか」で表示が変わる。
-- ⚠️ 「ユーザー」はプレースホルダと読める値。オンボーディング1画面目（姓名は必須）で
--    `ow_users.name` は上書きされる。
--
-- ── 変更は1箇所だけ ────────────────────────────────────────────────────────
--   -      split_part(NEW.email, '@', 1)
--   +      'ユーザー'
-- 他の行は1文字も変えない。ow_profiles の INSERT・ON CONFLICT・SECURITY DEFINER・
-- search_path はそのまま。
--
-- ⚠️★**`CREATE TRIGGER` には触らない。** `on_auth_user_created` はそのまま使う。
-- ⚠️★**`DROP FUNCTION` を使わないこと。** トリガーが依存しているので CASCADE で
--    落とすと**トリガーごと消え、サインアップで ow_users が作られなくなる。**
--    常に `CREATE OR REPLACE`。
--
-- ⚠️ この関数を定義する migration は**これで5本目**（後のものが勝つ）:
--      20260727000000_baseline
--      20260802155842_add_ow_users_auth_linked_at
--      20260803163809_fix_new_user_visibility_default   ← visibility のハードコードを外した
--      20260804143145_scout_enabled_default_true        ← ow_profiles を作るようにした
--      20260917090000（本ファイル）
--
-- 作業前ダンプ: .dumps/ の ow_users（下の適用ログを参照）
-- 調査: docs/phase0-trigger-name-20260917.md
--
-- ── 変更前の定義（戻すときはこれを CREATE OR REPLACE で当てる）───────────────
--   CREATE OR REPLACE FUNCTION public.handle_new_ow_user()
--    RETURNS trigger
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public'
--   AS $function$
--   BEGIN
--     -- ow_users（従来どおり。ここは変えない）
--     INSERT INTO public.ow_users (
--       auth_id, email, name, created_at, updated_at
--     )
--     VALUES (
--       NEW.id, NEW.email,
--       COALESCE(
--         NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
--         NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
--         split_part(NEW.email, '@', 1)
--       ),
--       NOW(), NOW()
--     )
--     -- email が既にある = 運営が先に作った行が存在する。ここでは紐付けず callback に任せる。
--     ON CONFLICT (email) DO NOTHING;
--
--     -- ow_profiles（2026-08-04 追加）… （以下、本体と同じ）
--     INSERT INTO public.ow_profiles (user_id)
--     VALUES (NEW.id)
--     ON CONFLICT (user_id) DO NOTHING;
--
--     RETURN NEW;
--   END;
--   $function$;
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック: いまの定義が 20260804143145 のものであること ──────────────
--    別の変更が入っていたら、それを消してしまうので中止する。
DO $$
DECLARE
  v_src  text;
  v_code text;
BEGIN
  SELECT prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'handle_new_ow_user';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'handle_new_ow_user が存在しない。中止する';
  END IF;

  /* ⚠️ prosrc には**コメントも含まれる**。行コメントを落としてから照合する
        （20260804143145 がこれで一度転けている。素の prosrc で照合しないこと）。 */
  v_code := regexp_replace(v_src, '--[^' || chr(10) || ']*', '', 'g');

  IF v_code NOT LIKE '%split_part(NEW.email%' THEN
    RAISE EXCEPTION '既に split_part が無い。適用済みか、別の変更が入っている。中止する';
  END IF;
  IF v_code NOT LIKE '%ON CONFLICT (email) DO NOTHING%' THEN
    RAISE EXCEPTION 'ow_users 側の ON CONFLICT が想定と違う。中止する';
  END IF;
  IF v_code NOT LIKE '%ow_profiles%' OR v_code NOT LIKE '%ON CONFLICT (user_id) DO NOTHING%' THEN
    RAISE EXCEPTION 'ow_profiles 側が想定と違う。中止する';
  END IF;
  /* 2026-08-03 / 2026-08-04 に外したものが復活していないこと */
  IF v_code LIKE '%visibility%' OR v_code LIKE '%scout_enabled%' THEN
    RAISE EXCEPTION 'トリガーに visibility / scout_enabled が入っている。中止する';
  END IF;

  RAISE NOTICE '事前チェック通過: 20260804143145 の定義であることを確認した';
END $$;

-- ── 本体（変更は split_part → 'ユーザー' の1箇所だけ）───────────────────────
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
      -- 2026-09-17: ここは split_part(NEW.email, '@', 1) だった。
      -- 本人が入力していない個人情報（メールアドレスの一部）が ow_users.name に入り、
      -- /people・企業ページ・/u/[id]・フィードに出ていた。
      -- 踏むのは名前を渡さない経路（招待・マジックリンク）。
      -- NULL にはできない（ow_users.name は NOT NULL。落とすとサインアップが止まる）。
      -- 'ユーザー' は src/lib/auth/linkOwUser.ts と揃えている。
      -- 片方を変えるときは、もう片方も変えること。
      'ユーザー'
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

-- ── 事後チェック（20260804143145 の形を踏襲）────────────────────────────────
DO $$
DECLARE
  v_src  text;
  v_code text;
BEGIN
  SELECT prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'handle_new_ow_user';

  v_code := regexp_replace(v_src, '--[^' || chr(10) || ']*', '', 'g');

  -- ★① split_part が消えていること（コメントを落とした本体で見る）
  IF v_code LIKE '%split_part%' THEN
    RAISE EXCEPTION 'まだ split_part が残っている。ロールバック';
  END IF;
  -- ★② フォールバックが 'ユーザー' になっていること
  IF v_code NOT LIKE '%ユーザー%' THEN
    RAISE EXCEPTION 'フォールバックが ユーザー になっていない。ロールバック';
  END IF;
  -- ★③ ow_profiles の INSERT が残っていること（責務を落としていないこと）
  IF v_code NOT LIKE '%ow_profiles%' OR v_code NOT LIKE '%ON CONFLICT (user_id) DO NOTHING%' THEN
    RAISE EXCEPTION 'ow_profiles の INSERT が失われた。ロールバック';
  END IF;
  -- ow_users 側も壊していないこと
  IF v_code NOT LIKE '%ow_users%' OR v_code NOT LIKE '%ON CONFLICT (email) DO NOTHING%' THEN
    RAISE EXCEPTION 'ow_users 側が変わっている。ロールバック';
  END IF;
  -- 過去に外したものが復活していないこと
  IF v_code LIKE '%visibility%' OR v_code LIKE '%scout_enabled%' THEN
    RAISE EXCEPTION 'visibility / scout_enabled が復活している。ロールバック';
  END IF;

  -- ★④ トリガーが auth.users に張られたまま・有効であること
  --     （tgenabled = 'O' が既定の「有効」。'D' は無効化されている）
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE t.tgrelid   = 'auth.users'::regclass
       AND p.proname   = 'handle_new_ow_user'
       AND t.tgname    = 'on_auth_user_created'
       AND NOT t.tgisinternal
       AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'on_auth_user_created が無いか無効になっている。ロールバック';
  END IF;

  RAISE NOTICE '完了: name のフォールバックを ユーザー にした（split_part は削除）';
END $$;

COMMIT;
