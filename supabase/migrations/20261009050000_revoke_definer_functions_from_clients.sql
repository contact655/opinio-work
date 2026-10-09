-- ════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER の関数7本を、クライアントのロールから呼べなくする（2026-10-09）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★何が起きていたか（実測 2026-10-09 / 本番）
--   ・`ow_users.auth_id` は authenticated に SELECT が配られていて、login_only の全員分が読める
--   ・その ID を渡すと、下の関数を **anon からも authenticated からも直接呼べた**
--     （定義者の権限で走るので RLS も効かない）
--       can_send_scout          … その人の転職意欲・在籍歴の有無が分かる
--       get_blocked_companies   … ★**在籍先の社名と、本人がブロックした企業**が返る（未ログインでも）
--       is_solicitation_blocked … 就職後の転職勧奨禁止期間か（＝紹介で就職したか）が分かる
--   ・さらに、中に運営かどうかの確認が無い関数が開いていた
--       approve_school_request / reject_school_request … 学校の申請を誰でも承認・却下できる形
--       purge_old_page_views                          … 誰でも削除を走らせられる
--       get_public_career_steps                       … 本人・運営以外には0行を返すが、開けておく理由が無い
--
-- ★呼び出し元（実測 2026-10-09）
--   アプリ: can_send_scout は /biz/candidates・/biz/proposals・lib/evidence/generate.ts、
--           get_blocked_companies は /api/jobseeker/scout-settings。**4か所とも admin クライアント
--           （service_role）。** 残りの5本はアプリから呼んでいない。
--   DB:     RLS ポリシー・トリガー・ビューからの呼び出しは0件。他の関数からは
--           is_solicitation_blocked を can_send_scout が呼ぶだけ（定義者の権限で走るので影響なし）。
--   ⇒ **service_role だけにして壊れるものは無い。**
--
-- ⚠️★auth_is_admin / auth_is_company_admin / auth_is_company_member / auth_ow_user_id /
--    auth_is_active_company_admin は **触らないこと。** RLS ポリシーで計107か所使っており、
--    外すとポリシーの評価ごと 403 になる。どれも「呼んだ本人のこと」しか答えない。
--
-- ⚠️★`PUBLIC` からも外す。anon と authenticated だけ外しても、PUBLIC の EXECUTE が残っていれば
--    どのロールからも呼べる（ACL の `=X/postgres` が PUBLIC）。
-- ⚠️ CREATE OR REPLACE は ACL を保つので、今後この7本の本文を差し替えても権限は戻らない。
--    ただし **DROP して作り直すと既定の権限（anon / authenticated に付く）に戻る。**
-- ════════════════════════════════════════════════════════════════════════

begin;

revoke execute on function public.can_send_scout(uuid, uuid)                       from public, anon, authenticated;
revoke execute on function public.get_blocked_companies(uuid)                      from public, anon, authenticated;
revoke execute on function public.is_solicitation_blocked(uuid)                    from public, anon, authenticated;
revoke execute on function public.get_public_career_steps(uuid)                    from public, anon, authenticated;
revoke execute on function public.approve_school_request(uuid, text, text, uuid)   from public, anon, authenticated;
revoke execute on function public.reject_school_request(uuid, uuid)                from public, anon, authenticated;
revoke execute on function public.purge_old_page_views()                           from public, anon, authenticated;

-- service_role は明示的に残す（既にあるが、ここで意図を固定する）
grant execute on function public.can_send_scout(uuid, uuid)                       to service_role;
grant execute on function public.get_blocked_companies(uuid)                      to service_role;
grant execute on function public.is_solicitation_blocked(uuid)                    to service_role;
grant execute on function public.get_public_career_steps(uuid)                    to service_role;
grant execute on function public.approve_school_request(uuid, text, text, uuid)   to service_role;
grant execute on function public.reject_school_request(uuid, uuid)                to service_role;
grant execute on function public.purge_old_page_views()                           to service_role;

-- ── 検算（想定と違えばロールバック）────────────────────────────────────────
do $$
declare
  f text;
  r text;
  fns text[] := array[
    'public.can_send_scout(uuid, uuid)',
    'public.get_blocked_companies(uuid)',
    'public.is_solicitation_blocked(uuid)',
    'public.get_public_career_steps(uuid)',
    'public.approve_school_request(uuid, text, text, uuid)',
    'public.reject_school_request(uuid, uuid)',
    'public.purge_old_page_views()'
  ];
begin
  foreach f in array fns loop
    foreach r in array array['anon', 'authenticated'] loop
      if has_function_privilege(r, f, 'EXECUTE') then
        raise exception '検算失敗: % が % を実行できる', r, f;
      end if;
    end loop;
    if not has_function_privilege('service_role', f, 'EXECUTE') then
      raise exception '検算失敗（陽性対照）: service_role が % を実行できない', f;
    end if;
  end loop;
  -- 触らない5本は authenticated から呼べたまま（RLS ポリシーが使う）
  if not has_function_privilege('authenticated', 'public.auth_is_admin()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.auth_ow_user_id()', 'EXECUTE') then
    raise exception '検算失敗: RLS が使う関数の権限まで変わった';
  end if;
  raise notice '検算OK: 7本とも anon / authenticated から実行不可・service_role は可';
end $$;

commit;

-- ════════════════════════════════════════════════════════════════════════
-- ★戻すときの grant 文（適用前の ACL。2026-10-09 に本番の pg_proc.proacl から取得）
--   適用前の ACL（そのまま）:
--     can_send_scout          =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres
--     get_blocked_companies   =X/postgres postgres=X/postgres service_role=X/postgres anon=X/postgres authenticated=X/postgres
--     is_solicitation_blocked =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres
--     get_public_career_steps =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres
--     approve_school_request  postgres=X/postgres anon=X/postgres service_role=X/postgres authenticated=X/postgres
--     reject_school_request   postgres=X/postgres anon=X/postgres service_role=X/postgres
--     purge_old_page_views    =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres
--   （`=X/postgres` が PUBLIC の EXECUTE。reject_school_request には authenticated が元から無い）
--   ⚠️ 戻すと上の穴（他人の在籍先・ブロック・転職意欲が引ける）がそのまま戻る。
--
-- grant execute on function public.can_send_scout(uuid, uuid)                     to public, anon, authenticated;
-- grant execute on function public.get_blocked_companies(uuid)                    to public, anon, authenticated;
-- grant execute on function public.is_solicitation_blocked(uuid)                  to public, anon, authenticated;
-- grant execute on function public.get_public_career_steps(uuid)                  to public, anon, authenticated;
-- grant execute on function public.approve_school_request(uuid, text, text, uuid) to anon, authenticated;
-- grant execute on function public.reject_school_request(uuid, uuid)              to anon;
-- grant execute on function public.purge_old_page_views()                         to public, anon, authenticated;
