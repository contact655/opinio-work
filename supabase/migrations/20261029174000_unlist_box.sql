-- ★株式会社Box Japan をディレクトリ（企業一覧）から外す（2026-10-29 / 柴さんの指示）
--
-- ── 何を変えるか ────────────────────────────────────────────────────────────
-- `listing_status` を 'draft' にするだけ。**データは消さない。`is_published` は true のまま。**
-- 2026-09-14 の61社（CLAUDE.md ⑨）・2026-09-27 のマルケトと同じ形で、
-- **企業ページ（/companies/box）は開けるまま、一覧・検索の候補・sitemap・LP から外れる**
-- （掲載していないページには noindex が付く）。
--
-- ⚠️ 戻すときは `listing_status = 'listed'` を当てるだけ（`is_approved = true` のまま）。
--    `/admin/companies` の「一覧掲載」スイッチでも戻せる。
--
-- ⚠️ 紐づくデータ（2026-10-29 実測）: 公開求人0 / 有効な担当者0 / ♡0 / フォロー0 /
--    職歴1件（持ち主は検証用アカウント。実在の利用者の職歴は0件）。
--    職歴のリンクは `is_published` だけを見るので切れない。
--
-- ⚠️ フィードの「参加しました」は流れ続ける（`isCompanyPostAlive` は `listing_status` を見ない。仕様）。
--
-- ⚠️ 作業前ダンプ: .dumps/20261029-1736-ow_companies.sql（260,031 バイト / 133行）
-- ⚠️ 対象は id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 同じ列を触った直近の migration を確認した: `20261028121000_company_self_publish.sql`
--    （企業が自分で公開・非公開にする仕組み）と `20260927235000_unlist_marketo.sql`。
--    どちらも Box の listing_status を書いていない（打ち消しは無い）。

do $$
declare
  n bigint;
begin
  select count(*) into n
    from public.ow_companies
   where id = 'c7353772-0c07-4f0d-8d20-294215125303'
     and name = '株式会社Box Japan'
     and listing_status = 'listed'
     and is_published = true;
  -- ⚠️ 想定と違えば中止する（別セッションが先に触っていた場合など）
  if n <> 1 then
    raise exception 'Box Japan が想定の状態（listed / published）で見つからない（%件）。中止する', n;
  end if;
end $$;

update public.ow_companies
   set listing_status = 'draft'
 where id = 'c7353772-0c07-4f0d-8d20-294215125303';

-- ⚠️ 検算。id と値の組で確かめ、ページを閉じていないこと・掲載社数が1つだけ減ったことも見る。
do $$
declare
  st text;
  pub boolean;
  listed_n bigint;
begin
  select listing_status, is_published into st, pub
    from public.ow_companies where id = 'c7353772-0c07-4f0d-8d20-294215125303';
  if st <> 'draft' then
    raise exception 'Box Japan の listing_status が想定と違う: %', st;
  end if;
  -- ★ページは生かしたままにする。ここが false になっていたら行き過ぎ
  if pub is not true then
    raise exception 'Box Japan の is_published を倒してはいけない: %', pub;
  end if;
  select count(*) into listed_n from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  if listed_n <> 22 then
    raise exception '掲載社数が想定（22）と違う: %。他社まで動いた可能性がある', listed_n;
  end if;
  raise notice 'Box Japan: listing_status=% / is_published=% / 掲載社数=%', st, pub, listed_n;
end $$;
