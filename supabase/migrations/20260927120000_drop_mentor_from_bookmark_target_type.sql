-- ★ow_bookmarks.target_type の許容値から 'mentor' を外す（2026-09-27 / 柴さんの指示）
--
-- メンター機能は存在しない（同日に DB から `%mentor%` の列・表を全部落とし、
-- 記事の `type` も `career` に変えた）。これが最後の1つ。
-- 実測（2026-09-27）: `target_type='mentor'` の行は **0件**（内訳は job:2 / company:2）。
-- UI が送っていたのも `company` / `job` だけ。
--
-- ⚠️ 作業前ダンプ: .dumps/ の ow_bookmarks（同日）
--
-- ⚠️★**3層のうち UI / API は同じコミットで直してある。**
--    許容値は `src/lib/constants/bookmarks.ts` の1箇所に集約した
--    （それまで API のルートに**3回**インラインで書かれており、型と合わせて4箇所だった）。
--    CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」。
--
-- ⚠️ これは**狭める**変更なので、順序の制約は無い。
--    古いコードが 'mentor' を送っても 400（API）か 23514（DB）で弾かれるだけで、
--    実際に送る経路は存在しない。
--
-- ⚠️★`'article'` は**残す。** 行は0件だが、記事のブックマークは概念として生きている
--    （`BookmarkButton` が受け取れる形）。`mentor`（機能ごと無い）とは事情が違う。

do $$
declare
  n bigint;
begin
  select count(*) into n from public.ow_bookmarks where target_type = 'mentor';
  -- ⚠️ 1行でもあれば中止する。CHECK を狭めると、その行は残ったまま
  --    「制約に違反しているのに存在する」状態になり、次の ALTER で必ず落ちる。
  if n <> 0 then
    raise exception 'ow_bookmarks に target_type=''mentor'' が % 行ある。DROP を中止する', n;
  end if;
end $$;

alter table public.ow_bookmarks drop constraint ow_bookmarks_target_type_check;
alter table public.ow_bookmarks add constraint ow_bookmarks_target_type_check
  check (target_type = any (array['article'::text, 'company'::text, 'job'::text]));

-- ⚠️ 検算。張り替え漏れを次の人が見つけられるように。
do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conrelid='public.ow_bookmarks'::regclass and conname='ow_bookmarks_target_type_check';
  if def ~ '\mmentor\M' then
    raise exception 'CHECK に mentor が残っている: %', def;
  end if;
  if def !~ '\marticle\M' or def !~ '\mcompany\M' or def !~ '\mjob\M' then
    raise exception '残すはずの値が落ちている: %', def;
  end if;
  raise notice 'ow_bookmarks の CHECK: %', def;
end $$;
