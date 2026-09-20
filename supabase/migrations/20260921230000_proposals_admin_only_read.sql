-- ═══════════════════════════════════════════════════════════════════════════
-- ②⑨ 提案の読みを admin クライアントだけにする（2026-09-21）
--
-- ── ★塞ぐ穴 ────────────────────────────────────────────────────────────────
-- **企業の管理者が PostgREST から候補者の身元に到達できた。**
-- `/biz/proposals` は `ow_users` を1列も select しないことで匿名を担保しているが、
-- **DB はそれを要求していなかった。**
--
-- 実測（2026-09-21 / 本番 / `is_test` の行で確認）:
--   企業の管理者 → `ow_proposals.candidate_user_id` が **読めた**
--                → その uuid で `ow_users.name` も **読めた**（氏名まで到達）
--   ＝ mutual の前でも匿名が破れていた。
-- ⚠️★**「画面は正しいのに PostgREST だけ漏れている」という、このリポジトリが
--    繰り返し踏んでいる形**（CLAUDE.md「画面が動いているは検証にならない」）。
--
-- ── ★なぜ「ポリシーを1本落とす」で済ませないか ─────────────────────────────
-- 漏れているのは `ow_proposals_select_company` だが、**それだけ落とすと
-- `ow_proposal_declines_select_company` が道連れになる。**
-- あちらは `EXISTS (SELECT 1 FROM ow_proposals p WHERE ...)` で親を引いており、
-- **ポリシー式の中の副問い合わせにも RLS が掛かる**ため、親が読めなくなると
-- 企業は**自分が書いた見送り理由まで読めなくなる**（静かに0件になる）。
--
-- ⚠️★**列単位 GRANT（`candidate_user_id` を剥がす）も採れない。**
--    `ow_proposal_declines_select_own` が**その列を参照している**ので、
--    剥がすと**候補者が自分の見送り理由を読めなくなる**
--    （CLAUDE.md「ポリシー式は実行ユーザーの権限で評価される」）。
--
-- ── ★採った形: 設計メモどおり「読みは admin だけ」に戻す ───────────────────
-- 設計メモ（docs/phase0-9screens-20260918.md §4-4）は
--   「RLS 有効 / **anon・authenticated に GRANT を配らない** / 読み書きは
--     admin クライアントだけ。**本人に見せる経路を後から足すときに初めて
--     ポリシーを書く**」
-- と書いてあった。**実装はそこから外れて SELECT を配り、ポリシーを3本先に書いた。**
-- 戻す。形は `ow_transitions` と同じ（RLS 有効・ポリシー0本・GRANT 無し）。
--
-- ⚠️ **アプリは1行も壊れない。** 実測（2026-09-21 / `src` 全体）:
--    `ow_proposals` / `ow_proposal_declines` を読む**11箇所すべてが
--    `createAdminClient()`（service_role）**で、セッションのクライアントで
--    読んでいる箇所は**0件**。
--
-- ⚠️★**セッションのクライアントで読む経路を足す日は、ポリシーを書き直すこと。**
--    そのとき `ow_proposal_declines` の2本は**そのままでは使えない**
--    （親の RLS に引っかかる）。**SECURITY DEFINER の関数に逃がす**か、
--    親のポリシーと同時に設計すること。落とした6本は下に記録してある。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① GRANT を剥がす（「誰にも読ませない」は GRANT で書く）────────────────
-- ⚠️ anon には元から配っていない（実測で確認済み）。書いても no-op だが明示する。
-- ⚠️ service_role には触らない。admin クライアントはここを通る。

revoke select on public.ow_proposals        from anon, authenticated;
revoke select on public.ow_proposal_declines from anon, authenticated;

-- ── ② ポリシーを落とす ─────────────────────────────────────────────────────
-- ⚠️★**GRANT が無いのにポリシーだけ残すと、次に読む人を誤らせる**
--    （CLAUDE.md「両方を GRANT でやると、ポリシーが死んだまま残る」の裏返し）。
--
-- 落とした6本（戻すときの原文。★そのまま戻さず上の注記を読むこと）:
--   ow_proposals_select_admin    USING (auth_is_admin())
--   ow_proposals_select_company  USING (auth_is_company_admin(company_id))   ← ★これが漏れていた
--   ow_proposals_select_own      USING (candidate_user_id = auth_ow_user_id())
--   ow_proposal_declines_select_admin   USING (auth_is_admin())
--   ow_proposal_declines_select_company USING (side = 'company'
--     AND EXISTS (SELECT 1 FROM ow_proposals p
--                  WHERE p.id = ow_proposal_declines.proposal_id
--                    AND auth_is_company_admin(p.company_id)))
--   ow_proposal_declines_select_own     USING (side = 'candidate'
--     AND EXISTS (SELECT 1 FROM ow_proposals p
--                  WHERE p.id = ow_proposal_declines.proposal_id
--                    AND p.candidate_user_id = auth_ow_user_id()))

drop policy if exists ow_proposals_select_admin   on public.ow_proposals;
drop policy if exists ow_proposals_select_company on public.ow_proposals;
drop policy if exists ow_proposals_select_own     on public.ow_proposals;

drop policy if exists ow_proposal_declines_select_admin   on public.ow_proposal_declines;
drop policy if exists ow_proposal_declines_select_company on public.ow_proposal_declines;
drop policy if exists ow_proposal_declines_select_own     on public.ow_proposal_declines;

-- ⚠️ RLS は**有効のまま**にする。切ると GRANT を戻した日に丸ごと開く。
alter table public.ow_proposals         enable row level security;
alter table public.ow_proposal_declines enable row level security;

comment on table public.ow_proposals is
  '根拠つき提案（②⑨）。evidence / counter_evidence は作成時点のスナップショットで、表示のたびに再計算しない。⚠ 見送り理由は ow_proposal_declines。⚠★読み書きとも service_role だけ（2026-09-21: 企業の管理者が PostgREST から candidate_user_id を読めていたため GRANT ごと剥がした）。セッションのクライアントで読む経路を足すなら、migration 20260921230000 の注記を読むこと。';
comment on table public.ow_proposal_declines is
  '見送り理由（④）。side で求職者／企業を分ける。⚠★読み書きとも service_role だけ（2026-09-21）。⚠ ポリシーを戻すときは親（ow_proposals）の RLS に引っかかるので SECURITY DEFINER に逃がすこと。';

-- ── ③ 適用後のアサート ─────────────────────────────────────────────────────

DO $$
DECLARE v_n int;
BEGIN
  IF has_table_privilege('authenticated', 'public.ow_proposals', 'SELECT')
     OR has_table_privilege('anon', 'public.ow_proposals', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ow_proposal_declines', 'SELECT')
     OR has_table_privilege('anon', 'public.ow_proposal_declines', 'SELECT') THEN
    RAISE EXCEPTION 'GRANT が残っている';
  END IF;

  /* ★service_role は読めたままであること（admin クライアントが通る道） */
  IF NOT has_table_privilege('service_role', 'public.ow_proposals', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.ow_proposal_declines', 'SELECT') THEN
    RAISE EXCEPTION 'service_role まで剥がしている';
  END IF;

  SELECT count(*) INTO v_n FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname IN ('ow_proposals', 'ow_proposal_declines');
  IF v_n <> 0 THEN RAISE EXCEPTION 'ポリシーが % 本残っている', v_n; END IF;

  /* ★RLS は有効のまま */
  IF NOT (SELECT bool_and(relrowsecurity) FROM pg_class
           WHERE relname IN ('ow_proposals', 'ow_proposal_declines')
             AND relnamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION 'RLS が切れている';
  END IF;
END $$;

COMMIT;
