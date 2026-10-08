-- ============================================================================
-- ★スカウト廃止 ④：ow_profiles.email_scout_enabled を落とす（2026-10-08）
-- ============================================================================
-- ★決定（2026-10-08 / 柴さん）: 最初は「入力欄は外す・列は残す」だったが、
--   同日に「入力欄を外して読み手が0件になったので落とす」に変えた。
-- ⚠️ 当てる前に `./scripts/dump-tables.sh ow_profiles` で保全を取ること。
--
-- 入力欄（/mypage/settings の「スカウトのお知らせ」）と API（/api/jobseeker/email-settings）
-- からは 2026-10-08 に外した。読み手も書き手も0件。
-- 実測（2026-10-08）: false 0人（＝本人が切った記録は無い。消して失われる意思表示は無い）。
-- ============================================================================

begin;

do $$
declare n int;
begin
  select count(*) into n from pg_proc
   where pronamespace = 'public'::regnamespace
     and regexp_replace(prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ '\memail_scout_enabled\M';
  if n <> 0 then raise exception '中止: email_scout_enabled を本文で参照する関数が % 本ある', n; end if;
end $$;

alter table public.ow_profiles drop column email_scout_enabled;

commit;
