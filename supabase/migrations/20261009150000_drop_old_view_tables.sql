-- ════════════════════════════════════════════════════════════════════════
-- 古い閲覧の表を表ごと落とす（2026-10-09 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★対象
--   ・ow_page_views（67行。2026-07-13 以降に書く経路が無い。閲覧者の列は無い）
--   ・ow_job_views（0行）
--   ・purge_old_page_views()（ow_page_views を消すだけの関数。SECURITY DEFINER）
--   閲覧数は 2026-10-09 から ow_page_view_daily（20261009140000）で数えている。
--
-- ★落とす前に数えたこと（2026-10-09 / 本番）
--   ・src からの参照: コメントのみ（analytics/page.tsx・business/dashboard.ts）
--   ・関数の本体（行コメントを除く）: ow_page_views → purge_old_page_views だけ。ow_job_views → 0
--     （陽性対照: ow_page_view_daily → increment_page_view を同じ式で検出した）
--   ・ビュー 0 ／ 他の表のポリシー 0 ／ この2表を指す FK 0 ／ トリガー 0
--   ・pg_cron は入っていない（cron.job が無い）
--
-- ⚠️ CASCADE を付けない。想定外の依存があれば失敗させたい。
-- ⚠️ 作業前ダンプ: .dumps/20261009-1720-ow_page_views-ow_job_views.sql（67行・ポリシーを含む）
--    ＋ .dumps/20261009-1638-ow_page_views-ow_job_views.sql（INSERT ポリシーを外す前）
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_page_views;
  if n <> 67 then raise exception '想定外: ow_page_views が % 行（想定 67）', n; end if;
  select count(*) into n from public.ow_job_views;
  if n <> 0 then raise exception '想定外: ow_job_views が % 行（想定 0）', n; end if;
end $$;

drop function public.purge_old_page_views();
drop table public.ow_job_views;
drop table public.ow_page_views;

do $$
begin
  if to_regclass('public.ow_page_views') is not null or to_regclass('public.ow_job_views') is not null then
    raise exception '検算失敗: 表が残っている';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'purge_old_page_views') then
    raise exception '検算失敗: purge_old_page_views が残っている';
  end if;
  if to_regclass('public.ow_page_view_daily') is null then
    raise exception '検算失敗（陽性対照）: 新しい表まで消えた';
  end if;
  raise notice '検算OK: 古い閲覧の表と関数を落とした';
end $$;

commit;
