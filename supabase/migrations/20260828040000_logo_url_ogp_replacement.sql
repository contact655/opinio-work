-- OGP画像だったロゴを差し替える（2026-08-28）
--
-- ── 背景 ────────────────────────────────────────────────────────────────────
-- 掲載79社のうち **22社（28.6%）のロゴが縦横比 1.91:1** ——1200x628 / 1024x537 /
-- 2400x1260 など、**OGP画像の規格**だった（2026-08-28 実測）。各社サイトから
-- 取得した OGP バナーであってロゴではなく、マーケティング文言や背景色が
-- 焼き込まれている。68px の正方形枠に contain で収めると高さ17px程度になり、
-- **ワードマークが判読できない**。
--
-- 画像は先に Storage へ入れてある（`scripts/upload-logos-20260828.mjs`）。
-- ⚠️ **この migration は URL を書くだけ。** 順序を入れ替えないこと。
--
-- ── ★なぜ2社だけ UPDATE するのか ──────────────────────────────────────────
-- 差し替えたのは**7社**だが、スクリプトは全社を `companies/logos/{id}/logo.png`
-- に上げる。**5社は元から `logo.png` を指しているので URL は変わらない**
-- （同じキーへの upsert で中身だけ入れ替わる）。
--
-- ⚠️ 残る2社は **DB が `logo.jpg` を指していた**ため、上げただけでは参照されず
--    古い画像が出続けた（2026-08-28 に実際に踏んだ）。ここで URL を向け直す。
--
-- ⚠️ **掲載77社中9社が `logo.jpg`・1社が別名**。今後ロゴを差し替えるときは、
--    Storage のキーを組み立てて確認するのではなく、**DB の `logo_url` を実際に
--    取得して寸法を測る**こと。組み立てて測ると食い違いに気づけない。
--
-- ── 出典（1社ずつ公式サイトから取得し、目視で自社ロゴを確認）───────────────
--   アンソロピックジャパン  https://cdn.prod.website-files.com/.../67d31dd7aa394792257596c5_webclip.png  256x256
--   ゼットスケーラー        https://www.zscaler.com/favicons/apple-touch-icon.png                        180x180
--   （URL が変わらない5社: Notion 512 / Snowflake 180 / Elastic 180 /
--     PagerDuty 180 / irodas 640。いずれも公式の apple-touch-icon）
--
-- ⚠️ **180px 未満は採らなかった。** Okta(57) / Braze(48) / MongoDB(64) /
--    Concur(96) / Zendesk(152) / Kyriba(156) は 68px 枠に対して改善幅が小さい。
--    2026-08-25 に 36px を見送ったのと同じ基準。
-- ⚠️ Salesforce / Cisco / Qualcomm / Workday / Translead は**公式が 16〜32px の
--    favicon しか公開していない**。Databricks / Mirakl / シンカ / タイミーは
--    サイトが 403 / 503 / TLS エラーで取得できなかった。
--    **推測で別の画像を当てない。** OGP画像のままのほうが「違うロゴ」よりまし。
--
-- ⚠️ 古い `logo.jpg` は Storage に残る（孤児になる）。**ここでは消さない。**
--    docs/todo.md「ow-uploads の孤児ファイル」の対象として別途まとめて扱う。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-0233-ow_companies.sql（スキーマ+データ / 87行）
--   ⚠️ 画像そのものは上書き済みなので、DB を戻しても5社は元に戻らない。
--
-- ⚠️ 対象は id で明示列挙（CLAUDE.md「全社一括の UPDATE を禁止する」）。

-- ── 適用前の確認 ────────────────────────────────────────────────────────────
do $$
declare v_a text; v_z text;
begin
  select logo_url into v_a from public.ow_companies where id = 'f32e6905-f25f-4c01-b64f-c5695fd45a1d';
  select logo_url into v_z from public.ow_companies where id = 'dd76b17d-e3c1-44a9-b747-4ecde10b8cec';
  if v_a not like '%/logo.jpg' then raise exception 'アンソロピックが .jpg を指していない（%）。中止', v_a; end if;
  if v_z not like '%/logo.jpg' then raise exception 'ゼットスケーラーが .jpg を指していない（%）。中止', v_z; end if;
  raise notice '適用前: 2社とも logo.jpg を指している';
end $$;

update public.ow_companies
   set logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/f32e6905-f25f-4c01-b64f-c5695fd45a1d/logo.png'
 where id = 'f32e6905-f25f-4c01-b64f-c5695fd45a1d'
   and logo_url like '%/logo.jpg';   -- ⚠️ 既に .png なら触らない

update public.ow_companies
   set logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/dd76b17d-e3c1-44a9-b747-4ecde10b8cec/logo.png'
 where id = 'dd76b17d-e3c1-44a9-b747-4ecde10b8cec'
   and logo_url like '%/logo.jpg';

-- ── 適用後の検証。★「エラーが出なかった」を成功にしない ──────────────────
do $$
declare v_jpg int; v_null int; v_a text; v_z text;
begin
  select logo_url into v_a from public.ow_companies where id = 'f32e6905-f25f-4c01-b64f-c5695fd45a1d';
  select logo_url into v_z from public.ow_companies where id = 'dd76b17d-e3c1-44a9-b747-4ecde10b8cec';
  if v_a not like '%/logo.png' then raise exception 'アンソロピックが .png になっていない（%）。中止', v_a; end if;
  if v_z not like '%/logo.png' then raise exception 'ゼットスケーラーが .png になっていない（%）。中止', v_z; end if;

  -- ★他社を巻き込んでいないこと（.jpg は 9 → 7 に減るだけ）
  select count(*) into v_jpg from public.ow_companies
   where is_published and listing_status='listed' and not coalesce(is_test,false)
     and logo_url like '%/logo.jpg';
  if v_jpg <> 7 then raise exception 'logo.jpg の企業が % 社（7 のはず）。中止', v_jpg; end if;

  select count(*) into v_null from public.ow_companies
   where is_published and listing_status='listed' and not coalesce(is_test,false)
     and logo_url is null;
  if v_null <> 2 then raise exception 'logo_url が空の企業が % 社（2 のはず）。中止', v_null; end if;

  raise notice '完了: 2社を .png へ / 残る logo.jpg % 社 / logo_url 空 % 社', v_jpg, v_null;
end $$;
