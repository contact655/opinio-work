-- 掲載中2社のロゴを Storage の実物に差し替える（2026-08-25）
--
-- ── 背景 ────────────────────────────────────────────────────────────────────
-- `logo_url` が空の企業は `CompanyLogo` のフォールバックで
-- 「`url` のドメイン → Google favicon」に落ちる。**実寸は32px**しか返らないため、
-- 40〜68px の枠で引き伸ばされて粗い。Storage に実物を持つ75社との差が見えていた。
--
-- ⚠️ 画像は先に Storage へ入れてある（`scripts/upload-logos-20260825.mjs`）。
--    ⚠️ **この migration は URL を書くだけ。** ファイルが無い状態で当てると
--       壊れた URL になるので、順序を入れ替えないこと。
--
-- ── 出典（1社ずつ確認した / 2026-08-25）──────────────────────────────────
--   伊藤忠テクノソリューションズ  https://www.ctc-g.co.jp/apple-touch-icon.png   180x180
--   富士フイルムビジネスイノベーション
--     https://www.fujifilm.com/fb/themes/custom/fujifilm_com_g2/apple-touch-icon-precomposed.png  256x256
--   どちらも実際に画像を開いて**自社ロゴであること**を目で確認している。
--
-- ⚠️ **見送った2社**（推測で代用しない）:
--     フライル          公式の apple-touch-icon が 36x36 → いまの32pxと実質同じ
--     PKSHA Technology  favicon.ico に 32x32 が1つだけ → 同上
--   ⚠️ Wikimedia には4社とも使えるロゴが無い（富士フイルムはプリンタ・建物の写真のみ）。
--
-- ⚠️ 対象は id で明示列挙（CLAUDE.md「全社一括の UPDATE を禁止する」）。

update public.ow_companies
   set logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/138ff010-8671-414a-ab06-752d61f50dd7/logo.png'
 where id = '138ff010-8671-414a-ab06-752d61f50dd7'
   and logo_url is null;   -- ⚠️ 既に入っていたら触らない

update public.ow_companies
   set logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/b8b7a2d4-20a8-4fe1-8651-61a6503f762e/logo.png'
 where id = 'b8b7a2d4-20a8-4fe1-8651-61a6503f762e'
   and logo_url is null;

-- ── 適用後の実測 ───────────────────────────────────────────────────────────
do $$
declare v_null int; v_clearbit int;
begin
  if (select logo_url from public.ow_companies where id='138ff010-8671-414a-ab06-752d61f50dd7') is null then
    raise exception 'CTC の logo_url が入っていない';
  end if;
  if (select logo_url from public.ow_companies where id='b8b7a2d4-20a8-4fe1-8651-61a6503f762e') is null then
    raise exception '富士フイルムの logo_url が入っていない';
  end if;
  select count(*) into v_clearbit from public.ow_companies where logo_url like '%clearbit%';
  if v_clearbit <> 0 then raise exception 'clearbit を指す行が % 件ある', v_clearbit; end if;
  select count(*) into v_null from public.ow_companies where logo_url is null;
  raise notice 'logo_url が空の企業: % 社（favicon か頭文字で表示される）', v_null;
end $$;
