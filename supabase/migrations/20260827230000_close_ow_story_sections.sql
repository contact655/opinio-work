-- ═══════════════════════════════════════════════════════════════════════════
-- ow_story_sections を anon から閉じる（2026-08-27）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- 経歴ストーリーの**本文**（`ow_experience_stories`）は 2026-08-15 に
-- `select_own` + `select_admin` へ絞り、anon の GRANT も落とした。
-- ところが**見出しの表（この表）だけが取り残されていた**:
--     ow_story_sections_select_all … TO PUBLIC / USING (true)
--     anon に表・列とも SELECT の GRANT あり
-- `name` は**本人が書いた文字列**（セクション見出し）なので、本文と同じ扱いにする。
--
-- ★**実データ 0 行のうちにやる**（実測 2026-08-27）。行が入ってからだと
--   「壊れる経路が無いこと」の確認が増える。
--   作業前ダンプ: .dumps/20260827-1719-ow_story_sections-ow_company_hidden_experiences.sql
--
-- ── ★「anon で0件」は遮断の証明にならない ──────────────────────────────────
-- **RLS で弾かれても 403 ではなく 200＋0件が返る。**
-- 実測（2026-08-27）: `ow_schools` は 37 行あるのに anon には 0 件。
-- したがって**空の表では実測で遮断を示せない。** 判定は
-- **ポリシーを `polroles` まで含めて読む**こと。
-- ⚠️ 2026-08-27 に実際に誤った。`service_role` にだけ配った `USING(true)` を
--    「anon が読める」と数え、`ow_company_hidden_experiences` を誤検出した。
--
-- ── 壊れる経路が無いことの確認（適用前・2026-08-27）────────────────────────
--   読み取りは `/api/jobseeker/experience-story-sections` の GET 1本だけ。
--   `createClient`（セッション）で、**冒頭で未ログインを 401 にしている**。
--   呼ぶのは `StoryAccordion.tsx`、描くのは `mypage/details/[section]/CareerDetails.tsx`
--   の**1箇所だけ**（＝本人の画面）。`/u/[id]` からは呼ばれていない。
--   集計列（count 埋め込み）からの参照は **0件**。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① ow_story_sections ────────────────────────────────────────────────────
-- ⚠️ **authenticated の GRANT は剥がさない。** 運営も authenticated ロールで来るので、
--    剥がすと RLS まで到達せず運営でも読めなくなる（`ow_settings` で踏んだ事故）。
--    「誰にも読ませない」は GRANT で、「誰に読ませるか」は RLS で書く。
revoke select on public.ow_story_sections from anon;

drop policy if exists "ow_story_sections_select_all" on public.ow_story_sections;

/* ★所有者判定は `experience_id → ow_experiences → ow_users.auth_id` の親経由。
   ⚠️ **同じ表の UPDATE / DELETE のポリシーと同一の式**にしてある。
      揃えないと「消せるのに読めない」のような食い違いが生まれる。 */
create policy "ow_story_sections_select_own"
  on public.ow_story_sections for select
  using (
    experience_id in (
      select e.id from public.ow_experiences e
        join public.ow_users u on u.id = e.user_id
       where u.auth_id = auth.uid()
    )
  );

create policy "ow_story_sections_select_admin"
  on public.ow_story_sections for select
  using (auth_is_admin());

-- ── ② ow_company_hidden_experiences ────────────────────────────────────────
-- ★**GRANT だけ剥がす。ポリシーは1本も触らない。**
--   anon に効く SELECT ポリシーが元から無いので**いま漏れてはいない**。
--   これは整理であって、穴を塞ぐ変更ではない。
-- ⚠️ 読み取りは3経路とも `createAdminClient`（service_role）なので影響しない
--    （`getCompanyEmployees` / `biz/employees` / `/api/biz/hidden-experiences`）。
revoke select on public.ow_company_hidden_experiences from anon;

-- ── ③ 検証。★「エラーが出なかった」を成功にしない ──────────────────────────
DO $$
DECLARE
  v_anon_ss   boolean;
  v_auth_ss   boolean;
  v_anon_hid  boolean;
  v_auth_hid  boolean;
  v_pub       int;
  v_sel       int;
  v_rows      int;
  v_upd       text;
  v_selown    text;
BEGIN
  -- 前提: 0 行のうちにやる
  SELECT count(*) INTO v_rows FROM public.ow_story_sections;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ow_story_sections が % 行ある（0 のはず）。中止', v_rows; END IF;

  -- anon から剥がれ、authenticated には残っていること
  v_anon_ss  := has_table_privilege('anon',          'public.ow_story_sections', 'SELECT');
  v_auth_ss  := has_table_privilege('authenticated', 'public.ow_story_sections', 'SELECT');
  v_anon_hid := has_table_privilege('anon',          'public.ow_company_hidden_experiences', 'SELECT');
  v_auth_hid := has_table_privilege('authenticated', 'public.ow_company_hidden_experiences', 'SELECT');
  IF v_anon_ss  THEN RAISE EXCEPTION 'anon が ow_story_sections を読める。中止'; END IF;
  IF v_anon_hid THEN RAISE EXCEPTION 'anon が ow_company_hidden_experiences を読める。中止'; END IF;
  IF NOT v_auth_ss  THEN RAISE EXCEPTION 'authenticated から ow_story_sections の SELECT が剥がれた。運営も読めなくなる。中止'; END IF;
  IF NOT v_auth_hid THEN RAISE EXCEPTION 'authenticated から ow_company_hidden_experiences の SELECT が剥がれた。中止'; END IF;

  -- ★USING(true) を PUBLIC/anon に配る SELECT ポリシーが消えていること
  SELECT count(*) INTO v_pub FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_story_sections' AND p.polcmd IN ('r','*')
     AND coalesce(pg_get_expr(p.polqual, p.polrelid),'') = 'true'
     AND (p.polroles = '{0}'::oid[] OR 'anon'::regrole = ANY(p.polroles));
  IF v_pub <> 0 THEN RAISE EXCEPTION 'USING(true) の SELECT ポリシーが % 本残っている。中止', v_pub; END IF;

  -- SELECT ポリシーが own / admin の2本になっていること
  SELECT count(*) INTO v_sel FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_story_sections' AND p.polcmd = 'r';
  IF v_sel <> 2 THEN RAISE EXCEPTION 'SELECT ポリシーが % 本（2 のはず）。中止', v_sel; END IF;

  -- ★own の式が UPDATE のものと一致していること（揃えるのが目的なので機械的に確かめる）
  SELECT pg_get_expr(p.polqual, p.polrelid) INTO v_upd FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_story_sections' AND p.polname = 'ow_story_sections_update_own';
  SELECT pg_get_expr(p.polqual, p.polrelid) INTO v_selown FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_story_sections' AND p.polname = 'ow_story_sections_select_own';
  IF v_upd IS DISTINCT FROM v_selown THEN
    RAISE EXCEPTION 'select_own と update_own の式が違う。%  <>  %', v_selown, v_upd;
  END IF;

  -- ★ポリシーは触っていないこと（hidden 側）
  SELECT count(*) INTO v_pub FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_company_hidden_experiences';
  IF v_pub <> 2 THEN RAISE EXCEPTION 'ow_company_hidden_experiences のポリシーが % 本（2 のはず・触っていないはず）。中止', v_pub; END IF;

  RAISE NOTICE '完了: story_sections SELECT ポリシー % 本 / anon 剥奪 ss=% hid=% / authenticated 維持 ss=% hid=%',
    v_sel, NOT v_anon_ss, NOT v_anon_hid, v_auth_ss, v_auth_hid;
END $$;

COMMIT;
