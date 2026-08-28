-- セールスフォース・ジャパンのロゴを Wikimedia の公式ロゴに差し替える（2026-08-28）
--
-- 第1バッチ `20260828040000` / 第2バッチ `20260828050000` の続き。
-- 画像は先に Storage へ入れてある（`scripts/upload-logos-20260828b.mjs`）。
--
-- ── なぜこの1社だけ別扱いか ────────────────────────────────────────────────
-- ロゴが OGP画像（1024x537・比1.91）のままだが、**唯一の公開求人がある企業**で
-- 優先度が高い。ところが公式サイトは **32x32 の favicon しか公開しておらず**、
-- ブランドページにも正方形アセットが無い（2026-08-28 にブラウザで実測）。
--
-- ── ★出典が公式サイトではなく Wikimedia Commons ────────────────────────────
--   https://commons.wikimedia.org/wiki/File:Salesforce.com_logo.svg  512x358 → 960x672 PNG
--
-- ⚠️ **ライセンスを確認して採った。Public domain**（単純な図形・文字なので
--    著作権の閾値を下回る扱い）。商標は残るが、**その企業を指すために使う**
--    用途なので問題にならない。
--
-- ⚠️★**Commons の検索結果をそのまま使わないこと。** 同じ検索で
--    「Cisco College」「インドネシアの都市の紋章」「ISS の写真」
--    「KDE のアイコンテーマ（Antu mongodb.svg）」が上位に出た。
--    **別会社や第三者の描き直しが混ざる。** ファイル名と中身を必ず確認する。
--    同日、公式サイトから取った 512x512 が**中身は React のロゴ**だった例もある。
--
-- ⚠️ 比 1.43 で**完全な正方形ではない**。それでも採ったのは、現行の 1.91 より
--    正方形の枠に収まり、背景が透過で他のカードと揃うため。
--    実際に 56 / 68 / 110px で並べて比べ、全サイズで明確に読みやすいことを確認した。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-0233-ow_companies.sql
--   ⚠️ 旧 `logo.jpg` は Storage に残るので、DB を戻せば元に戻せる（消していない）。
--
-- ⚠️ 対象は id で明示列挙（CLAUDE.md「全社一括の UPDATE を禁止する」）。

do $$
declare v text;
begin
  select logo_url into v from public.ow_companies where id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
  if v not like '%/logo.jpg' then raise exception 'セールスフォースが .jpg を指していない（%）。中止', v; end if;
  raise notice '適用前: セールスフォースは logo.jpg を指している';
end $$;

update public.ow_companies
   set logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/c3664ef1-5571-4645-b30f-1474e7961c17/logo.png'
 where id = 'c3664ef1-5571-4645-b30f-1474e7961c17'
   and logo_url like '%/logo.jpg';   -- ⚠️ 既に .png なら触らない

do $$
declare v text; v_png int; v_jpg int;
begin
  select logo_url into v from public.ow_companies where id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
  if v not like '%/logo.png' then raise exception '.png になっていない（%）。中止', v; end if;

  /* ★他社を巻き込んでいないこと。⚠️ **アサートは実測で書く**
     （2026-08-28 に想定値を間違えて一度止められた）。
     適用直前の実測: png 70 / jpg 7 → 適用後 png 71 / jpg 6 */
  select count(*) into v_png from public.ow_companies
   where is_published and listing_status='listed' and not coalesce(is_test,false)
     and logo_url like '%/logo.png';
  select count(*) into v_jpg from public.ow_companies
   where is_published and listing_status='listed' and not coalesce(is_test,false)
     and logo_url like '%/logo.jpg';
  if v_png <> 71 then raise exception 'logo.png が % 社（71 のはず）。中止', v_png; end if;
  if v_jpg <> 6  then raise exception 'logo.jpg が % 社（6 のはず）。中止', v_jpg; end if;

  raise notice '完了: セールスフォースを .png へ / png % 社 / jpg % 社', v_png, v_jpg;
end $$;
