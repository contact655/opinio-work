-- 事業領域の宿題2件（2026-09-07 / 柴さんの判断）。`20260907030000` の続き。
--
--   ① 株式会社ワークデイ に 基幹業務システム（erp）を**従として追加**
--      HR・人材（主）はそのまま。人事と財務の両方をやっているため。
--      **複数値の器があるのに1つしか入っていない状態を直す。**
--   ② 法務・契約（legal）を新設し、DocuSign Japan を 経理・財務 → 法務・契約 へ
--      電子署名は法務部門の道具で、経理・財務（コンカー / BlackLine 等）とは
--      **買い手の部門が違う。**
--
-- ⚠️★**これは本テーブルで初めての「従」の行になる**（2026-09-07 実測）。
--    `20260907030000` で業種特化の明細を消した結果、**87行すべてが is_primary = true**
--    になっていた（display_order 0 が79行 / 1 が8行、いずれも主）。
--    つまり「複数値を持つ企業」が実データに1社も無い状態で、ワークデイが最初の1社になる。
--
-- ⚠️ 上限は `MAX_BUSINESS_DOMAINS_PER_COMPANY = 3`（lib/companies/businessDomains.ts）。
--    ワークデイは追加後2件なので抵触しない。
--
-- ⚠️ ハードウェア・半導体は**引き続き触らない**（停止条件A/B/C が解消していない。
--    理由は `20260907030000` の冒頭に全部書いてある）。
--
-- ── display_order を 10 に差し込み、以降を +1 ずらす理由 ─────────────────────
-- 既存14件は **1〜14 の連番で穴が無い**（実測）。末尾（15）に足すと
-- 法務・契約が **ハードウェア・半導体 / マーケットプレイス / 業種特化（廃止）より後ろ**に出る。
-- いまの並びは「技術領域 → 業務領域 → その他 → 廃止」で意味が付いているので、
-- 業務領域の並び（crm 5 … finance 9）の直後に入れる。
-- ⚠️ とくに **finance の隣**に置く —— この2つが今回いちばん紛らわしい組だから。
-- ⚠️ `display_order` に UNIQUE は無い（実測）ので、ずらす順序は問わない。
--    このテーブルは階層を持たないフラットなマスタなので、`ow_roles` / `ow_industries` の
--    「親ごとの相対順」とは別物。**通し番号でよい。**

begin;

-- ── 事前アサート ────────────────────────────────────────────────────────────
do $$
declare
  n_legal int;
  wd_rows int; wd_primary_slug text; wd_primary_order int;
  ds_rows int; ds_primary_slug text;
  e_all int; e_listed int;
  f_all int; f_listed int;
  h_all int; h_listed int;
  n_listed int;
  n_seq int;
begin
  select count(*) into n_legal from ow_business_domains where slug = 'legal';

  select count(*) into wd_rows from ow_company_business_domains l
    join ow_companies c on c.id = l.company_id where c.name = '株式会社ワークデイ';
  select d.slug, l.display_order into wd_primary_slug, wd_primary_order
    from ow_company_business_domains l
    join ow_business_domains d on d.id = l.domain_id
    join ow_companies c on c.id = l.company_id
   where c.name = '株式会社ワークデイ' and l.is_primary;

  select count(*) into ds_rows from ow_company_business_domains l
    join ow_companies c on c.id = l.company_id where c.name = 'DocuSign Japan株式会社';
  select d.slug into ds_primary_slug from ow_company_business_domains l
    join ow_business_domains d on d.id = l.domain_id
    join ow_companies c on c.id = l.company_id
   where c.name = 'DocuSign Japan株式会社' and l.is_primary;

  /* ⚠️★**全件と掲載中の両方で数える。** 前回、掲載中の数だけで assert を書いて
        中止しかけた。両者は is_test 2社 + draft 15社ぶんズレる。 */
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into e_all, e_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='erp';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into f_all, f_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='finance';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into h_all, h_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='hr';

  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;

  /* ⚠️ 差し込みの前提。1〜14 の連番でなければ、ずらし方を考え直す必要がある。 */
  select count(*) into n_seq from ow_business_domains where display_order between 1 and 14;

  if n_legal <> 0 then raise exception 'slug=legal が既に % 件ある（期待 0）', n_legal; end if;
  if wd_rows <> 1 then raise exception 'ワークデイの事業領域が % 行（期待 1）', wd_rows; end if;
  if wd_primary_slug is distinct from 'hr' then raise exception 'ワークデイの主が %（期待 hr）', wd_primary_slug; end if;
  if ds_rows <> 1 then raise exception 'DocuSign の事業領域が % 行（期待 1）', ds_rows; end if;
  if ds_primary_slug is distinct from 'finance' then raise exception 'DocuSign の主が %（期待 finance）', ds_primary_slug; end if;
  if e_all <> 3 or e_listed <> 3 then raise exception 'erp が 全件% / 掲載中%（期待 3 / 3）', e_all, e_listed; end if;
  if f_all <> 6 or f_listed <> 6 then raise exception 'finance が 全件% / 掲載中%（期待 6 / 6）', f_all, f_listed; end if;
  if h_all <> 7 or h_listed <> 6 then raise exception 'hr が 全件% / 掲載中%（期待 7 / 6）', h_all, h_listed; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_seq <> 14 then raise exception 'display_order が 1〜14 の連番でない（% 件）。差し込み方を見直すこと', n_seq; end if;

  raise notice '事前アサート OK: erp=%/% finance=%/% hr=%/% 掲載中=%社 / ワークデイの主の順=%',
    e_all, e_listed, f_all, f_listed, h_all, h_listed, n_listed, wd_primary_order;
end $$;

-- ── ② 法務・契約（legal）を新設 ─────────────────────────────────────────────
-- 旧値: そもそも行が無い（事前アサートで確認済み）
-- ⚠️ 先に既存を +1 ずらしてから差し込む。
--    旧 display_order: hr=10 / marketing=11 / hardware=12 / marketplace=13 / vertical=14
update ow_business_domains set display_order = display_order + 1 where display_order >= 10;

-- ⚠️ `description` を付けるのは**迷いやすい組だけ**（既存で入っているのは
--    project-management と erp の2件のみ。ow_industries の description と同じ流儀）。
--    法務・契約は経理・財務と紛らわしいので付ける。**書き方も既存2件に揃える**
--    ——「何を担うか。⚠ 紛らわしいものは「X」に入れる」の形。
insert into ow_business_domains (slug, name, display_order, is_active, description)
values (
  'legal',
  '法務・契約',
  10,
  true,
  '契約・法務の業務を担うツール（電子署名・契約書管理など）。'
  '⚠ 自社の経理・財務部門向けのツール（経費精算・決算自動化など）は「経理・財務」に入れる'
);

-- ── ③ DocuSign Japan を finance → legal に付け替え ──────────────────────────
-- ⚠️ **DELETE + INSERT ではなく UPDATE。** 主のフラグを落として立て直すと
--    `UNIQUE (company_id) WHERE is_primary` を踏む余地ができる。
-- 旧値: DocuSign Japan株式会社  finance（経理・財務）  is_primary=true  display_order=0
update ow_company_business_domains l
   set domain_id = (select id from ow_business_domains where slug = 'legal')
  from ow_companies c
 where c.id = l.company_id
   and c.name = 'DocuSign Japan株式会社'
   and l.domain_id = (select id from ow_business_domains where slug = 'finance');

-- ── ① ワークデイに erp を従として追加 ───────────────────────────────────────
-- 旧値: 株式会社ワークデイ  hr（HR・人材）  is_primary=true  display_order=0  ← 触らない
-- ⚠️ `is_primary = false`。主は hr のまま。
-- ⚠️ `display_order` は主の次（主が 0 なので 1）。解体前の実データも
--    「主 → その次の番号」で従を並べていた（Ubie: ai=1 / vertical=2）。
insert into ow_company_business_domains (company_id, domain_id, is_primary, display_order)
select c.id, d.id, false, 1
  from ow_companies c, ow_business_domains d
 where c.name = '株式会社ワークデイ' and d.slug = 'erp';

-- ── 事後アサート ────────────────────────────────────────────────────────────
do $$
declare
  n_legal int; legal_active boolean; legal_order int;
  l_all int; l_listed int;
  e_all int; e_listed int; e_primary int;
  f_all int; f_listed int;
  h_all int; h_listed int;
  wd_rows int; wd_primary int; wd_slugs text;
  ds_slug text;
  n_listed int;
  n_no_primary int; n_two_primary int;
begin
  select count(*) into n_legal from ow_business_domains where slug='legal';
  select is_active, display_order into legal_active, legal_order from ow_business_domains where slug='legal';

  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into l_all, l_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='legal';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false),
         count(*) filter (where l.is_primary)
    into e_all, e_listed, e_primary from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='erp';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into f_all, f_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='finance';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into h_all, h_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='hr';

  select count(*), count(*) filter (where l.is_primary),
         string_agg(d.slug || case when l.is_primary then '(主)' else '(従)' end, ' / ' order by l.display_order)
    into wd_rows, wd_primary, wd_slugs
    from ow_company_business_domains l join ow_business_domains d on d.id=l.domain_id
    join ow_companies c on c.id=l.company_id where c.name='株式会社ワークデイ';

  select d.slug into ds_slug from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id
   where c.name='DocuSign Japan株式会社';

  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_no_primary from ow_companies c
   where exists (select 1 from ow_company_business_domains l where l.company_id=c.id)
     and not exists (select 1 from ow_company_business_domains l where l.company_id=c.id and l.is_primary);
  select count(*) into n_two_primary from (
    select l.company_id from ow_company_business_domains l where l.is_primary
     group by l.company_id having count(*) > 1) x;

  if n_legal <> 1 then raise exception 'legal が % 行（期待 1）', n_legal; end if;
  if not legal_active then raise exception 'legal が is_active = false'; end if;
  if legal_order <> 10 then raise exception 'legal の display_order が %（期待 10）', legal_order; end if;
  if l_all <> 1 or l_listed <> 1 then raise exception 'legal が 全件% / 掲載中%（期待 1 / 1）', l_all, l_listed; end if;
  if ds_slug is distinct from 'legal' then raise exception 'DocuSign が % のまま（期待 legal）', ds_slug; end if;
  /* ⚠️ erp は**従が1件増える**ので 4 になるが、主は 3 のまま。 */
  if e_all <> 4 or e_listed <> 4 then raise exception 'erp が 全件% / 掲載中%（期待 4 / 4）', e_all, e_listed; end if;
  if e_primary <> 3 then raise exception 'erp を主にしている企業が % 社（期待 3）', e_primary; end if;
  if f_all <> 5 or f_listed <> 5 then raise exception 'finance が 全件% / 掲載中%（期待 5 / 5）', f_all, f_listed; end if;
  /* ⚠️ hr は触っていないので不変。 */
  if h_all <> 7 or h_listed <> 6 then raise exception 'hr が 全件% / 掲載中%（期待 7 / 6・不変のはず）', h_all, h_listed; end if;
  if wd_rows <> 2 or wd_primary <> 1 then raise exception 'ワークデイが % 行 / 主 % 件（期待 2 / 1）: %', wd_rows, wd_primary, wd_slugs; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_no_primary <> 0 then raise exception '主が無い企業が % 社（期待 0）', n_no_primary; end if;
  if n_two_primary <> 0 then raise exception '主が2件以上ある企業が % 社（期待 0）', n_two_primary; end if;

  raise notice '事後アサート OK: legal=%/% erp=%/%(主%) finance=%/% hr=%/%(不変) ワークデイ=% 掲載中=%社',
    l_all, l_listed, e_all, e_listed, e_primary, f_all, f_listed, h_all, h_listed, wd_slugs, n_listed;
end $$;

commit;
