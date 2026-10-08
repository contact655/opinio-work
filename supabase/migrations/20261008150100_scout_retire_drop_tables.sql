-- ============================================================================
-- ★スカウト廃止 ②：ow_scouts / ow_scout_quotas とトリガー・関数を落とす（2026-10-08 作成 / **未適用**）
-- ============================================================================
-- ⚠️★**supabase/pending/ に置いてある。①を当てた後に当てる。** 採番は移すときに振り直す。
-- ⚠️ 当てる前に `./scripts/dump-tables.sh ow_scouts ow_scout_quotas` で保全を取ること。
--
-- 落とすもの:
--   ・トリガー ow_scouts.trg_guard_scout
--   ・関数 guard_scout_insert()          … 上のトリガー専用
--   ・関数 consume_scout_quota(uuid)     … guard_scout_insert からだけ呼ばれる
--   ・関数 block_solicitation_on_scout() … **トリガーに付いていない孤立した関数**（2026-10-08 実測）
--   ・表 ow_scouts（0行） / ow_scout_quotas（0行）とそのポリシー（表と一緒に消える）
--
-- ⚠️★★**落とさないもの（スカウト廃止後も現役）。巻き込まないこと。**
--   ・can_send_scout(uuid, uuid) … 名前に反して中身は「この企業にこの候補者を見せてよいか」。
--                                   /biz/candidates と提案（lib/evidence/generate.ts）が呼ぶ
--   ・get_blocked_companies(uuid) / ow_scout_blocks … 求職者の「ブロック中の企業」
--   ・is_solicitation_blocked(uuid) … 転職勧奨禁止（can_send_scout が呼ぶ）
--
-- ⚠️ CASCADE を付けない。FK が残っていれば失敗させる（①を当て忘れた合図）。
-- ⚠️ PL/pgSQL の本体は依存として追跡されないので、落とす関数・表を参照する関数が
--    無いことを中で検査する（行コメントを落としてから照合する）。
-- ============================================================================

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_scouts;
  if n <> 0 then raise exception '中止: ow_scouts が % 行ある（0行のはず）', n; end if;
  select count(*) into n from public.ow_scout_quotas;
  if n <> 0 then raise exception '中止: ow_scout_quotas が % 行ある（0行のはず）', n; end if;

  -- 落とす表を指す FK（①で ow_notifications.scout_id は外れているはず）
  select count(*) into n from pg_constraint
   where confrelid in ('public.ow_scouts'::regclass, 'public.ow_scout_quotas'::regclass);
  if n <> 0 then raise exception '中止: ow_scouts / ow_scout_quotas を指す FK が % 本ある（①を先に当てる）', n; end if;

  -- 落とすものを本文で参照している「残す側」の関数が無いこと
  select count(*) into n from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname not in ('guard_scout_insert', 'consume_scout_quota', 'block_solicitation_on_scout')
     and regexp_replace(prosrc, '--[^' || chr(10) || ']*', '', 'g')
         ~ '\m(ow_scouts|ow_scout_quotas|consume_scout_quota|guard_scout_insert|block_solicitation_on_scout)\M';
  if n <> 0 then raise exception '中止: 落とす対象を参照している関数が % 本ある', n; end if;
end $$;

drop trigger trg_guard_scout on public.ow_scouts;
drop function public.guard_scout_insert();
drop function public.consume_scout_quota(uuid);
drop function public.block_solicitation_on_scout();

drop table public.ow_scouts;
drop table public.ow_scout_quotas;

-- 検算: 残す側が生きていること
do $$
begin
  if to_regprocedure('public.can_send_scout(uuid, uuid)') is null then
    raise exception '検算失敗: can_send_scout が消えている（候補者検索と提案が止まる）';
  end if;
  if to_regclass('public.ow_scout_blocks') is null then
    raise exception '検算失敗: ow_scout_blocks が消えている（求職者のブロック設定が止まる）';
  end if;
end $$;

commit;
