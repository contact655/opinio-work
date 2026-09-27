-- ★マルケトの説明文を、消えた法人を現役として説明したままの状態から直す（2026-09-28 / 柴さんの指示）
--
-- `20260927235000` で掲載から外したが、**本文は触っていなかった。**
-- ページ自体は `is_published = true` で生きている（200 / noindex）ので、
-- 職歴やブックマークから到達した人には**いまも表示される。**
--
-- ── 何が事実と違っていたか ──────────────────────────────────────────────────
--
--   旧: 「…2018年にAdobeが買収後も**独自ブランドで展開を継続中**。」
--
-- 継続しているのは**製品ブランド**（Adobe Marketo Engage）であって、
-- **日本法人は2020-02-14に登記記録が閉鎖されている**（国税庁法人番号公表サイト /
-- 法人番号 1010401108745 / 事由: 登記記録の閉鎖等（清算の結了等））。
--
-- ⚠️★**「2018年にAdobeが買収」は書き直しでは使わない。**
--    このセッションで一次情報の裏を取れなかったため
--    （`business.adobe.com/jp/products/marketo.html` を実際に開いたが、
--     買収にも 2018 にも言及が無い。`news.adobe.com` の個別記事URLは
--     ニュース一覧へ転送された）。**確かめていない年を書かない。**
--    ⚠️ 買収が無かったと判断したのではない。**裏を取れていないだけ。**
--       一次情報が見つかった日に足せばよい。
--
-- ⚠️ 「パイオニア」も落とした。2026-08-13 に description から評価語を除いた方針
--    （「世界最高評価ユニコーン企業のひとつ」等）と同じ。
--
-- ⚠️ description は markdown で描画される（2026-08-26〜）。段落は**空行区切り**。
--    太字は使っていない（日本語で `**` が約物と隣り合うと生のまま出るため）。
--
-- ── あわせて直す2つ ────────────────────────────────────────────────────────
--
-- ① `employee_count` = '約300名' を **NULL にする**
--    閉鎖前の数字で、**存在しない法人の現在の従業員数は測れない。**
--    「値が無い → 項目ごと非表示」（データ表示の原則）に倒す。
--    ⚠️ 旧値はこのコメントと作業前ダンプに残してある（戻せる）。
--    ⚠️★**「出典が無いから消す」ではない**（Sansan の京都拠点を誤って落とした件とは別）。
--       **対象の法人が存在しない**ことを一次情報で確かめたうえでの判断。
--
-- ② `name` を登記の商号に合わせる（マルケト株式会社 → **株式会社マルケト**）
--    ⚠️ `20260927235500` で他5社に当てたのと同じ訂正。マルケトだけ外れていたのは
--       同じ日に非掲載にしたため。**本文が登記の商号に言及するので、
--       ページ内で2つの商号が並ぶのを避ける。**
--    ⚠️ `normalize_company_name` は法人格を落とすので **normalized_name は
--       'マルケト' のまま変わらない**（衝突なし）。表示名も `name_en`（Marketo Japan）
--       由来なので変わらない。
--
-- ⚠️ `tagline`（見込み客の育成と商談化を自動で進める）は**触っていない**。
--    製品の説明として誤りではない。
-- ⚠️ `parent_company_name = 'Adobe Inc.'` / `founded_year = 2013` も触っていない。
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-2347-ow_companies.sql（214,721 バイト / 106行）
-- ⚠️★対象を id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 同じ列を触った直近の migration を確認した: `20260813071000_rewrite_company_descriptions_9.sql`
--    の9社にマルケトは**含まれていない**。打ち消しにはならない。

do $$
declare
  n bigint;
begin
  select count(*) into n from public.ow_companies
   where id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5'
     and name = 'マルケト株式会社'
     and employee_count = '約300名'
     and description like '%独自ブランドで展開を継続中%'
     and listing_status = 'draft';
  -- ⚠️ 想定と違えば中止する（別セッションが先に直していた場合など）
  if n <> 1 then
    raise exception 'マルケトが想定の状態で見つからない（%件）。中止する', n;
  end if;
end $$;

update public.ow_companies
   set name = '株式会社マルケト',
       employee_count = null,
       description =
         'マーケティングオートメーション（MA）の製品「Adobe Marketo Engage」（旧Marketo）を提供していた日本法人。'
         || 'リードナーチャリング・スコアリング・メールマーケティング・ABMを統合する。'
         || E'\n\n'
         || '日本法人は2020年2月14日に登記記録が閉鎖されている（事由は清算の結了等。'
         || '出典は国税庁法人番号公表サイト、法人番号 1010401108745）。'
         || '製品はアドビが「Adobe Marketo Engage」として提供を続けている。'
 where id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5';

-- ⚠️ 検算。**件数では足りない**ので中身まで見る（ui-debugging ⑱）。
do $$
declare
  r record;
begin
  select name, description, employee_count, normalized_name, listing_status, is_published
    into r from public.ow_companies where id = 'e4d317d3-48b9-4718-ae3e-8d27147d05f5';

  -- ★事実と違っていた一文が消えていること（否定形の確認）
  if r.description like '%独自ブランドで展開を継続中%' then
    raise exception '「独自ブランドで展開を継続中」が残っている';
  end if;
  if r.description like '%2018%' then
    raise exception '裏を取れていない「2018」が残っている';
  end if;
  -- ★入っているべきものが入っていること（肯定形の確認。両方やる）
  if r.description not like '%登記記録が閉鎖されている%' then
    raise exception '閉鎖の事実が本文に入っていない';
  end if;
  -- ★markdown の段落（空行区切り）になっていること
  if position(E'\n\n' in r.description) = 0 then
    raise exception '段落が空行で区切られていない（markdown で1段落に潰れる）';
  end if;
  if r.employee_count is not null then
    raise exception 'employee_count が NULL になっていない: %', r.employee_count;
  end if;
  if r.name <> '株式会社マルケト' then
    raise exception '社名が想定と違う: %', r.name;
  end if;
  -- ★法人格の位置を変えても normalized_name は変わらないはず
  if r.normalized_name <> 'マルケト' then
    raise exception 'normalized_name が変わってしまった: %', r.normalized_name;
  end if;
  -- ★掲載状態は動かしていないこと（前の migration の結果を壊さない）
  if r.listing_status <> 'draft' or r.is_published is not true then
    raise exception '掲載状態が動いた: listing_status=% / is_published=%', r.listing_status, r.is_published;
  end if;
  raise notice 'OK: % / employee_count=% / normalized=%', r.name, r.employee_count, r.normalized_name;
end $$;
