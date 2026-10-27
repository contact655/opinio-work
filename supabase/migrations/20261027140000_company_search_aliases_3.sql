-- 検索用の別名を3社に足す（2026-10-27 / 柴さんの了承）
--
-- 検索の社名の照合で法人格を外して比べるようにした（interpretQuery.ts の stripLegalForm）。
-- それでも当たらなかった3社だけに、短い呼び方を足す。
--
--   Okta Japan株式会社                 「オクタ」（別名は「オクタ・ジャパン」「オクタジャパン」だけだった）
--   アンソロピックジャパン合同会社       「アンソロピック」（別名が空だった）
--   日本ヒューレット・パッカード合同会社 「ヒューレット・パッカード」「ヒューレットパッカード」
--
-- 対象: 3行（name で明示）。作業前の控え: .dumps/20261027-1424-ow_companies.sql
-- 作業前の値（戻し方）:
--   update ow_companies set search_aliases = 'オクタ・ジャパン オクタジャパン' where name = 'Okta Japan株式会社';
--   update ow_companies set search_aliases = null where name = 'アンソロピックジャパン合同会社';
--   update ow_companies set search_aliases = 'ニホンヒューレットパッカード' where name = '日本ヒューレット・パッカード合同会社';
-- ⚠️ ow_companies に updated_at を書き換えるトリガーは無い（一覧の並び順は変わらない）

do $$
declare n int;
begin
  select count(*) into n from ow_companies where
       (name = 'Okta Japan株式会社' and search_aliases = 'オクタ・ジャパン オクタジャパン')
    or (name = 'アンソロピックジャパン合同会社' and search_aliases is null)
    or (name = '日本ヒューレット・パッカード合同会社' and search_aliases = 'ニホンヒューレットパッカード');
  if n <> 3 then
    raise exception '想定外: 作業前の状態に一致するのが % 行（3行のはず）', n;
  end if;

  update ow_companies set search_aliases = 'オクタ・ジャパン オクタジャパン オクタ'
   where name = 'Okta Japan株式会社' and search_aliases = 'オクタ・ジャパン オクタジャパン';
  update ow_companies set search_aliases = 'アンソロピック'
   where name = 'アンソロピックジャパン合同会社' and search_aliases is null;
  update ow_companies set search_aliases = 'ニホンヒューレットパッカード ヒューレット・パッカード ヒューレットパッカード'
   where name = '日本ヒューレット・パッカード合同会社' and search_aliases = 'ニホンヒューレットパッカード';

  select count(*) into n from ow_companies where
       (name = 'Okta Japan株式会社' and search_aliases = 'オクタ・ジャパン オクタジャパン オクタ')
    or (name = 'アンソロピックジャパン合同会社' and search_aliases = 'アンソロピック')
    or (name = '日本ヒューレット・パッカード合同会社' and search_aliases = 'ニホンヒューレットパッカード ヒューレット・パッカード ヒューレットパッカード');
  if n <> 3 then
    raise exception '想定外: 更新後が % 行（3行のはず）', n;
  end if;
end $$;
