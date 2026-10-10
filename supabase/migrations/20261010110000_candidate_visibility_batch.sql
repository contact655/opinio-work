-- ════════════════════════════════════════════════════════════════════════
-- 候補者検索の判定をまとめて呼ぶ（2026-10-10 / 候補者探し 段1）
-- ════════════════════════════════════════════════════════════════════════
--
-- それまで /biz/candidates は can_send_scout() と can_send_company_approach() を
-- **候補者1人ずつ** RPC で呼んでいた（最大500人 × 2本）。
--
-- ★ここで足すのは「まとめて呼ぶ入口」だけ。**判定の中身は書かない。**
--   各行で元の関数をそのまま呼ぶので、結果は作りのうえで一致する
--   （判定を2か所に書かない。条件を変えるときは元の関数だけを変える）。
--
-- ★security invoker（呼んだロールの権限で動く）。中で呼ぶ元の関数が service_role だけに
--   開いているので、この包みも service_role からしか意味を持たない。念のため EXECUTE も
--   service_role だけにする。⚠️ SECURITY DEFINER にしないこと（check-definer-grants の対象を増やさない）。
--
-- ★足すだけ（古いコードはこの関数を知らないだけで壊れない）。
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 見せてよいか（can_send_scout）。⚠️ p_candidate_ids は auth 空間（元の関数と同じ）──────
create or replace function public.can_send_scout_many(p_company_id uuid, p_candidate_ids uuid[])
returns table(candidate_id uuid, ok boolean)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select c, coalesce(public.can_send_scout(p_company_id, c), false)
    from unnest(coalesce(p_candidate_ids, '{}'::uuid[])) as c;
$function$;

-- ── 声かけを送れるか（can_send_company_approach）。⚠️ p_candidate_ow_user_ids は ow_users 空間 ──
create or replace function public.can_send_company_approach_many(
  p_company_id uuid, p_candidate_ow_user_ids uuid[], p_sender_ow_user_id uuid default null)
returns table(candidate_ow_user_id uuid, ok boolean)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select c, coalesce(public.can_send_company_approach(p_company_id, c, p_sender_ow_user_id), false)
    from unnest(coalesce(p_candidate_ow_user_ids, '{}'::uuid[])) as c;
$function$;

revoke execute on function public.can_send_scout_many(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.can_send_company_approach_many(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.can_send_scout_many(uuid, uuid[]) to service_role;
grant execute on function public.can_send_company_approach_many(uuid, uuid[], uuid) to service_role;

comment on function public.can_send_scout_many(uuid, uuid[]) is
  '候補者検索の「見せてよいか」をまとめて判定する入口（2026-10-10）。中身は各行で can_send_scout() を呼ぶだけ。判定はここに書かない。service_role だけが呼べる';
comment on function public.can_send_company_approach_many(uuid, uuid[], uuid) is
  '「声かけを送れるか」をまとめて判定する入口（2026-10-10）。中身は各行で can_send_company_approach() を呼ぶだけ。判定はここに書かない。service_role だけが呼べる';

do $$
begin
  if has_function_privilege('authenticated', 'public.can_send_scout_many(uuid, uuid[])', 'EXECUTE')
     or has_function_privilege('anon', 'public.can_send_scout_many(uuid, uuid[])', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.can_send_company_approach_many(uuid, uuid[], uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.can_send_company_approach_many(uuid, uuid[], uuid)', 'EXECUTE') then
    raise exception '検算失敗: クライアントのロールから呼べる';
  end if;
  raise notice '検算OK: まとめて判定する入口を2本足した';
end $$;

commit;

-- ★戻すとき:
--   drop function public.can_send_scout_many(uuid, uuid[]);
--   drop function public.can_send_company_approach_many(uuid, uuid[], uuid);
