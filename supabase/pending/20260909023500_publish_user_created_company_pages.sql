-- ★利用者・企業が作った6社のページを見えるようにする（2026-09-09 / 柴さんの判断）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- 方針は「**企業ページは作られた時点で見える。運営が決めるのは一覧掲載だけ**」
-- （CLAUDE.md）。ところが作成 API は `is_published = false` で作っており、
-- **実装が方針に追いついていなかった。**
--
-- 実害: `lib/utils/timeline.ts` は `isPublished === false` の会社について
-- `company_id` を落として会社名を**テキスト表示**にする（404 の行き止まりを
-- 作らないため）。その結果、2026-09-07 に利用者が作った3社は
-- **職歴に書かれているのにリンクが張られない**状態だった。
--
-- ⚠️ 一覧・検索・sitemap には**出ない**（`listing_status` は 'draft' のまま）。
--    `noindex` も付く。ディレクトリに載せるかは今までどおり運営の判断。
-- ⚠️ `is_approved` も **false のまま**。一覧掲載の前提条件なので触らない。
--
-- ── 対象（id を明示列挙。全社一括 UPDATE を禁じている CLAUDE.md の規則） ──
--   source='user'（経歴から作られた。職歴からの参照が各1件・管理者0人）
--     プルデンシャル生命保険株式会社 / 株式会社ニトリ / 株式会社Archi Village
--   source='biz_self'（企業が自分で登録。職歴の参照0・管理者1人）
--     合同会社やめるラボ / 株式会社ゼクイース / 株式会社TYU
--   ⚠️ biz_self の3社も含めたのは、**同じ方針を2種類に分けて適用すると
--      説明できない差が残る**ため。どれも一覧には出ないので、
--      URL を知っている人だけが開ける状態になる。
--   ⚠️ 戻すのは `/admin/companies` の「ページ表示」を1社ずつ押すだけ。
--
-- ⚠️ `published_at` を同時に埋める（CLAUDE.md「migration で is_published を true に
--    するときも published_at を埋める」。過去に80社ぶん取り逃している）。

begin;

-- 事前チェック: 対象6社がすべて「非公開・published_at 未記録」であること
do $$
declare n int;
begin
  select count(*) into n from ow_companies
   where id in (
     '5c4cde89-72f2-45d1-b995-4d9aeb2af583',  -- プルデンシャル生命保険株式会社
     '75f33a19-a361-457e-8fa2-cae13e8a7931',  -- 株式会社ニトリ
     'eb06556a-cf2e-47af-b03c-0dd0e9ccfed3',  -- 株式会社Archi Village
     '3c63e639-07a2-4823-8fe2-ff98f135153f',  -- 合同会社やめるラボ
     'aa6beae7-3ef8-42e6-b6b2-d4acfec0a5fe',  -- 株式会社ゼクイース
     '08206d13-0f98-465c-adf9-982f6fbc520e'   -- 株式会社TYU
   )
     and is_published = false
     and published_at is null;
  if n <> 6 then
    raise exception '想定と違う（非公開かつ published_at 未記録の対象が % 社。6社のはず）。中止する。', n;
  end if;
end $$;

update ow_companies
   set is_published = true,
       published_at = now(),
       updated_at   = now()
 where id in (
   '5c4cde89-72f2-45d1-b995-4d9aeb2af583',
   '75f33a19-a361-457e-8fa2-cae13e8a7931',
   'eb06556a-cf2e-47af-b03c-0dd0e9ccfed3',
   '3c63e639-07a2-4823-8fe2-ff98f135153f',
   'aa6beae7-3ef8-42e6-b6b2-d4acfec0a5fe',
   '08206d13-0f98-465c-adf9-982f6fbc520e'
 );

-- 事後チェック: 一覧掲載が増えていないこと（ディレクトリは変わらないはず）
do $$
declare listed int;
begin
  select count(*) into listed from ow_companies
   where listing_status = 'listed' and is_published = true and is_test = false;
  if listed <> 83 then
    raise exception '掲載中が % 社になった（83社のはず）。一覧に漏れている。中止する。', listed;
  end if;
end $$;

commit;
