-- 業界の呼び方を「IT/SaaS」から「IT」に変える（柴さんの判断・2026-09-06）。
--
-- コード側（src / content の103箇所）は 30be3716 で変更済み。ここは DB に残った分。
--
-- ⚠️ 対象は **株式会社Opinio 自身のデータと、その告知投稿だけ**。
--    全社一括の UPDATE はしない（CLAUDE.md「migration を書くときのルール①」）ので
--    id を明示列挙する。
--
-- ⚠️ **触らないもの**（意図的に対象外）:
--      ow_users.about_me（柴さん本人の文章。本人がマイページから直す）
--      ow_contact_submissions.message ×3（外部からの問い合わせ。他社の文章）
--
-- ⚠️ 同じ列を触った直近の migration を確認済み（CLAUDE.md ルール②）:
--      20260810165357_shorten_company_taglines.sql
--      20260810172639_shorten_taglines_mobile.sql
--      20260828030000_add_ctc_tagline.sql
--    いずれも **株式会社Opinio を対象にしていない**（grep で 0 件）。打ち消しは起きない。
--
-- ⚠️ replace() を使うので **冪等**。2回流しても結果は変わらない。

begin;

-- ── 事前チェック。想定と違えば中止する ────────────────────────────────
do $$
declare
  n_companies int;
  n_articles  int;
  n_posts     int;
begin
  select count(*) into n_companies from ow_companies
   where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';
  select count(*) into n_articles from ow_articles
   where id = '5a47a261-2e2a-47ac-aff3-db0fdf2e50ef';
  select count(*) into n_posts from ow_posts
   where id in ('88d20d60-c6ab-4a5c-9288-5720e2d27b5d',
                '4ea4bbdf-f369-4503-b2bc-5ecc2d797ba2');

  if n_companies <> 1 or n_articles <> 1 or n_posts <> 2 then
    raise exception '対象行が想定と違う: companies=% articles=% posts=% （期待 1/1/2）',
      n_companies, n_articles, n_posts;
  end if;
end $$;

-- ── ① 株式会社Opinio の企業情報 ───────────────────────────────────────
--    tagline     「IT/SaaS業界の、信頼できる…」 → 「IT業界の、信頼できる…」
--    description 「IT・SaaS業界に特化した…」    → 「IT業界に特化した…」
--    why_join    「IT・SaaS業界特化の…」        → 「IT業界特化の…」
update ow_companies
   set tagline     = replace(replace(tagline,     'IT/SaaS', 'IT'), 'IT・SaaS', 'IT'),
       description = replace(replace(description, 'IT/SaaS', 'IT'), 'IT・SaaS', 'IT'),
       why_join    = replace(replace(why_join,    'IT/SaaS', 'IT'), 'IT・SaaS', 'IT')
 where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';

-- ── ② 取材記事（slug: opinio-founding-story-it-career）────────────────
--    ⚠️ slug は変えない。「IT/SaaS」を含まないので URL は変わらず、被リンクも切れない。
update ow_articles
   set title    = replace(replace(title,    'IT/SaaS', 'IT'), 'IT・SaaS', 'IT'),
       subtitle = replace(replace(subtitle, 'IT/SaaS', 'IT'), 'IT・SaaS', 'IT')
 where id = '5a47a261-2e2a-47ac-aff3-db0fdf2e50ef';

-- ── ③ フィード投稿2件 ─────────────────────────────────────────────────
--    どちらも①②の文言をそのまま焼いた告知なので、揃えないとフィードにだけ
--    旧表記が残る（company_joined は tagline を、article_published は記事タイトルを含む）。
update ow_posts
   set content = replace(replace(content, 'IT/SaaS', 'IT'), 'IT・SaaS', 'IT')
 where id in ('88d20d60-c6ab-4a5c-9288-5720e2d27b5d',
              '4ea4bbdf-f369-4503-b2bc-5ecc2d797ba2');

-- ── 事後チェック。対象6値から旧表記が消えたことを確かめる ──────────────
do $$
declare
  leftovers int;
begin
  select
    (select count(*) from ow_companies
      where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251'
        and (coalesce(tagline,'')     ~ 'IT[/・]SaaS'
          or coalesce(description,'') ~ 'IT[/・]SaaS'
          or coalesce(why_join,'')    ~ 'IT[/・]SaaS'))
  + (select count(*) from ow_articles
      where id = '5a47a261-2e2a-47ac-aff3-db0fdf2e50ef'
        and (coalesce(title,'')    ~ 'IT[/・]SaaS'
          or coalesce(subtitle,'') ~ 'IT[/・]SaaS'))
  + (select count(*) from ow_posts
      where id in ('88d20d60-c6ab-4a5c-9288-5720e2d27b5d',
                   '4ea4bbdf-f369-4503-b2bc-5ecc2d797ba2')
        and coalesce(content,'') ~ 'IT[/・]SaaS')
  into leftovers;

  if leftovers <> 0 then
    raise exception '旧表記が % 行に残っている', leftovers;
  end if;
end $$;

commit;
