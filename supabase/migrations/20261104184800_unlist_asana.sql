-- ★Asana Japan株式会社 をディレクトリ（企業一覧）から外す（2026-11-04 / 柴さんの指示）
--
-- ── 何を変えるか ────────────────────────────────────────────────────────────
-- `listing_status` を 'draft' にするだけ。**データは消さない。`is_published` は true のまま。**
-- 2026-10-29 の Box Japan（20261029174000）と同じ形で、
-- **企業ページ（/companies/asana）は開けるまま、一覧・検索の候補・sitemap・LP から外れる**
-- （掲載していないページには noindex が付く）。
--
-- ★職歴の企業ピッカー（/api/companies/lookup）は「マスタの軸」（is_test=false だけで絞る）なので、
--    **職歴を登録するときは今までどおり選べる**（柴さんの指示どおり）。
--
-- ⚠️ 戻すときは `listing_status = 'listed'` を当てるだけ（`is_approved = true` のまま）。
--    `/admin/companies` の「一覧掲載」スイッチでも戻せる。
--
-- ⚠️ 紐づくデータ（2026-11-04 実測）: 公開求人0 / 職歴0 / 有効な担当者0 / ♡0 / フォロー0。
--
-- ⚠️ フィードの「参加しました」は流れ続ける（`isCompanyPostAlive` は `listing_status` を見ない。仕様）。
--
-- ⚠️ 作業前ダンプ: .dumps/20261104-1846-ow_companies.sql（260,030 バイト / 133行）
-- ⚠️ 対象は id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 同じ列を触った直近の migration を確認した: `20261104170000_flag_test_company_iida.sql`
--    と `20261029174000_unlist_box.sql`。どちらも Asana の listing_status を書いていない（打ち消しは無い）。

do $$
declare
  n bigint;
begin
  select count(*) into n
    from public.ow_companies
   where id = '6c218a59-a951-44ee-9003-163956376554'
     and name = 'Asana Japan株式会社'
     and listing_status = 'listed'
     and is_published = true;
  -- ⚠️ 想定と違えば中止する（別セッションが先に触っていた場合など）
  if n <> 1 then
    raise exception 'Asana Japan が想定の状態（listed / published）で見つからない（%件）。中止する', n;
  end if;
end $$;

update public.ow_companies
   set listing_status = 'draft'
 where id = '6c218a59-a951-44ee-9003-163956376554';

-- ⚠️ 検算。id と値の組で確かめ、ページを閉じていないこと・掲載社数が1つだけ減ったことも見る。
do $$
declare
  st text;
  pub boolean;
  listed_n bigint;
begin
  select listing_status, is_published into st, pub
    from public.ow_companies where id = '6c218a59-a951-44ee-9003-163956376554';
  if st <> 'draft' then
    raise exception 'Asana Japan の listing_status が想定と違う: %', st;
  end if;
  -- ★ページは生かしたままにする（職歴からのリンクとピッカーのため）。false なら行き過ぎ
  if pub is not true then
    raise exception 'Asana Japan の is_published を倒してはいけない: %', pub;
  end if;
  select count(*) into listed_n from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  if listed_n <> 21 then
    raise exception '掲載社数が想定（21）と違う: %。他社まで動いた可能性がある', listed_n;
  end if;
  raise notice 'Asana Japan: listing_status=% / is_published=% / 掲載社数=%', st, pub, listed_n;
end $$;
