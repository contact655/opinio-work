-- 第1バッチ: 6社に2つ目の事業領域（従）を足す（2026-09-07 / 柴さんの承認済み）
--
-- `ow_company_business_domains` は複数値（上限3・主1つ）を持てる器なのに、
-- 2件持っているのは **ワークデイ1社だけ**だった。フェーズ0の調査で18社が挙がったうち、
-- **2件目のみ・上限に触れず・判断が割れない6社**を先に入れて、複数値が実データで効くことを確かめる。
--
--   アカマイ            security(主) + **infra**    「世界最大のCDN（コンテンツデリバリーネットワーク）運用企業」
--   クラウドフレア       security(主) + **infra**    「CDN・DDoS対策・…・Workers」
--   デル・テクノロジーズ  hardware(主) + **infra**    「PC・サーバー・ストレージ・ネットワーク機器」
--   レノボ・ジャパン     hardware(主) + **infra**    「PCに加えて、サーバー（ThinkSystem）・ストレージ」
--   New Relic         infra(主)    + **devtools** タグライン「すべてのエンジニアに、オブザーバビリティを。」
--   Datadog Japan     infra(主)    + **devtools** 製品「APM（アプリケーション性能監視）」
--
-- ⚠️ **主は1件も触らない。** 足すのは `is_primary = false` の行だけ。
--    カードのタグは主しか出さないので（`displayBusinessDomain`）、**一覧の見た目は変わらない。**
--    変わるのは**絞り込みとファセット**（どちらも全紐づけを見る）。
--
-- ⚠️★**企業の特定は `slug` で行う。名前で引かない。**
--    社名の表記が混在しており（カタカナ: アカマイ・テクノロジーズ合同会社 / クラウドフレア・ジャパン株式会社 /
--    デル・テクノロジーズ株式会社 / レノボ・ジャパン合同会社、**英字が正**: New Relic株式会社 / Datadog Japan株式会社）、
--    ilike の綴りで外す事故が起きやすい（2026-09-07 に DocuSign で踏んだ）。
--    `ow_companies.slug` は UNIQUE（実測で確認済み）。名前は事前アサートで突き合わせるだけにする。
--
-- ⚠️ **上限は `MAX_BUSINESS_DOMAINS_PER_COMPANY = 3`。** 6社とも追加後2件なので触れない。
--    ①の残り12社（セールスフォース / 日本マイクロソフト ほか）と②の16社は**このバッチに入れない**
--    ——セールスフォースは4件になり「どの3つを選ぶか」の判断が要るため。
--
-- ── display_order の付け方 ──────────────────────────────────────────────────
-- **主の次の番号にする。** 実測（2026-09-07）で唯一の前例であるワークデイが
--   `hr(主) ord=0 / erp(従) ord=1` だったので、それに揃える。
-- ⚠️ 定数 1 を直接書かず、**その企業の既存 ord の最大値 + 1** を計算する。
--    6社はいずれも ord=0 の1行だけなので結果は 1 になるが、
--    **前提が変わったときに黙って重複しない**ようにしておく。

begin;

-- ── 事前アサート ────────────────────────────────────────────────────────────
do $$
declare
  r record;
  expected constant text[][] := array[
    ['akamai',     'アカマイ・テクノロジーズ合同会社',   'security'],
    ['cloudflare', 'クラウドフレア・ジャパン株式会社',   'security'],
    ['dell',       'デル・テクノロジーズ株式会社',       'hardware'],
    ['lenovo',     'レノボ・ジャパン合同会社',           'hardware'],
    ['new-relic',  'New Relic株式会社',                 'infra'],
    ['datadog',    'Datadog Japan株式会社',             'infra']
  ];
  i int;
  n_rows int; n_primary int; cur_slug text; cur_name text;
  i_all int; i_listed int; d_all int; d_listed int;
  s_all int; s_listed int; h_all int; h_listed int;
  n_listed int; n_no_primary int; n_two_primary int;
begin
  for i in 1 .. array_length(expected, 1) loop
    select count(*), count(*) filter (where l.is_primary),
           max(d.slug) filter (where l.is_primary), max(c.name)
      into n_rows, n_primary, cur_slug, cur_name
      from ow_companies c
      left join ow_company_business_domains l on l.company_id = c.id
      left join ow_business_domains d on d.id = l.domain_id
     where c.slug = expected[i][1];

    if cur_name is null then
      raise exception 'slug=% の企業が見つからない', expected[i][1];
    end if;
    /* ⚠️ 名前は「引く鍵」ではなく「照合」に使う。表記が変わっていたら止める。 */
    if cur_name is distinct from expected[i][2] then
      raise exception 'slug=% の社名が「%」（期待「%」）。表記が変わっている', expected[i][1], cur_name, expected[i][2];
    end if;
    if n_rows <> 1 then
      raise exception '% の事業領域が % 件（期待 1）。既に2件目がある可能性', expected[i][2], n_rows;
    end if;
    if n_primary <> 1 then
      raise exception '% の主が % 件（期待 1）', expected[i][2], n_primary;
    end if;
    if cur_slug is distinct from expected[i][3] then
      raise exception '% の主が %（期待 %）', expected[i][2], cur_slug, expected[i][3];
    end if;
  end loop;

  /* ⚠️★**全件と掲載中の両方で数える**（2026-09-07 に片方だけ書いて中止しかけた）。
        両者は is_test 2社 + draft 15社ぶんズレる。今回の6社はすべて掲載中なので
        どちらも同じだけ増えるが、**ズレていないこと自体を確かめる**意味がある。 */
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into i_all, i_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='infra';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into d_all, d_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='devtools';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into s_all, s_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='security';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into h_all, h_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='hardware';

  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_no_primary from ow_companies c
   where exists (select 1 from ow_company_business_domains l where l.company_id=c.id)
     and not exists (select 1 from ow_company_business_domains l where l.company_id=c.id and l.is_primary);
  select count(*) into n_two_primary from (
    select company_id from ow_company_business_domains where is_primary group by company_id having count(*)>1) x;

  if i_all <> 12 or i_listed <> 12 then raise exception 'infra が 全件% / 掲載中%（期待 12 / 12）', i_all, i_listed; end if;
  if d_all <> 2  or d_listed <> 2  then raise exception 'devtools が 全件% / 掲載中%（期待 2 / 2）', d_all, d_listed; end if;
  if s_all <> 8  or s_listed <> 8  then raise exception 'security が 全件% / 掲載中%（期待 8 / 8）', s_all, s_listed; end if;
  if h_all <> 7  or h_listed <> 7  then raise exception 'hardware が 全件% / 掲載中%（期待 7 / 7）', h_all, h_listed; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_no_primary <> 0 then raise exception '主が無い企業が % 社（期待 0）', n_no_primary; end if;
  if n_two_primary <> 0 then raise exception '主が2件以上の企業が % 社（期待 0）', n_two_primary; end if;

  raise notice '事前アサート OK: infra=%/% devtools=%/% security=%/% hardware=%/% 掲載中=%社',
    i_all, i_listed, d_all, d_listed, s_all, s_listed, h_all, h_listed, n_listed;
end $$;

-- ── 従（is_primary = false）を6行 INSERT ────────────────────────────────────
-- 旧値（2026-09-07 実測 / 6社とも1行だけ・すべて主・display_order = 0）:
--   akamai      security(主) ord=0     ← 触らない
--   cloudflare  security(主) ord=0     ← 触らない
--   dell        hardware(主) ord=0     ← 触らない
--   lenovo      hardware(主) ord=0     ← 触らない
--   new-relic   infra(主)    ord=0     ← 触らない
--   datadog     infra(主)    ord=0     ← 触らない
insert into ow_company_business_domains (company_id, domain_id, is_primary, display_order)
select c.id,
       d.id,
       false,
       /* 主の次の番号。ワークデイ（hr ord=0 / erp ord=1）に揃える。
          ⚠️ 定数ではなく既存の最大値+1で出す（前提が変わっても重複しない）。 */
       coalesce((select max(l2.display_order) from ow_company_business_domains l2
                  where l2.company_id = c.id), -1) + 1
  from (values
          ('akamai',     'infra'),
          ('cloudflare', 'infra'),
          ('dell',       'infra'),
          ('lenovo',     'infra'),
          ('new-relic',  'devtools'),
          ('datadog',    'devtools')
       ) as t(company_slug, domain_slug)
  join ow_companies c        on c.slug = t.company_slug
  join ow_business_domains d on d.slug = t.domain_slug;

-- ── 事後アサート ────────────────────────────────────────────────────────────
do $$
declare
  r record;
  slugs constant text[] := array['akamai','cloudflare','dell','lenovo','new-relic','datadog'];
  s text; n_rows int; n_primary int;
  i_all int; i_listed int; d_all int; d_listed int;
  s_all int; s_listed int; h_all int; h_listed int;
  n_listed int; n_no_primary int; n_two_primary int; n_over_cap int;
begin
  foreach s in array slugs loop
    select count(*), count(*) filter (where l.is_primary) into n_rows, n_primary
      from ow_companies c join ow_company_business_domains l on l.company_id = c.id
     where c.slug = s;
    if n_rows <> 2 then raise exception '% の事業領域が % 件（期待 2）', s, n_rows; end if;
    if n_primary <> 1 then raise exception '% の主が % 件（期待 1）', s, n_primary; end if;
  end loop;

  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into i_all, i_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='infra';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into d_all, d_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='devtools';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into s_all, s_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='security';
  select count(*), count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false)
    into h_all, h_listed from ow_company_business_domains l
    join ow_business_domains d on d.id=l.domain_id join ow_companies c on c.id=l.company_id where d.slug='hardware';

  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_no_primary from ow_companies c
   where exists (select 1 from ow_company_business_domains l where l.company_id=c.id)
     and not exists (select 1 from ow_company_business_domains l where l.company_id=c.id and l.is_primary);
  select count(*) into n_two_primary from (
    select company_id from ow_company_business_domains where is_primary group by company_id having count(*)>1) x;
  /* ⚠️ 上限3件は DB の制約ではなく `MAX_BUSINESS_DOMAINS_PER_COMPANY`（アプリ側の定数）なので、
        DB では破れる。**破っていないことをここで数える。** */
  select count(*) into n_over_cap from (
    select company_id from ow_company_business_domains group by company_id having count(*)>3) x;

  if i_all <> 16 or i_listed <> 16 then raise exception 'infra が 全件% / 掲載中%（期待 16 / 16）', i_all, i_listed; end if;
  if d_all <> 4  or d_listed <> 4  then raise exception 'devtools が 全件% / 掲載中%（期待 4 / 4）', d_all, d_listed; end if;
  /* ⚠️ security / hardware は**触っていないので不変**。主を残したままなので減らない。 */
  if s_all <> 8  or s_listed <> 8  then raise exception 'security が 全件% / 掲載中%（期待 8 / 8・不変のはず）', s_all, s_listed; end if;
  if h_all <> 7  or h_listed <> 7  then raise exception 'hardware が 全件% / 掲載中%（期待 7 / 7・不変のはず）', h_all, h_listed; end if;
  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_no_primary <> 0 then raise exception '主が無い企業が % 社（期待 0）', n_no_primary; end if;
  if n_two_primary <> 0 then raise exception '主が2件以上の企業が % 社（期待 0）', n_two_primary; end if;
  if n_over_cap <> 0 then raise exception '3件を超える企業が % 社（期待 0）', n_over_cap; end if;

  raise notice '事後アサート OK: infra=%/% devtools=%/% security=%/%(不変) hardware=%/%(不変) 掲載中=%社 主なし0 主2件0 上限超え0',
    i_all, i_listed, d_all, d_listed, s_all, s_listed, h_all, h_listed, n_listed;
end $$;

commit;
