-- ★求人票の貼り付け（段階3）をやめたので、20261011130000 で足した表1つと関数2つを取り除く（2026-10-11 / 柴さんの指示）
--
-- ★保留中（supabase/pending/）。柴さんが行数の報告を見て承認してから migrations/ へ移して当てる。
--
-- 取り除くもの（20261011130000 で足したものだけ。ほかの表・関数には触らない）:
--   表   public.ow_job_prefill_usage
--   関数 public.reserve_job_prefill(uuid, date, integer)
--        public.add_job_prefill_tokens(uuid, date, bigint, bigint)
--
-- 実測（2026-10-11）: 表は 0 行。この表を指す FK・ビュー・トリガー・ポリシー 0、
--   ほかの関数の本文からの参照 0。作業前ダンプ .dumps/20261011-2135-ow_job_prefill_usage.sql（0 行）
-- ⚠️ CASCADE を付けない（想定外の依存があれば失敗させる）。
-- ⚠️ 表に行があれば止める（検証で入れた行も含め、消してよいか確かめていないため）。

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_job_prefill_usage;
  if n <> 0 then
    raise exception '想定外: ow_job_prefill_usage に % 行ある（0 行のときだけ取り除く）', n;
  end if;
end $$;

drop function public.reserve_job_prefill(uuid, date, integer);
drop function public.add_job_prefill_tokens(uuid, date, bigint, bigint);
drop table public.ow_job_prefill_usage;

do $$
begin
  if to_regclass('public.ow_job_prefill_usage') is not null then
    raise exception '検算失敗: 表が残っている';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
             and proname in ('reserve_job_prefill', 'add_job_prefill_tokens')) then
    raise exception '検算失敗: 関数が残っている';
  end if;
  raise notice '検算OK';
end $$;

commit;
