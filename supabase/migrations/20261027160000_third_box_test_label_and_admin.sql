-- 株式会社Third Box（検証用の会社）を見分けやすくし、実在のアカウントを担当者から外す（2026-10-27 / 柴さんの指示）
--
-- ① 名前を「【テスト】株式会社Third Box」に変える。
--    株式会社Opinio の旧社名と同じ名前で、検証用アカウントの「あなたに合う会社」に実在の会社のように出ていた。
--    【テスト】サンプルワークス と同じ書き方にそろえる。is_test・掲載・ページ表示は変えない（実在の利用者には元から出ない）。
--    ⚠️ normalized_name はトリガーが作り直す。職歴の企業ピッカーは is_test を返さないので候補には出ない。
--       旧社名で引いたときに株式会社Opinio が出るのは search_aliases（20261011040000）で、この行とは無関係。
-- ② s.hisato1020@gmail.com（実在のアカウント）を Third Box の担当者から外す（is_active = false。行は消さない＝戻せる）。
--    検証用の会社に実在の担当者がいると、検証用と実在が混ざるため。株式会社Opinio の担当者はそのまま。
--    外す前の担当会社（2026-10-27 実測）: 株式会社Opinio（admin・有効）／ 株式会社Third Box（admin・有効）の2社だけ。
--
-- 対象: ow_companies 1行・ow_company_admins 1行（id を明示）。
-- 作業前の控え: .dumps/20261027-1622-ow_companies-ow_company_admins.sql
-- 戻し方:
--   update ow_companies set name = '株式会社Third Box' where id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d';
--   update ow_company_admins set is_active = true where id = 'f895e5d2-244f-48af-979c-18326cfbae9c';

begin;

do $$
declare n int;
begin
  -- ① 名前（is_test の1社だけ）
  update public.ow_companies set name = '【テスト】株式会社Third Box'
   where id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d'
     and name = '株式会社Third Box' and is_test = true;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '想定外: Third Box の改名が % 行', n; end if;

  -- ② 担当者（実在のアカウントの、Third Box の行だけ）
  update public.ow_company_admins set is_active = false
   where id = 'f895e5d2-244f-48af-979c-18326cfbae9c'
     and company_id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d'
     and is_active
     and user_id = (select id from public.ow_users where email = 's.hisato1020@gmail.com' and is_test is not true);
  get diagnostics n = row_count;
  if n <> 1 then raise exception '想定外: s.hisato1020 の担当者行が % 行', n; end if;

  -- 検算: s.hisato1020 の有効な担当は株式会社Opinio の1社だけになる
  select count(*) into n
    from public.ow_company_admins a join public.ow_users u on u.id = a.user_id
   where u.email = 's.hisato1020@gmail.com' and a.is_active;
  if n <> 1 then raise exception '想定外: s.hisato1020 の有効な担当が % 社', n; end if;
end $$;

commit;
