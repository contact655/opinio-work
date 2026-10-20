-- ★サンプルの記事「「スカウトなし、真剣な対話だけ」OPINIOが目指す、IT転職の新しいスタンダード」の公開をやめる
--   （2026-10-21 / 柴さんの指示）
--
-- 理由: 中身はサンプルで、代表の発言として公開されていた。しかも今の機能と食い違う
--       （メンター・編集部の取り次ぎ・「スカウトなし」など）。
-- 対象: ow_articles の slug = 'opinio-founding-story-it-career' の1行だけ（id は下の検算で固定）。
--       is_published を false にするだけ。行・本文は消さない。
-- 影響: 記事ページは非公開になり、記事一覧・sitemap・フィードの「記事公開」の告知
--       （isArticlePostAlive が is_published を見る）からも消える。
-- 作業前ダンプ: .dumps/20261021-0306-ow_articles.sql
-- 戻し方:
--   update ow_articles set is_published = true where slug = 'opinio-founding-story-it-career';

do $$
declare n int;
begin
  select count(*) into n from ow_articles where slug = 'opinio-founding-story-it-career' and is_published = true;
  if n <> 1 then
    raise exception '想定と違う: 公開中の対象記事が % 件', n;
  end if;

  update ow_articles set is_published = false
   where slug = 'opinio-founding-story-it-career' and is_published = true;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception '想定と違う: 更新したのが % 件', n;
  end if;
end $$;
