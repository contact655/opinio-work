-- ═══════════════════════════════════════════════════════════════════════════
-- can_send_scout(): 在籍者の除外が効いていなかったのを直す（2026-08-20）
--
-- ── 何が壊れていたか ─────────────────────────────────────────────────────
--   `p_candidate_id` は **auth 空間**（`auth.users.id`）で渡ってくる。
--   `ow_profiles.user_id` / `ow_scout_blocks.candidate_id` / `ow_placements.candidate_id`
--   はすべて auth 空間の FK なので、①同意 ③手動ブロック ④勧奨禁止は効いていた。
--
--   ⚠️ **②の在籍歴だけが `ow_experiences.user_id`（ow_users 空間）と
--      突き合わせており、構造的に絶対に一致しなかった。**
--
--   本番実測（2026-08-20 / 株式会社セールスフォース・ジャパン）:
--     候補者プール 11人（scout_enabled = true の実ユーザー）
--       うち Salesforce の現職   1人
--       うち Salesforce の元社員 1人
--     `can_send_scout(SF, auth_id)` が true になる人数 … **11人**（2人とも素通り）
--     同じ人を `ow_users.id` で呼ぶと … 0人（＝②はそちらの空間でだけ効いていた）
--
--   `/biz/candidates` はこの関数でフィルタしているので、
--   **採用担当の検索結果に自社の現職社員が出て、スカウトも送れる状態だった。**
--
-- ── ★条件の意味も変える（コメントと実装の両方）─────────────────────────
--   直す前のコメントは「その企業に**在籍したことがない**」。
--   **採るのは「現在その企業に在籍していない」。**
--
--     現職 → 除外する
--     前職 → **除外しない**（出戻りのスカウトには実際に価値がある。
--             実データにも「セールスフォース → 他社 → セールスフォース」の
--             出戻りが存在する）
--
-- ── 「現在在籍」の判定に何を使うか（実データで確認して決めた）───────────
--   `ow_experiences` 21行の内訳（2026-08-20 実測）:
--     is_current = true  かつ ended_at is null … 11
--     is_current = true  かつ ended_at あり     …  0
--     is_current = false かつ ended_at is null  …  0
--     is_current = false かつ ended_at あり     … 10
--   **2つの表現は現時点で完全に一致している。矛盾する行は0。**
--
--   採用するのは **`is_current`**。理由:
--     ・NOT NULL で、入力UIのチェックボックスが直接書く**本人の明示**
--     ・`ended_at` は空のまま保存できる（現職ではないが終了日が無い行を作れる）。
--       その行を「在籍中」と読むと、**辞めた人を除外してしまう**
--   ⚠️ 逆向き（is_current=true なのに ended_at がある行）は**除外側に倒れる**。
--      送らない方向の誤りなので、コンプライアンス上こちらが安全。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_def text; v_bad int;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE pronamespace='public'::regnamespace AND proname='can_send_scout';
  IF v_def IS NULL THEN RAISE EXCEPTION 'can_send_scout が無い。中止'; END IF;
  -- 直す前は ow_users を join していない（＝空間が混ざったまま）はず
  IF v_def ~ '\mow_users\M' THEN
    RAISE EXCEPTION '既に ow_users を join している。適用済みか、前提が違う。中止';
  END IF;

  -- 実データの前提（is_current と ended_at が矛盾する行が無いこと）
  SELECT count(*) INTO v_bad FROM public.ow_experiences
   WHERE (is_current AND ended_at IS NOT NULL) OR (NOT is_current AND ended_at IS NULL);
  RAISE NOTICE '適用前: is_current と ended_at が食い違う行 % 件（0 が想定）', v_bad;
END $$;

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

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE pronamespace='public'::regnamespace AND proname='can_send_scout';
  IF v_def !~ 'join ow_users u on u.id = e.user_id' THEN
    RAISE EXCEPTION 'ow_users の join が入っていない。中止';
  END IF;
  IF v_def !~ 'u.auth_id = p_candidate_id' THEN
    RAISE EXCEPTION 'auth_id で引いていない。中止';
  END IF;
  IF v_def !~ 'e.is_current' THEN
    RAISE EXCEPTION 'is_current の条件が入っていない。中止';
  END IF;
  RAISE NOTICE '適用後: ow_users を join し、auth_id と is_current で判定する';
END $$;

COMMIT;
