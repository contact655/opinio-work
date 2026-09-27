-- ★本番の画面で作られた「株式会社テスト」を is_test にする（2026-09-28 / 柴さんの指示）
--
-- ⚠️★**同じ日に3件目。** `20260928013000`（人5件）→ `20260928015000`（企業4社）に続いて、
--    **その作業中に本番のオンボーディング画面で新しく1社作られた。**
--    ＝ CLAUDE.md「検証用に作った企業行が `is_test` のまま残る」は、
--    注意書きを書いた当日にもう1回起きている。**作ったその場で倒すのが唯一の対処。**
--
-- ── 対象（2026-09-28 実測）────────────────────────────────────────────────
--
-- | | |
-- |---|---|
-- | id | 2634b51b-2337-4bd7-8e4a-7c39facb2cdf |
-- | name | 株式会社テスト（brand_name: テスト） |
-- | source | `user`（求職者のオンボーディング2画面目から作られた） |
-- | 作成 | 2026-09-28 03:59（JST） |
-- | listing_status / is_published | `draft` / `false` |
--
-- ⚠️★**ぶら下がる行は0件。** `ow_companies` を指す FK **49本を全表横断で数えて0**。
--    （職歴・求人・管理者・面談対応者・♡・フォローのどれも無い）
--    ⚠️ 検出器が効くことは `株式会社ZAP` で自己テストした（4表・6行を検出）。
--
-- ⚠️★**それでも行は消さない。`is_test` を立てるだけ。**
--    いまは参照0件だが、DROP を既定にすると「参照があるかを毎回数える」運用になる。
--    `is_test` なら**数え間違えても壊れない。**
--
-- ⚠️ `trg_guard_company_approval` は**掲載を立てる方向だけ**を止める。
--    `is_published` / `listing_status` は触らないので通る。
--
-- ── 倒すと動く数字（適用前に実測。**適用後にこの値で検算する**）──────────────
--
-- | 何が | 前 | 後 |
-- |---|---|---|
-- | 企業ピッカーの母集団（`is_test` でない） | **100** | **99** |
-- | `is_test = true` の企業 | **7** | **8** |
-- | 掲載中の企業 | **21** | **21**（変わらない） |
-- | 企業の行数 | **107** | **107**（消さない） |
--
-- ⚠️ 作業前ダンプ: .dumps/20260928-0416-ow_companies.sql（216,151 バイト / 107行）
-- ⚠️★対象を id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 同じ列を触った直近の migration を確認した: `20260928015000` は別の4社
--    （HR Tech / TYU / ZAP / ゼクイース）で、この1社は含まれていない。打ち消しにはならない。

do $$
declare
  n bigint;
  before_pool bigint;
  before_listed bigint;
  refs bigint;
begin
  select count(*) into n from public.ow_companies
   where id = '2634b51b-2337-4bd7-8e4a-7c39facb2cdf'
     and name = '株式会社テスト'
     and is_test is not true
     and listing_status = 'draft'
     and is_published = false;
  if n <> 1 then
    raise exception '対象が「株式会社テスト / is_test でない / draft / 非公開」で見つからない（%件）。中止する', n;
  end if;

  -- ★ぶら下がる行が1件でもあれば中止する（FK を全部たどって数える）
  select coalesce(sum((xpath('/row/cnt/text()', x))[1]::text::int), 0) into refs
    from (
      select query_to_xml(format('select count(*) as cnt from public.%I where %I = %L',
               c.relname, a.attname, '2634b51b-2337-4bd7-8e4a-7c39facb2cdf'), false, true, '') as x
        from pg_constraint k
        join pg_class c on c.oid = k.conrelid
        join unnest(k.conkey) with ordinality as u(attnum, ord) on true
        join pg_attribute a on a.attrelid = c.oid and a.attnum = u.attnum
       where k.contype = 'f' and k.confrelid = 'public.ow_companies'::regclass
         and c.relnamespace = 'public'::regnamespace
    ) s;
  if refs <> 0 then
    raise exception 'この企業を参照する行が % 件ある。中止する（内容を確かめてから判断する）', refs;
  end if;

  select count(*) into before_pool from public.ow_companies where is_test is not true;
  if before_pool <> 100 then
    raise exception '企業ピッカーの母集団が想定（100）と違う: %。中止する', before_pool;
  end if;

  select count(*) into before_listed from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  if before_listed <> 21 then
    raise exception '掲載中の企業が想定（21）と違う: %。中止する', before_listed;
  end if;
end $$;

update public.ow_companies
   set is_test = true
 where id = '2634b51b-2337-4bd7-8e4a-7c39facb2cdf';   -- 株式会社テスト

-- ⚠️ 検算。「1行更新した」だけでは足りないので、測った値が想定どおり動いたかを見る。
do $$
declare
  after_pool bigint;
  after_listed bigint;
  n_rows bigint;
  still_draft bigint;
begin
  select count(*) into n_rows from public.ow_companies
   where id = '2634b51b-2337-4bd7-8e4a-7c39facb2cdf' and is_test = true;
  if n_rows <> 1 then
    raise exception 'is_test になっていない（%件）', n_rows;
  end if;

  select count(*) into after_pool from public.ow_companies where is_test is not true;
  if after_pool <> 99 then
    raise exception '企業ピッカーの母集団が想定（99）と違う: %', after_pool;
  end if;

  select count(*) into after_listed from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  if after_listed <> 21 then
    raise exception '掲載中の企業が想定（21）と違う: %。他社まで動いた可能性がある', after_listed;
  end if;

  -- ★行を消していないこと（is_test を立てただけ）
  select count(*) into n_rows from public.ow_companies;
  if n_rows <> 107 then
    raise exception '企業の行数が想定（107）と違う: %', n_rows;
  end if;

  -- ★掲載・公開の状態を動かしていないこと
  select count(*) into still_draft from public.ow_companies
   where id = '2634b51b-2337-4bd7-8e4a-7c39facb2cdf'
     and listing_status = 'draft' and is_published = false;
  if still_draft <> 1 then
    raise exception '掲載・公開の状態が動いた';
  end if;

  raise notice 'ピッカー母集団 100->% / 掲載 %（変化なし）/ is_test の企業 % 社 / 行数 %',
    after_pool, after_listed,
    (select count(*) from public.ow_companies where is_test = true), n_rows;
end $$;
