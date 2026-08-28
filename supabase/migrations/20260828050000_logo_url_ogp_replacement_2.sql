-- OGP画像だったロゴを差し替える・第2バッチ（2026-08-28）
--
-- 第1バッチは `20260828040000_logo_url_ogp_replacement.sql`（7社）。
-- 画像は先に Storage へ入れてある（`scripts/upload-logos-20260828b.mjs`）。
-- ⚠️ **この migration は URL を書くだけ。** 順序を入れ替えないこと。
--
-- ── 何が変わったか ──────────────────────────────────────────────────────────
-- 差し替えたのは4社:
--   Databricks 512x512 / タイミー 180x180 / キリバ 156x156 / Zendesk 152x152
--
-- ⚠️ **URL を書き換えるのはキリバの1社だけ。** 他3社は元から `logo.png` を
--    指しており、同じキーへの upsert なので URL は変わらない。
--    キリバは **`logo.webp`** を指していた（掲載77社の内訳: png 67 / jpg 7 /
--    webp ほか 3）。第1バッチで `logo.jpg` の2社を踏んだのと同じ形。
--
-- ⚠️ **確認は DB の `logo_url` を実際に取得して測る**こと。Storage のキーを
--    組み立てて測ると、DB が別の名前を指していても気づけない。
--
-- ── 第1バッチで見つからなかったものを見つけた方法 ──────────────────────────
--   ① **Web App Manifest を見た**（192/512px のアイコンが載る）
--   ② **node の fetch で取り直した**。Python の urllib が 403 / TLS エラーで
--      落ちていた Databricks / タイミーが node では通った。
--      ⚠️ 「取得できない」を「アセットが無い」と結論しないこと。
--   ③ ICO はローカルで PNG に変換（キリバ。`scripts/assets/logos-20260828b/`）
--
-- ── ★しきい値を 180px → 150px に下げた ────────────────────────────────────
-- `CompanyLogo` の最大表示は **96px**（実測。`size={96}` が1箇所）。padding が
-- `px * 0.1` なので画像領域は約77px、**2x DPI で必要なのは約154px**。
-- したがって 150px あれば最大表示でも 2x を満たす。
-- ⚠️ 比較対象は 1280x640 の OGP バナーで、**あれはどのサイズでも判読できない**。
-- ⚠️ **150px 未満は引き続き採らない**: Concur(96) / MongoDB(64) / Okta(57) /
--    Braze(48) / Salesforce(32) / Workday(32) / Translead(32) / Cisco(16)。
--
-- ── ★★目視で2件を落とした ────────────────────────────────────────────────
-- ⚠️ **クアルコム**: 512x512 が取れたが、URL が
--    `.../clientlib-react/resources/logo512.png` で**中身は React のロゴ**
--    （Create React App の既定画像）だった。**他社のロゴを載せるところだった。**
-- ⚠️ **ミラクル**: SVG しか無く、512px にラスタライズしたら**ほぼ空白**になった。
-- → **寸法と形式が通っても、必ず目で見ること。** 機械判定だけでは防げない。
--
-- ⚠️ シンカは**公式サイトがメンテナンス中**で取得できず（2026-08-28）。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-0233-ow_companies.sql
--   ⚠️ 画像は上書き済みなので、DB を戻しても3社は元に戻らない。
--
-- ⚠️ 対象は id で明示列挙（CLAUDE.md「全社一括の UPDATE を禁止する」）。

do $$
declare v_k text;
begin
  select logo_url into v_k from public.ow_companies where id = 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df';
  if v_k not like '%/logo.webp' then raise exception 'キリバが .webp を指していない（%）。中止', v_k; end if;
  raise notice '適用前: キリバは logo.webp を指している';
end $$;

update public.ow_companies
   set logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/a1a7036b-a5c4-4328-b5db-96ac1d5e29df/logo.png'
 where id = 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df'
   and logo_url like '%/logo.webp';   -- ⚠️ 既に .png なら触らない

do $$
declare v_k text; v_png int; v_null int;
begin
  select logo_url into v_k from public.ow_companies where id = 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df';
  if v_k not like '%/logo.png' then raise exception 'キリバが .png になっていない（%）。中止', v_k; end if;

  /* ★他社を巻き込んでいないこと（png は 69 → 70 に増えるだけ）
     ⚠️ 最初 68 と書いてアサートに止められた。**第1バッチで jpg→png にした2社を
        数え忘れていた**（適用直前の実測は png 69 / jpg 7 / webp 1 / NULL 2）。
        CLAUDE.md「アサートは実測で書くこと」。 */
  select count(*) into v_png from public.ow_companies
   where is_published and listing_status='listed' and not coalesce(is_test,false)
     and logo_url like '%/logo.png';
  if v_png <> 70 then raise exception 'logo.png の企業が % 社（70 のはず）。中止', v_png; end if;

  select count(*) into v_null from public.ow_companies
   where is_published and listing_status='listed' and not coalesce(is_test,false)
     and logo_url is null;
  if v_null <> 2 then raise exception 'logo_url が空の企業が % 社（2 のはず）。中止', v_null; end if;

  raise notice '完了: キリバを .png へ / logo.png % 社 / logo_url 空 % 社', v_png, v_null;
end $$;
