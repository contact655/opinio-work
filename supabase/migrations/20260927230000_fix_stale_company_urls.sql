-- ★公式サイトの URL が古くなっていた2社を直す（2026-09-27 / 柴さんの指示）
--
-- どちらも**リンク切れではない**（転送は効いている）。直す理由は
-- **着地先が「その会社のサイト」でなくなっていた**こと。
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-2308-ow_companies.sql（214,693 バイト / 106行）
--
-- ── 実測（2026-09-27。すべて実際に開いて確かめた）──────────────────────────
--
-- ① ウォークミー株式会社
--    旧: https://www.walkme.com/ja/
--        → 転送で `/downloads/japanese-page/`（**ダウンロードのページ**）に着く
--    新: https://www.walkme.com/jp/
--        → **転送なしで日本語トップ**（`lang="ja-JP"` / title「WalkMe デジタル
--          アダプションプラットフォーム | 真のROIを実現するAI」）をブラウザで確認
--    ⚠️ `www.walkme.co.jp` も `/jp/` へ転送される。**転送先のほうを入れる。**
--
-- ② マルケト株式会社
--    旧: https://jp.marketo.com/
--        → 301 で Adobe へ。最終的に
--          `business.adobe.com/jp/products/marketo.html` に着く
--    新: https://business.adobe.com/jp/products/marketo.html
--        → **転送なしで 200**（title「Adobe Marketo Engage | マーケティング
--          オートメーションプラットフォーム | アドビ」）をブラウザで確認
--    ⚠️★**これは製品ページであって会社のサイトではない。** Marketo は Adobe に
--       吸収されており、`jp.marketo.com` の転送先がこのページしか無い。
--       **推測で `www.adobe.com/jp/` を入れることはしていない** ——
--       いま実際に着く先をそのまま記録する形にした。
--    ⚠️★**「マルケト株式会社という法人がまだ存在するか」は別の問題。**
--       この migration では触っていない。掲載を続けるかどうかは運営の判断。
--       ⚠️ `parent_company_name = 'Adobe Inc.'` は既に入っている。
--
-- ⚠️★**対象を id で明示列挙する**（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 同じ列を触った直近の migration を確認した: `20260810165357` 以降、
--    この2社の `url` を触ったものは無い（`updated_at` も 2026-08-10 のまま）。
--    打ち消しにはならない。

do $$
declare
  n_walkme bigint;
  n_marketo bigint;
begin
  select count(*) into n_walkme from public.ow_companies
   where id = 'e3eafa66-02ce-4060-a5fe-57e4317c8e7c' and url = 'https://www.walkme.com/ja/';
  select count(*) into n_marketo from public.ow_companies
   where id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5' and url = 'https://jp.marketo.com/';
  -- ⚠️ 想定と違えば中止する（別セッションが先に直していた場合など）
  if n_walkme <> 1 or n_marketo <> 1 then
    raise exception '想定した旧 URL が見つからない（walkme=% / marketo=%）。中止する', n_walkme, n_marketo;
  end if;
end $$;

update public.ow_companies
   set url = 'https://www.walkme.com/jp/'
 where id = 'e3eafa66-02ce-4060-a5fe-57e4317c8e7c';

update public.ow_companies
   set url = 'https://business.adobe.com/jp/products/marketo.html'
 where id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5';

-- ⚠️ 検算。入れ違い（2社の URL を取り違える）は**件数だけでは検出できない**ので、
--    id と値の組で確かめる（ui-debugging ⑱「集合が一致するだけでは足りない」）。
do $$
declare
  u_walkme text;
  u_marketo text;
begin
  select url into u_walkme from public.ow_companies where id = 'e3eafa66-02ce-4060-a5fe-57e4317c8e7c';
  select url into u_marketo from public.ow_companies where id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5';
  if u_walkme <> 'https://www.walkme.com/jp/' then
    raise exception 'ウォークミーの url が想定と違う: %', u_walkme;
  end if;
  if u_marketo <> 'https://business.adobe.com/jp/products/marketo.html' then
    raise exception 'マルケトの url が想定と違う: %', u_marketo;
  end if;
  raise notice 'walkme=% / marketo=%', u_walkme, u_marketo;
end $$;
