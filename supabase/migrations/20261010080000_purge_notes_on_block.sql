-- ════════════════════════════════════════════════════════════════════════
-- 求職者が企業をブロックしたら、その企業の社内メモ・担当・状態を消す（2026-10-10 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★ブロックした時点で消す（ow_scout_blocks に行が入ったとき）。ブロックを解除しても戻らない（消したものは消えたまま）。
--   ⚠️ ow_scout_blocks.candidate_id は auth 空間（auth.users.id）。メモ・状態の candidate_user_id は ow_users 空間。
--   ⚠️ 「受け取らない企業」（ow_approach_blocked_companies。声かけだけ止める）はブロックではないので対象外。
--   ⚠️ 消すのは社内メモ（ow_candidate_notes）と社内の状態・担当（ow_candidate_tracking）。
-- ★トリガー関数は SECURITY DEFINER（ブロックをどのロールが書いても、クライアントに権限の無い表を消せるように）。
--   直接呼べないよう、クライアントのロールから EXECUTE を外す。
-- ════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.purge_candidate_notes_on_block()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.ow_candidate_notes n
   using public.ow_users u
   where u.auth_id = new.candidate_id and n.candidate_user_id = u.id and n.company_id = new.company_id;
  delete from public.ow_candidate_tracking t
   using public.ow_users u
   where u.auth_id = new.candidate_id and t.candidate_user_id = u.id and t.company_id = new.company_id;
  return new;
end;
$function$;

revoke execute on function public.purge_candidate_notes_on_block() from public, anon, authenticated;
grant execute on function public.purge_candidate_notes_on_block() to service_role;

drop trigger if exists trg_purge_candidate_notes_on_block on public.ow_scout_blocks;
create trigger trg_purge_candidate_notes_on_block
  after insert on public.ow_scout_blocks
  for each row execute function public.purge_candidate_notes_on_block();

do $$
begin
  if has_function_privilege('authenticated', 'public.purge_candidate_notes_on_block()', 'EXECUTE') then
    raise exception '検算失敗: クライアントから呼べる';
  end if;
  raise notice '検算OK: ブロックで社内メモ・状態を消すトリガーを張った';
end $$;

commit;

-- ★戻すとき: drop trigger trg_purge_candidate_notes_on_block on public.ow_scout_blocks; drop function public.purge_candidate_notes_on_block();
