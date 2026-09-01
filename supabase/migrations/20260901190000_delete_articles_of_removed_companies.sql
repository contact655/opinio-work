-- ============================================================================
-- 掲載していない企業の記事4件を削除する（2026-09-01 / 柴さんの判断）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- この4件の `company_slug` は `ow_companies` に存在しない。企業側は
-- migration 238/239 で削除済み（medimo / Archi Village / freee / LayerX）だが、
-- **記事だけが公開されたまま残っていた。**
--
--   archi-village-cto-dx-journey   … Archi Village株式会社
--   freee-platform-infra-report    … freee
--   layerx-nakamura-why-mentor     … LayerX
--   layerx-suzuki-backend-career   … LayerX
--
-- ⚠️ リンク切れは起きていなかった（`resolvePublishedCompanyHref` が null を返し、
--    `CompanyCTA` がブロックごと出さない）。**掲載していない企業の記事が
--    公開され続けている**という状態そのものを解消する。
--
-- ── ★同時に消すもの ────────────────────────────────────────────────────────
-- ⚠️★**`ow_posts.ref_article_id` に FK が1本も無い**（実測 2026-09-01）。
--    記事だけ消すと投稿4件が参照先を失い、**幽霊投稿になる。**
--    CLAUDE.md の migration 238/239 で作った「幽霊投稿60件」と**同じ形**。
--    → 投稿も同じ migration で消す。
--    ⚠️ いいね0 / コメント0 / 通知0 を事前に確認済み（消しても巻き添えは無い）。
--
-- ⚠️ 他の記事6件が `related_article_slugs` でこの4件を指している。
--    残すと「関連記事」から404へ飛ぶので、配列から取り除く。
--    ⚠️ 記事側の `related_job_ids` は**描画側の参照が0件**なので触らない
--       （docs/todo.md に別途記録済み）。
--
-- ⚠️ 作業前ダンプ: .dumps/20260901-1812-ow_articles-ow_posts.sql
--    （ow_articles 16行 / ow_posts 170行。⚠️ コミットしない）
-- ============================================================================

do $$
declare
  v_slugs text[] := array[
    'archi-village-cto-dx-journey',
    'freee-platform-infra-report',
    'layerx-nakamura-why-mentor',
    'layerx-suzuki-backend-career'
  ];
  v_ids       uuid[];
  v_articles  int;
  v_posts     int;
  v_related   int;
begin
  -- ① 対象が想定どおり4件あることを確かめる。違えば中止（CLAUDE.md）
  select array_agg(id) into v_ids from ow_articles where slug = any(v_slugs);
  if v_ids is null or array_length(v_ids, 1) <> 4 then
    raise exception '対象記事が4件ではない（実際: %）。中止する', coalesce(array_length(v_ids,1), 0);
  end if;

  -- ② 対象の企業が本当に存在しないことを確かめる。
  --    ⚠️ 企業が復活していたら削除の理由が消えるので、その場合も中止する。
  if exists (
    select 1 from ow_articles a join ow_companies c on c.slug = a.company_slug
     where a.slug = any(v_slugs)
  ) then
    raise exception '対象記事の企業が ow_companies に存在する。前提が変わっているので中止する';
  end if;

  -- ③ 他の記事の「関連記事」から取り除く
  update ow_articles a
     set related_article_slugs = (
           select coalesce(array_agg(s), '{}')
             from unnest(a.related_article_slugs) s
            where s <> all(v_slugs)
         )
   where a.slug <> all(v_slugs)
     and a.related_article_slugs && v_slugs;
  get diagnostics v_related = row_count;

  -- ④ フィード投稿（FK が無いので手で消す）
  delete from ow_posts where ref_article_id = any(v_ids);
  get diagnostics v_posts = row_count;

  -- ⑤ 記事本体
  delete from ow_articles where id = any(v_ids);
  get diagnostics v_articles = row_count;

  if v_articles <> 4 then
    raise exception '削除できた記事が4件ではない（実際: %）', v_articles;
  end if;

  raise notice '記事 % 件 / 投稿 % 件を削除。関連記事の配列を % 件更新',
    v_articles, v_posts, v_related;
end $$;

-- ⑥ 事後チェック。参照先を失った投稿が残っていないこと
do $$
declare v_orphan int;
begin
  select count(*) into v_orphan
    from ow_posts p
   where p.post_type = 'article_published'
     and p.ref_article_id is not null
     and not exists (select 1 from ow_articles a where a.id = p.ref_article_id);
  if v_orphan > 0 then
    raise exception '参照先の無い記事投稿が % 件残っている', v_orphan;
  end if;
end $$;
