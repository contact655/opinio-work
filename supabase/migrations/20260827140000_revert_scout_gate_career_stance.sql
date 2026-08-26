-- ============================================================================
-- ★このファイルは `20260827090000_scout_gate_career_stance.sql` を打ち消すもの。
--
--   利用規約 第8条の改定日が決まったら、**あちらを再適用する形で進めること。**
--   （この revert を revert するのではなく、20260827090000 と同じ内容の
--     migration を新しい採番で当て直す。あちらのファイルは履歴として残す。）
--
-- ── なぜ戻すか ──────────────────────────────────────────────────────────────
-- 20260827090000 の冒頭に「利用規約 第8条の改定日が決まるまで適用しないこと」と
-- 書かれていたが、**2026-08-26 に `supabase db push` が保留分をまとめて当てた**。
-- `db push` は保留中の migration を全部適用するので、
-- **ファイル冒頭のコメントはロックとして機能しない。**
-- → 再発防止は CLAUDE.md「保留したい migration を supabase/migrations/ に置かない」
--   と `supabase/pending/README.md` を参照。
--
-- ── 戻す先 ──────────────────────────────────────────────────────────────────
-- `20260820160000_fix_can_send_scout_current_employer.sql` が定義した版。
-- **条件1だけが違う。** 2〜4（現在の在籍・手動ブロック・転職勧奨の禁止期間）は同一。
--
--   戻す先: coalesce((select scout_enabled from ow_profiles where user_id = …), false)
--   打ち消す版: career_stance is not null and career_stance <> 'no_contact'
--
-- ⚠️ `ow_profiles.career_stance` は **DROP しない**。列もデータもそのまま残す
--    （本人が答えた内容であり、再適用のときに要る）。
-- ⚠️ `scout_enabled` も従来どおり残る。
--
-- ── 適用時点の実測（2026-08-26 / 本番）─────────────────────────────────────
--   送信可の実ユーザー: **2人（ペア157）** → 戻すと **1人（ペア79）** に戻る想定
--   ow_scouts: 0件 / POST /api/biz/scouts: 503（SCOUT_SENDING_ENABLED 未設定）
--   ＝ 実際に送信できる経路は開いていない。表示（/biz/candidates）だけが変わる。
-- ============================================================================

-- 前提の確認。⚠️ 打ち消す対象が当たっていない状態で流さない
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
    FROM pg_proc
   WHERE proname = 'can_send_scout' AND pronamespace = 'public'::regnamespace;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'can_send_scout が存在しない。前提が違う。中止';
  END IF;

  -- career_stance 版が当たっていること（＝打ち消す対象がある）
  IF v_def !~ '\mcareer_stance\M' THEN
    RAISE EXCEPTION '現在の can_send_scout は career_stance 版ではない。既に戻したか、前提が違う。中止';
  END IF;

  RAISE NOTICE '適用前: can_send_scout は career_stance 版。scout_enabled 版へ戻す';
END $$;

-- 20260820160000 が定義した版に戻す（条件1のみ差し替え。2〜4 は同一）
CREATE OR REPLACE FUNCTION public.can_send_scout(p_company_id uuid, p_candidate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select
    -- 1. スカウトを受け取る設定になっている（null = 未選択は false 扱い）
    --    ⚠️ ow_profiles.user_id は auth 空間。p_candidate_id と同じ空間。
    coalesce(
      (select scout_enabled from ow_profiles where user_id = p_candidate_id),
      false
    )

    -- 2. ★**現在**その企業に在籍していない（前職は除外しない＝出戻りには送れる）
    --    ⚠️ `ow_experiences.user_id` は **ow_users 空間**。p_candidate_id（auth 空間）
    --       と直接比べてはいけない。**必ず ow_users を join して auth_id で引く。**
    --       2026-08-20 まで直接比べており、この条件は一度も効いていなかった。
    and not exists (
      select 1
      from ow_experiences e
      join ow_users u on u.id = e.user_id
      where u.auth_id = p_candidate_id
        and e.is_current
        and e.company_id = p_company_id
    )

    --    company_id が NULL で、会社名の自由入力のみの場合
    --    正規化した名前で突き合わせる（こちらも現職だけ）
    and not exists (
      select 1
      from ow_experiences e
      join ow_users u on u.id = e.user_id
      join ow_companies c on c.id = p_company_id
      where u.auth_id = p_candidate_id
        and e.is_current
        and e.company_id is null
        and e.company_text is not null
        and normalize_company_name(e.company_text) = normalize_company_name(c.name)
    )

    -- 3. 手動ブロックされていない（ow_scout_blocks.candidate_id は auth 空間）
    and not exists (
      select 1 from ow_scout_blocks
      where candidate_id = p_candidate_id
        and company_id = p_company_id
    )

    -- 4. 転職勧奨の禁止期間中でない（ow_placements.candidate_id は auth 空間）
    and not is_solicitation_blocked(p_candidate_id);
$function$;

-- 適用後の確認。⚠️ 「エラーが出なかった」を成功にしない
DO $$
DECLARE v_def text; v_users int;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
    FROM pg_proc
   WHERE proname = 'can_send_scout' AND pronamespace = 'public'::regnamespace;

  IF v_def ~ '\mcareer_stance\M' THEN
    RAISE EXCEPTION '戻っていない（まだ career_stance を見ている）。中止';
  END IF;
  IF v_def !~ '\mscout_enabled\M' THEN
    RAISE EXCEPTION 'scout_enabled 版になっていない。中止';
  END IF;
  -- 空間の取り違えを戻り道で作らない（ow_users を join していること）
  IF v_def !~ '\mow_users\M' THEN
    RAISE EXCEPTION 'ow_users の join が消えている。20260820160000 の修正まで巻き戻っている。中止';
  END IF;

  SELECT count(DISTINCT u.id) INTO v_users
    FROM ow_users u
    JOIN ow_companies c
      ON c.listing_status = 'listed' AND c.is_published AND coalesce(c.is_test, false) = false
   WHERE coalesce(u.is_test, false) = false
     AND coalesce(u.is_system, false) = false
     AND u.auth_id IS NOT NULL
     AND public.can_send_scout(c.id, u.auth_id);

  RAISE NOTICE '適用後: 送信可の実ユーザー % 人（1 が想定）', v_users;
END $$;
