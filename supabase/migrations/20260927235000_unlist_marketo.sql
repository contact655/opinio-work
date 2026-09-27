-- ★マルケト株式会社をディレクトリから外す（2026-09-27 / 柴さんの指示）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- **法人として存在しない。** 国税庁法人番号公表サイト（一次情報）で確認した:
--
--   法人番号   1010401108745
--   商号       株式会社マルケト（⚠️ DB の「マルケト株式会社」とは語順が違う）
--   所在地     東京都港区六本木６丁目１０番１号 六本木ヒルズ森タワー
--   状態       **登記記録の閉鎖等（清算の結了等）**
--   事由発生   令和2年2月14日（2020-02-14）／ 最終更新 令和2年2月20日
--
-- 部分一致＋「登記記録の閉鎖等含める」で「マルケト」を引いて **1件だけ**。
-- 現存する同名法人は無い。吸収先の **アドビ株式会社**（7010701011841・大崎 /
-- 旧商号 アドビシステムズ株式会社）は閉鎖印なしで現存。
--
-- ⚠️★**DB には登記を見た記録が残っていた。** `ow_company_data_sources` に
--    `headquarters_address / registry / houjin-bangou.nta.go.jp` の行があり、
--    住所は登記と**完全一致**する。つまり**登記を引いて住所を入れたのに、
--    同じ画面に出ていた「閉鎖等」の印を見ていなかった。**
--
-- ⚠️ `description` の「2018年にAdobeが買収後も独自ブランドで展開を継続中」は、
--    継続しているのが**製品ブランド**（Adobe Marketo Engage）であって
--    日本法人ではない。`employee_count = 約300名` も閉鎖前の数字。
--    **この migration では本文を触っていない**（掲載から外せば求職者には出ない）。
--
-- ── 何を変えるか ────────────────────────────────────────────────────────────
-- `listing_status` を 'draft' にするだけ。**`is_published` は true のまま残す。**
-- 2026-09-14 に61社を外したとき（CLAUDE.md ⑨）と同じ形で、
-- **企業ページは生きたままディレクトリから外れる。**
--
-- ⚠️ `trg_guard_company_approval` が止めるのは**掲載を立てる方向だけ**。
--    'draft' へ倒すのは通る。`is_approved = true` のままなので**戻せる**
--    （`listing_status = 'listed'` を当てるだけ）。
--
-- ⚠️ 紐づくデータは実測で**すべて0件**（2026-09-27）:
--    求人0 / 職歴0 / 面談対応者0 / 管理者0 / ♡0 / フォロー0 / 記事0 / 面談申込0。
--    ＝ **リンクが死ぬ経路が1つも無い。**
--
-- ⚠️★**フィードの `company_joined` 1件（2026-06-04）はそのまま流れ続ける。**
--    `isCompanyPostAlive`（lib/feed/visibility.ts）は `is_published` だけを見て
--    `listing_status` を見ないため。**これは仕様**（CLAUDE.md ⑨ で
--    「`isCompanyPostAlive` に `listing_status` を足さないこと」と決めてある）。
--    リンク先は 200 のままなので行き止まりにはならない。
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-2347-ow_companies.sql（214,721 バイト / 106行）
-- ⚠️★対象を id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 同じ列を触った直近の migration を確認した: `20260914160000_unlist_61_companies.sql`
--    が61社を 'draft' にしているが、**マルケトはその61社に含まれていない**
--    （含まれていれば今 'listed' ではない）。打ち消しにはならない。

do $$
declare
  n bigint;
begin
  select count(*) into n from public.ow_companies
   where id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5'
     and name = 'マルケト株式会社'
     and listing_status = 'listed'
     and is_published = true
     and is_approved = true;
  -- ⚠️ 想定と違えば中止する（別セッションが先に触っていた場合など）
  if n <> 1 then
    raise exception 'マルケトが想定の状態（listed / published / approved）で見つからない（%件）。中止する', n;
  end if;
end $$;

update public.ow_companies
   set listing_status = 'draft'
 where id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5';

-- ⚠️ 検算。**件数だけでは足りない**ので、id と値の組で確かめる
--    （ui-debugging ⑱「集合が一致するだけでは足りない」）。
--    あわせて「ページを閉じていないこと」「掲載社数が1つだけ減ったこと」も見る。
do $$
declare
  st text;
  pub boolean;
  listed_n bigint;
begin
  select listing_status, is_published into st, pub
    from public.ow_companies where id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5';
  if st <> 'draft' then
    raise exception 'マルケトの listing_status が想定と違う: %', st;
  end if;
  -- ★ページは生かしたままにする。ここが false になっていたら行き過ぎ
  if pub is not true then
    raise exception 'マルケトの is_published を倒してはいけない: %', pub;
  end if;
  select count(*) into listed_n from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  if listed_n <> 21 then
    raise exception '掲載社数が想定（21）と違う: %。他社まで動いた可能性がある', listed_n;
  end if;
  raise notice 'マルケト: listing_status=% / is_published=% / 掲載社数=%', st, pub, listed_n;
end $$;
