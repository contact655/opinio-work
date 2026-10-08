-- ============================================================================
-- ★スカウト廃止 ③：ow_profiles.scout_enabled を落とす（2026-10-08 作成 / **未適用**）
-- ============================================================================
-- ⚠️★**supabase/pending/ に置いてある。** 採番は移すときに振り直す。
-- ⚠️ 当てる前に `./scripts/dump-tables.sh ow_profiles` で保全を取ること。
--
-- 2026-08-27 から読み手も書き手も0件（列の COMMENT にも記録あり）。
-- 送信可否・候補者検索・提案の同意は `career_stance`（`isReachableByCompanies`）が決める。
-- 決定（2026-10-08 / 柴さん）: (c) 列は残して参照も足さない → DROP はここに置く。
-- 実測（2026-10-08 / 実ユーザー39人）: true 36 ／ null 2 ／ false 0。
--   ⚠️ true は「本人の意思」ではなく、2026-08-04 以降の登録者に既定値で付いたもの。
--
-- ⚠️ 関数・ポリシー・ビュー・索引からの参照は 0件（2026-10-08 実測）。中でも検査する。
-- ============================================================================

begin;

do $$
declare n int;
begin
  select count(*) into n from pg_proc
   where pronamespace = 'public'::regnamespace
     and regexp_replace(prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ '\mscout_enabled\M';
  if n <> 0 then raise exception '中止: scout_enabled を本文で参照する関数が % 本ある', n; end if;
end $$;

alter table public.ow_profiles drop column scout_enabled;

commit;
