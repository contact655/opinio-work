-- ★見本データだった記事11本を非公開にする（2026-10-20 / 柴さんの指示）
--
-- なぜ:
--   公開中の記事12本は、archive/046（「seed (10 articles from mockArticleData.ts)」）と
--   archive/143 で入れた見本データだった。取材はしていない。
--   実在の会社の実在の人物（SmartHR の芹澤 雅人さん、PKSHA の上野山 勝也さんなど）の
--   発言として載っており、公開日も作成日（2026-04 / 2026-06）より前の日付になっていた。
--   創業ストーリー（opinio-founding-story-it-career / 柴 久人）だけ残す。
--
-- 何を: ow_articles.is_published を false にする（11行・slug を明示列挙）。
--   ⚠️ 行・本文・published_at は消さない。フィードの「公開しました」投稿（11件）も消さない
--      （コード側の isArticlePostAlive が隠す。同じコミット）。
--
-- 作業前ダンプ: .dumps/20261020-0404-ow_articles-ow_posts.sql（ow_articles 12行 / ow_posts 169行）
--
-- 戻し方:
--   update public.ow_articles set is_published = true, updated_at = now()
--    where slug in (下の11本);
--
-- 確認したこと（2026-10-20 / 本番・読み取りのみ）:
--   ・この11本を指すブックマーク 0件 ／ 創業ストーリーの related_article_slugs は空
--   ・同じ列（is_published）を全社一括で触る migration は無い（id ではなく slug で列挙している）

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_articles
   where is_published and slug in (
     'timee-pm-growth-product','thinca-omnichannel-product-story','translead-field-sales-zero-input',
     'hubspot-product-org-report','irodas-cs-new-grad-mission','smarthr-hayashi-csm-career',
     'smarthr-ceo-hr-tech-future','salesforce-murakami-cso-path','ubie-taniguchi-cto-journey',
     'pksha-ml-culture-ceo','sansan-kato-pdm-career');
  if n <> 11 then raise exception '想定と違う: 公開中の対象が % 本（11本のはず）', n; end if;

  select count(*) into n from public.ow_articles where is_published;
  if n <> 12 then raise exception '想定と違う: 公開中の記事が % 本（12本のはず）', n; end if;
end $$;

update public.ow_articles
   set is_published = false, updated_at = now()
 where is_published and slug in (
   'timee-pm-growth-product','thinca-omnichannel-product-story','translead-field-sales-zero-input',
   'hubspot-product-org-report','irodas-cs-new-grad-mission','smarthr-hayashi-csm-career',
   'smarthr-ceo-hr-tech-future','salesforce-murakami-cso-path','ubie-taniguchi-cto-journey',
   'pksha-ml-culture-ceo','sansan-kato-pdm-career');

do $$
declare n int; s text;
begin
  select count(*), string_agg(slug, ',') into n, s from public.ow_articles where is_published;
  if n <> 1 or s <> 'opinio-founding-story-it-career' then
    raise exception '想定と違う: 適用後の公開中 % 本（%）', n, s;
  end if;
end $$;

commit;
