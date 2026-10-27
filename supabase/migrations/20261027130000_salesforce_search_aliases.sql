-- セールスフォース・ジャパンの検索用の別名（2026-10-27 / 柴さんの了承）
--
-- 検索（/search）の社名の照合に search_aliases を載せた（interpretQuery.ts）。
-- セールスフォースは別名が空で、「セールスフォース」「セールスフォース出身」と打っても社名として読まれなかった。
--
-- 対象: 1行だけ（name で明示）。作業前の控え: .dumps/20261027-1317-ow_companies.sql
-- 作業前: search_aliases = NULL
-- 戻し方: update ow_companies set search_aliases = null where name = '株式会社セールスフォース・ジャパン';
--
-- ⚠️ 空白で区切った1語ずつが照合に載る（「セールスフォース・ジャパン」は中黒込みで1語）。

do $$
declare n int;
begin
  select count(*) into n from ow_companies
   where name = '株式会社セールスフォース・ジャパン' and search_aliases is null;
  if n <> 1 then
    raise exception '想定外: 対象が % 行（1行・別名が空のはず）', n;
  end if;

  update ow_companies
     set search_aliases = 'セールスフォース セールスフォース・ジャパン SFDC'
   where name = '株式会社セールスフォース・ジャパン' and search_aliases is null;

  select count(*) into n from ow_companies
   where name = '株式会社セールスフォース・ジャパン'
     and search_aliases = 'セールスフォース セールスフォース・ジャパン SFDC';
  if n <> 1 then
    raise exception '想定外: 更新後が % 行', n;
  end if;
end $$;
