-- 建設テック: フォトラクション / ダンドリワークのロゴを入れる（2026-09-07 / 2社目・3社目）
--
-- `20260907230000` でアンドパッド1社を先に入れ、**画面で letter より良いことを確認してから**
-- 残り2社を入れる（2026-08-16 / 08-28 と同じ手順）。
--
-- 出典（2026-09-07 取得）:
--   photoruction  https://photoruction.com/favicon.ico
--       ⚠️ **製品サイト由来。** 企業サイト（corporate.photoruction.com）が宣言している
--          icon / apple-touch-icon は **16×16 の1枚だけ**で、`CompanyLogo` の
--          `naturalWidth <= 16` に当たって letter に落ちるため使えない。
--          製品サイトの favicon.ico はフレーム 64/32/24/16 を持ち、**マークは16×16版と同一**。
--       ICO の**最大フレーム 64×64 を明示指定**して PNG に変換（既定に任せると16pxを掴む）。
--       変換後 64×64 PNG / 2,209 バイト。水色の輪郭のシンボル単体・背景は透過。
--   dandori-work  https://dandori-work.co.jp/assets/img/common/favicon.ico
--       ⚠️ サイトが宣言している apple-touch-icon（152×152）は **404**（HTMLが返る）。
--          `/assets/img/common/` の定番名9パターンも全滅で、**これが唯一の候補**。
--       ICO のフレームは 16/24/32/**48**。最大の 48×48 を明示指定して PNG に変換。
--       変換後 48×48 PNG / 1,660 バイト。多色ストライプのシンボル単体・背景は透過。
--
-- ── 倍率（68px枠の画像領域は padding 7px を引いた 54px）────────────────────
--   photoruction  64 → 54  … 縮小 ×0.84
--   dandori-work  48 → 54  … **拡大 ×1.12**
--   ⚠️ 拡大になるのはダンドリワークだけ。2026-08-29 に採用したフライル（36px・×1.5）より
--      緩いので許容と判断した。**より大きい原本が手に入ったら差し替えること。**
--
-- ⚠️ 拡張子は実体に合わせて `.png`（ICO のまま置かない）。
--    シスコの「.png なのに実体GIF」を増やさない。
-- ⚠️ URL に `?v=` を付けない（既存78件は1件も `?` を含まない）。だから `/admin` の
--    アップロードUIを使わず、Storage に直接置いて URL は migration で書いている。
--
-- ⚠️ **スパイダープラスは入れない。** robots.txt が自動アクセスを拒否しているため
--    機械で取りに行っていない。手動で用意して後日1本追加する。
-- ⚠️ **PKSHA も入れない。** logo_letter / logo_gradient が明示設定されており、
--    **意図的な letter フォールバック**（2026-08-29 の判断）。

begin;

do $$
declare
  r record; n_null_listed int; n_null_all int; n_listed int; n_q int;
begin
  for r in select * from (values ('photoruction'),('dandori-work')) as t(slug) loop
    if (select logo_url from ow_companies where slug=r.slug) is not null then
      raise exception '% の logo_url が既に入っている', r.slug;
    end if;
    if (select logo_letter from ow_companies where slug=r.slug) is not null
       or (select logo_gradient from ow_companies where slug=r.slug) is not null then
      raise exception '% の letter/gradient が明示設定されている（意図的な代替かもしれない）', r.slug;
    end if;
  end loop;

  /* ⚠️★全件と掲載中の両方。アンドパッド投入後なので 4 / 24 が正。 */
  select count(*) into n_null_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false and logo_url is null;
  select count(*) into n_null_all from ow_companies where logo_url is null;
  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_q from ow_companies where logo_url like '%?%';

  if n_null_listed <> 4 then raise exception 'NULL の掲載企業が % 社（期待 4）', n_null_listed; end if;
  if n_null_all <> 24 then raise exception 'NULL の企業が 全件 % 社（期待 24）', n_null_all; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_q <> 0 then raise exception '? 付きの logo_url が % 件ある', n_q; end if;

  raise notice '事前アサート OK: NULL 掲載中%社 / 全件%社', n_null_listed, n_null_all;
end $$;

-- 旧値: photoruction の logo_url = NULL（logo_letter / logo_gradient も NULL）
update ow_companies
   set logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/d71a7da6-a769-456e-99ab-a077d89a0d43/logo.png'
 where slug = 'photoruction';

-- 旧値: dandori-work の logo_url = NULL（logo_letter / logo_gradient も NULL）
update ow_companies
   set logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/78560eee-1a82-44b8-b9f6-d9c88fb60f4b/logo.png'
 where slug = 'dandori-work';

do $$
declare
  r record; n_null_listed int; n_null_all int; n_listed int; n_q int; rest text;
begin
  for r in select * from (values ('photoruction'),('dandori-work')) as t(slug) loop
    if (select logo_url from ow_companies where slug=r.slug) is null then
      raise exception '% の logo_url が入っていない', r.slug;
    end if;
    if (select logo_url from ow_companies where slug=r.slug)
       not like '%/storage/v1/object/public/ow-uploads/companies/logos/%' then
      raise exception '% の logo_url が Storage を指していない', r.slug;
    end if;
    if (select logo_url from ow_companies where slug=r.slug) like '%?%' then
      raise exception '% の logo_url に ? が入っている', r.slug;
    end if;
  end loop;

  select count(*) into n_null_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false and logo_url is null;
  select count(*) into n_null_all from ow_companies where logo_url is null;
  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_q from ow_companies where logo_url like '%?%';
  select string_agg(slug,' / ' order by slug) into rest from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false and logo_url is null;

  /* ⚠️ 残るのは spiderplus（robots.txt）と pksha（意図的な letter）の2社だけ。 */
  if n_null_listed <> 2 then raise exception 'NULL の掲載企業が % 社（期待 2）: %', n_null_listed, rest; end if;
  if rest is distinct from 'pksha / spiderplus' then
    raise exception '残った2社が想定と違う: %（期待 pksha / spiderplus）', rest;
  end if;
  if n_null_all <> 22 then raise exception 'NULL の企業が 全件 % 社（期待 22）', n_null_all; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_q <> 0 then raise exception '? 付きの logo_url が発生した'; end if;

  raise notice '事後アサート OK: 残り NULL は掲載中%社（%）/ 全件%社 / 掲載中%社',
    n_null_listed, rest, n_null_all, n_listed;
end $$;

commit;
