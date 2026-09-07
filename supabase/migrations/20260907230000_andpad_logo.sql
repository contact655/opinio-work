-- 建設テック: アンドパッドのロゴを入れる（2026-09-07 / 1社目）
--
-- ⚠️★**1社だけ先に入れて画面で確認するための migration**（2026-08-16 / 08-28 と同じ手順）。
--    残り2社（フォトラクション / ダンドリワーク）は確認後に別 migration で入れる。
--
-- 出典（2026-09-07 取得）:
--   https://andpad.co.jp/wp-content/themes/andpad-corp-theme/assets/dist/images/favicon/ms-favicon-310x310.png
--   実寸 310×310 PNG / 3,696 バイト / SHA-256 先頭16桁 7db1b1b1eeb97e47
--   赤い角丸正方形に白のシンボル。**シンボル単体で、ワードマークを含まない。**
--   同ディレクトリの logo.svg は 144×24（比 6.0）のワードマークなので**採らなかった**。
--
-- ⚠️ ファイルは **Storage に置いてから**この migration を当てる。
--    パスは既存78社と同じ `companies/logos/<company_id>/logo.<ext>`。
--    実体が PNG なので拡張子も `.png`（シスコの「.png なのに実体GIF」を増やさない）。
-- ⚠️★**URL に `?v=` を付けない。** `/admin` のアップロードUI（`uploadCompanyLogo`）は
--    付けるが、既存78件は1件も `?` を含まない（実測）。混在させると
--    「クエリを落としてから比較する」を忘れた人が孤児ファイルを数え損なう（CLAUDE.md ⑤）。
--    そのため**UIを使わず、Storage に直接置いて URL は migration で書いている。**
-- ⚠️ 企業サイトの画像を直リンクしない。Clearbit で踏んだ構造を作り直すことになる
--    （2026-08-16 に76社ぶん解消したばかり）。

begin;

do $$
declare
  v_url text; v_letter text; v_grad text; n_null_listed int; n_null_all int; n_listed int; n_q int;
begin
  select logo_url, logo_letter, logo_gradient into v_url, v_letter, v_grad
    from ow_companies where slug='andpad';
  if not found then raise exception 'slug=andpad が見つからない'; end if;
  /* ⚠️ 既に入っていたら止める。上書きしない。 */
  if v_url is not null then raise exception 'andpad の logo_url が既に入っている（%）', v_url; end if;
  if v_letter is not null or v_grad is not null then
    raise exception 'andpad の letter/gradient が明示設定されている（PKSHA と同じ意図的な代替かもしれない）';
  end if;

  /* ⚠️★全件と掲載中の**両方**で数える。2026-08-29 に掲載中の数だけで書いて
        全件と食い違い中止した前例がある（母集合を書く）。 */
  select count(*) into n_null_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false and logo_url is null;
  select count(*) into n_null_all from ow_companies where logo_url is null;
  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_q from ow_companies where logo_url like '%?%';

  if n_null_listed <> 5 then raise exception 'logo_url が NULL の掲載企業が % 社（期待 5）', n_null_listed; end if;
  if n_null_all <> 25 then raise exception 'logo_url が NULL の企業が 全件 % 社（期待 25）', n_null_all; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_q <> 0 then raise exception 'logo_url に ? を含むものが % 件ある（期待 0）', n_q; end if;

  raise notice '事前アサート OK: NULL 掲載中%社 / 全件%社 / 掲載中%社 / ?付き0件', n_null_listed, n_null_all, n_listed;
end $$;

-- 旧値: andpad の logo_url = NULL（logo_letter / logo_gradient も NULL）
update ow_companies
   set logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/b1d7996c-d260-4025-b495-bd1e2b9bb795/logo.png'
 where slug = 'andpad';

do $$
declare v_url text; n_null_listed int; n_null_all int; n_q int; n_listed int;
begin
  select logo_url into v_url from ow_companies where slug='andpad';
  if v_url is null then raise exception 'andpad の logo_url が入っていない'; end if;
  if v_url not like '%/storage/v1/object/public/ow-uploads/companies/logos/%' then
    raise exception 'andpad の logo_url が Storage を指していない: %', v_url;
  end if;
  if v_url like '%?%' then raise exception 'andpad の logo_url に ? が入っている: %', v_url; end if;

  select count(*) into n_null_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false and logo_url is null;
  select count(*) into n_null_all from ow_companies where logo_url is null;
  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_q from ow_companies where logo_url like '%?%';

  if n_null_listed <> 4 then raise exception 'NULL の掲載企業が % 社（期待 4）', n_null_listed; end if;
  if n_null_all <> 24 then raise exception 'NULL の企業が 全件 % 社（期待 24）', n_null_all; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_q <> 0 then raise exception '? 付きの logo_url が発生した'; end if;

  raise notice '事後アサート OK: andpad 投入 / NULL 掲載中%社・全件%社 / 掲載中%社', n_null_listed, n_null_all, n_listed;
end $$;

commit;
