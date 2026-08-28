-- 本社住所を2社ぶん埋める（2026-08-28）
--
-- ── なぜ2社だけか ──────────────────────────────────────────────────────────
-- 掲載79社のうち `headquarters_address` が空なのは **69社**。ただし
-- **充填済みの10社は掲載順の1〜12位に固まっており**、一覧を開いた人が最初に見る
-- 範囲はほぼ埋まっている（2026-08-28 実測）。
--
-- ⚠️ **機械的な抽出は不採用にした。** 公式サイトの定番パス9つを当てて
--    〒＋都道府県を拾う方式は **12社中2社しか取れず**、しかも Asana は
--    「〒100-6990東京都千代田区丸の内」で**番地が欠けていた**。
--    ブラウザからの `fetch` も CORS で塞がれる。
--    → **1社ずつ画面を辿って読むしかない。**
--
-- ⚠️ 実測すると **1社あたり3〜5回の操作**（サイトを開く → 会社概要のリンクを探す →
--    開く → 抽出）。URL を推測すると 404 を踏む（富士フイルムで2回踏んだ）。
--    69社を一度に埋めるのは現実的でないので、**上位から少しずつ**進める。
--
-- ── 出典（1社ずつ画面で確認した / 2026-08-28）──────────────────────────────
--   Twilio Japan合同会社
--     https://www.twilio.com/ja-jp/legal/tos
--     ★**自社の利用規約**に「〒151-0051 東京都渋谷区千駄ヶ谷 5-27-5
--       リンクスクエア新宿16階に事業所を有する日本法人であるTwilio Japan合同会社」
--       と明記。**法人名と住所が同じ文にある**ので取り違えの余地が無い
--   株式会社コンカー（英文表記：Concur Japan, Ltd.）
--     https://www.concur.co.jp/about
--     ★会社情報ページに「〒100-0004 東京都千代田区大手町1-2-1 三井物産ビル」。
--       同じページに西日本支社（大阪 梅田ダイビル）と名古屋営業所も記載
--
-- ⚠️ **「〒」と郵便番号は入れない。** 既存10社の書式に合わせる
--    （例: 「東京都江東区大島2-2-1」「東京都渋谷区桜丘町1-1 渋谷サクラステージ28F」）。
--
-- ⚠️★**`branch_locations` は触らない。** 最初 コンカーに ['大阪','名古屋'] を入れる
--    つもりだったが、**既に ['大阪','名古屋','福岡'] が入っていた**（適用前に実測）。
--    会社情報ページで見えたのが2件だっただけで、**上書きすると福岡が消えていた。**
--    → **既存の値がある列に「今見えたぶん」を書き込まない。**
--
-- ⚠️★**社名で UPDATE しようとして一度アサートに止められた。** 公式表記は
--    「株式会社コンカー」だが **DB の名前は「コンカー株式会社」**。
--    CLAUDE.md のとおり **id で明示列挙する。** 名前で引かない。
--
-- ── 表示先 ──────────────────────────────────────────────────────────────────
--   `headquarters_address` … 本文の「本社」カード。
--     ⚠️ 入れると**サイドバーの「所在地」行（いまは `location` の「東京都」）が消える**
--   `branch_locations`     … 本文の「その他の拠点」カード
--
-- ⚠️ 対象は id で明示列挙（CLAUDE.md「全社一括の UPDATE を禁止する」）。

do $$
declare v_tw text; v_cc text;
begin
  select headquarters_address into v_tw from public.ow_companies where id = '88defb4b-b18c-437b-8b7d-d41a43232af4';
  select headquarters_address into v_cc from public.ow_companies where id = '91523b3b-15e4-4f6b-8c9b-a90b67552b9e';
  if v_tw is not null then raise exception 'Twilio に既に住所がある（%）。中止', v_tw; end if;
  if v_cc is not null then raise exception 'コンカーに既に住所がある（%）。中止', v_cc; end if;
  raise notice '適用前: 2社とも headquarters_address は NULL';
end $$;

-- Twilio Japan合同会社
update public.ow_companies
   set headquarters_address = '東京都渋谷区千駄ヶ谷5-27-5 リンクスクエア新宿16階'
 where id = '88defb4b-b18c-437b-8b7d-d41a43232af4'
   and headquarters_address is null;

-- コンカー株式会社 ⚠️ branch_locations は触らない（既存の3件を消さない）
update public.ow_companies
   set headquarters_address = '東京都千代田区大手町1-2-1 三井物産ビル11-12階'
 where id = '91523b3b-15e4-4f6b-8c9b-a90b67552b9e'
   and headquarters_address is null;

do $$
declare v_tw text; v_cc text; v_br text[]; v_n int;
begin
  select headquarters_address into v_tw from public.ow_companies where id = '88defb4b-b18c-437b-8b7d-d41a43232af4';
  select headquarters_address, branch_locations into v_cc, v_br
    from public.ow_companies where id = '91523b3b-15e4-4f6b-8c9b-a90b67552b9e';
  if v_tw is null then raise exception 'Twilio に入っていない。中止'; end if;
  if v_cc is null then raise exception 'コンカーに入っていない。中止'; end if;

  -- ★既存の拠点3件を消していないこと
  if v_br is null or array_length(v_br,1) <> 3 then
    raise exception 'コンカーの拠点が3件でない（%）。中止', v_br;
  end if;

  /* ★他社を巻き込んでいないこと。⚠️ アサートは実測で書く（適用前 10社 → 12社） */
  select count(*) into v_n from public.ow_companies
   where is_published and listing_status='listed' and not coalesce(is_test,false)
     and headquarters_address is not null;
  if v_n <> 12 then raise exception '本社住所がある企業が % 社（12 のはず）。中止', v_n; end if;

  raise notice '完了: 本社住所がある企業 % 社（10 → 12）/ コンカーの拠点 % 件（不変）', v_n, array_length(v_br,1);
end $$;
