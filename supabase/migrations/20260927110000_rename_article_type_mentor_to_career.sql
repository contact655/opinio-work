-- ★ow_articles.type の 'mentor' を 'career' にする（2026-09-27 / 柴さんの指示）
--
-- 画面のラベルは 2026-08-04 から「キャリアの軌跡 / Career Journeys」で、
-- `mentor` という語は**公開側のどこにも出ていない**。値だけが残っていた。
-- メンター機能は存在しない（同日に DB から `%mentor%` の列・表を全部落としてある）。
--
-- ⚠️★**この値は公開 URL に出る。** `/articles/type/mentor` は本番で 200 を返し、
--    sitemap にも priority 0.8 で載っている。**旧 URL からの 301 リダイレクトを
--    `next.config.mjs` に入れてある。** 消すと既存のリンクと検索結果が 404 になる。
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-0446-ow_articles.sql（73,081 バイト / 12行）
--
-- ⚠️★**順序が要る。** `type` には CHECK 制約があり、先に広げないと UPDATE が通らない。
--      ① CHECK を 'career' も許す形に張り替える（この時点では両方を許す）
--      ② 3行を UPDATE
--      ③ CHECK から 'mentor' を外す
--    ⚠️ ①と③を1本の ALTER で済ませようとすると、②が CHECK に弾かれる。
--
-- ⚠️★**コードは同じコミットで出す。** 旧コードは `type === 'mentor'` で分岐しており、
--    当てた瞬間から記事3件のラベルが出なくなる（404 にはならないが「キャリアの軌跡」の
--    一覧が空に見える）。**列の改名ほどではないが、窓はできる。**

do $$
declare
  n_mentor bigint;
  n_career bigint;
begin
  select count(*) into n_mentor from public.ow_articles where type = 'mentor';
  select count(*) into n_career from public.ow_articles where type = 'career';
  -- ⚠️ 想定と違えば中止する（実測 2026-09-27: mentor 3件 / career 0件）。
  if n_mentor = 0 then
    raise exception 'ow_articles に type=''mentor'' が無い。既に当たっている可能性がある';
  end if;
  if n_career <> 0 then
    raise exception 'ow_articles に type=''career'' が既に % 件ある。想定と違うので中止する', n_career;
  end if;
  raise notice '移す記事: % 件', n_mentor;
end $$;

-- ① CHECK を広げる（両方を許す状態を一瞬だけ作る）
alter table public.ow_articles drop constraint if exists ow_articles_type_check;
alter table public.ow_articles add constraint ow_articles_type_check
  check (type = any (array['employee'::text, 'mentor'::text, 'career'::text, 'ceo'::text, 'report'::text]));

-- ② 値を移す
update public.ow_articles set type = 'career' where type = 'mentor';

-- ③ CHECK から 'mentor' を外す
alter table public.ow_articles drop constraint ow_articles_type_check;
alter table public.ow_articles add constraint ow_articles_type_check
  check (type = any (array['employee'::text, 'career'::text, 'ceo'::text, 'report'::text]));

-- ⚠️ 検算。移し損ねと、CHECK の張り替え漏れを次の人が見つけられるように。
do $$
declare
  n_mentor bigint;
  n_career bigint;
  def text;
begin
  select count(*) into n_mentor from public.ow_articles where type = 'mentor';
  select count(*) into n_career from public.ow_articles where type = 'career';
  if n_mentor <> 0 then
    raise exception 'type=''mentor'' が % 件残っている', n_mentor;
  end if;
  if n_career <> 3 then
    raise exception 'type=''career'' が % 件（3件のはず）', n_career;
  end if;
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conrelid='public.ow_articles'::regclass and conname='ow_articles_type_check';
  if def ~ '\mmentor\M' then
    raise exception 'CHECK に mentor が残っている: %', def;
  end if;
  raise notice 'career % 件 / CHECK: %', n_career, def;
end $$;
