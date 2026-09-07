-- 第2バッチ: 12社に2つ目・3つ目の事業領域を足す（2026-09-07 / 柴さんの承認済み）
-- 第1バッチ（20260907140000 / commit 82d0f7e1）で複数値が実データで動くことを確認したので、
-- フェーズ0調査の①「明らかに足すべき」の残り12社をまとめて入れる。
--
-- ⚠️ **主は1社も触らない。** 足すのは `is_primary = false` の18行だけ。
--    カードのタグは主しか出さないので**一覧の見た目は変わらない**。変わるのは
--    絞り込みとファセット（どちらも全紐づけを見る）。
--
-- ⚠️★**企業の特定は `slug`。名前で引かない**（第1バッチで確立した作法）。
--    表記は混在している（カタカナ / `HubSpot Japan株式会社` `Notion Labs Japan合同会社`
--    `Sansan株式会社` のように英字が正のもの）。名前は事前アサートの照合にだけ使う。
--
-- ⚠️ `display_order` は**その企業の既存 display_order の最大値 + 1**を計算する。定数を書かない。
--    2件足す企業では `row_number()` でずらすので 1, 2 と連番になる。
--
-- ── ★セールスフォースで collab（コラボレーション）を足さない理由 ────────────────
-- Slack・Tableau・Marketing Cloud の3つとも該当し、主の crm と合わせると**4件**になる。
-- 上限は3件（`MAX_BUSINESS_DOMAINS_PER_COMPANY`）なので1つ落とす。**落とすのは collab。**
--   理由: **`Slack Japan株式会社` が collab を主として別に掲載されている。**
--         コラボレーション領域で働きたい人が応募する先はそちらで、
--         同じ製品で2社出ると絞り込みの意味が薄まる。
-- ⚠️ **「Slack が入っていないのは漏れではない」。** 足したくなったら、
--    先に Slack Japan との重複をどう扱うかを決めること。
--
-- ── ★日本マイクロソフトを ai / collab の2つに留める理由 ──────────────────────
-- hardware（Windows）・crm（Dynamics 365）・devtools（Visual Studio）も該当しうるが、
-- **description に根拠があるのは ai / collab だけ**（「Windows・Azure・Microsoft 365・Copilot」）。
-- 上限3件なので、**本文に書かれている範囲に留める**。
-- ⚠️ 足すなら description を先に厚くすること。**本文に無い値を推測で入れない**
--    （CLAUDE.md「推測値を投入しない」）。
--
-- ⚠️ ②「判断が要る16社」（ServiceNow / アトラシアン / オクタ / MongoDB / OpenAI / HPE /
--    アドビ / 富士フイルムBI / Box / Dropbox / Zendesk / マルケト / アンドパッド /
--    スパイダープラス ほか）は**入れていない**。

begin;

-- ── 事前アサート ────────────────────────────────────────────────────────────
do $$
declare
  /* slug / 社名 / 現在の件数 / 現在の主 */
  expected constant text[][] := array[
    ['salesforce','株式会社セールスフォース・ジャパン','1','crm'],
    ['microsoft', '日本マイクロソフト株式会社',        '1','infra'],
    ['cisco',     'シスコシステムズ合同会社',          '1','infra'],
    ['nvidia',    'エヌビディア合同会社',              '1','hardware'],
    ['elastic',   'エラスティック株式会社',            '1','ai'],
    ['sansan',    'Sansan株式会社',                   '1','crm'],
    ['workday',   '株式会社ワークデイ',                '2','hr'],
    ['google',    'グーグル合同会社',                  '1','ai'],
    ['oracle',    '日本オラクル株式会社',              '1','erp'],
    ['hubspot',   'HubSpot Japan株式会社',            '1','crm'],
    ['notion',    'Notion Labs Japan合同会社',        '1','collab'],
    ['ctc',       '伊藤忠テクノソリューションズ株式会社','1','infra']
  ];
  i int; n_rows int; n_primary int; cur_primary text; cur_name text;
  n_listed int; n_no_primary int; n_two_primary int; n_over_cap int; n_links int;
  r record;
begin
  for i in 1 .. array_length(expected, 1) loop
    select count(l.*), count(*) filter (where l.is_primary),
           max(d.slug) filter (where l.is_primary), max(c.name)
      into n_rows, n_primary, cur_primary, cur_name
      from ow_companies c
      left join ow_company_business_domains l on l.company_id = c.id
      left join ow_business_domains d on d.id = l.domain_id
     where c.slug = expected[i][1];

    if cur_name is null then raise exception 'slug=% の企業が見つからない', expected[i][1]; end if;
    /* ⚠️ 名前は照合だけに使う（引く鍵ではない）。表記が変わっていたら止める。 */
    if cur_name is distinct from expected[i][2] then
      raise exception 'slug=% の社名が「%」（期待「%」）', expected[i][1], cur_name, expected[i][2];
    end if;
    if n_rows <> expected[i][3]::int then
      raise exception '% の事業領域が % 件（期待 %）', expected[i][2], n_rows, expected[i][3];
    end if;
    if n_primary <> 1 then raise exception '% の主が % 件（期待 1）', expected[i][2], n_primary; end if;
    if cur_primary is distinct from expected[i][4] then
      raise exception '% の主が %（期待 %）', expected[i][2], cur_primary, expected[i][4];
    end if;
  end loop;

  /* ⚠️★**全件と掲載中の両方**で数える。ai / marketing / hr は draft・is_test のぶんズレる。 */
  for r in
    select d.slug,
           count(b.company_id) as raw_all,
           count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false) as listed
      from ow_business_domains d
      left join ow_company_business_domains b on b.domain_id = d.id
      left join ow_companies c on c.id = b.company_id
     where d.is_active group by d.slug
  loop
    if (r.slug,r.raw_all,r.listed) not in (
      ('ai',14,12),('infra',16,16),('devtools',4,4),('security',8,8),('crm',10,10),
      ('collab',6,6),('project-management',6,6),('erp',4,4),('finance',5,5),('legal',1,1),
      ('hr',7,6),('marketing',4,3),('hardware',7,7),('marketplace',2,2)
    ) then
      raise exception '適用前の % が 全件% / 掲載中% で想定と違う', r.slug, r.raw_all, r.listed;
    end if;
  end loop;

  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_no_primary from ow_companies c
   where exists (select 1 from ow_company_business_domains l where l.company_id=c.id)
     and not exists (select 1 from ow_company_business_domains l where l.company_id=c.id and l.is_primary);
  select count(*) into n_two_primary from (
    select company_id from ow_company_business_domains where is_primary group by company_id having count(*)>1) x;
  select count(*) into n_over_cap from (
    select company_id from ow_company_business_domains group by company_id having count(*)>3) x;
  select count(*) into n_links from ow_company_business_domains;

  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_no_primary <> 0 then raise exception '主が無い企業が % 社（期待 0）', n_no_primary; end if;
  if n_two_primary <> 0 then raise exception '主が2件以上の企業が % 社（期待 0）', n_two_primary; end if;
  if n_over_cap <> 0 then raise exception '3件を超える企業が % 社（期待 0）', n_over_cap; end if;
  if n_links <> 94 then raise exception '紐づけ行が % 件（期待 94）', n_links; end if;

  raise notice '事前アサート OK: 12社の主と件数が一致 / 紐づけ % 件 / 掲載中 % 社', n_links, n_listed;
end $$;

-- ── 従（is_primary = false）を18行 INSERT ───────────────────────────────────
-- 旧値（2026-09-07 実測 / すべて display_order = 0 の主1行。ワークデイのみ2行）:
--   salesforce crm(主)ord=0        microsoft infra(主)ord=0    cisco   infra(主)ord=0
--   nvidia     hardware(主)ord=0   elastic   ai(主)ord=0       sansan  crm(主)ord=0
--   workday    hr(主)ord=0 / erp(従)ord=1                      google  ai(主)ord=0
--   oracle     erp(主)ord=0        hubspot   crm(主)ord=0      notion  collab(主)ord=0
--   ctc        infra(主)ord=0
-- ★いずれも上の行は**触らない**。
insert into ow_company_business_domains (company_id, domain_id, is_primary, display_order)
select c.id,
       d.id,
       false,
       /* 既存の最大 ord + 1。同じ企業に2件足すときは row_number でずらして 1, 2 にする。
          ⚠️ 定数を書かない（第1バッチと同じ作法）。 */
       coalesce((select max(l2.display_order) from ow_company_business_domains l2
                  where l2.company_id = c.id), -1)
         + row_number() over (partition by t.company_slug order by t.ord)
  from (values
          -- 3件になる7社
          ('salesforce', 'marketing',          1),   -- Marketing Cloud（マーケ部門向け）
          ('salesforce', 'ai',                 2),   -- Tableau（データ分析・BI）※collab は上のコメント参照
          ('microsoft',  'ai',                 1),   -- Copilot
          ('microsoft',  'collab',             2),   -- Microsoft 365
          ('cisco',      'security',           1),   -- 「ネットワーク機器・セキュリティ・コラボレーション（Webex）」
          ('cisco',      'collab',             2),   -- Webex
          ('nvidia',     'ai',                 1),   -- 「AI・生成AIの基盤」
          ('nvidia',     'infra',              2),   -- 「データセンター向け H100/B100」
          ('elastic',    'security',           1),   -- 3本柱のひとつ（SIEM）
          ('elastic',    'devtools',           2),   -- オブザーバビリティ
          ('sansan',     'finance',            1),   -- Bill One（経理領域）
          ('sansan',     'legal',              2),   -- Contract One（取引・契約管理）
          ('workday',    'finance',            1),   -- タグライン「人事・財務クラウド」※既に erp を持つので3件目
          -- 2件になる5社
          ('google',     'infra',              1),   -- Google Cloud
          ('oracle',     'infra',              1),   -- OCI（Oracle Cloud Infrastructure）
          ('hubspot',    'marketing',          1),   -- Marketing Hub
          ('notion',     'project-management', 1),   -- 「…データベース・プロジェクト管理をオールインワン」
          ('ctc',        'security',           1)    -- 「クラウド・AI・データ分析・サイバーセキュリティ」
       ) as t(company_slug, domain_slug, ord)
  join ow_companies c        on c.slug = t.company_slug
  join ow_business_domains d on d.slug = t.domain_slug;

-- ── 事後アサート ────────────────────────────────────────────────────────────
do $$
declare
  expected_after constant text[][] := array[
    ['salesforce','3'],['microsoft','3'],['cisco','3'],['nvidia','3'],['elastic','3'],
    ['sansan','3'],['workday','3'],
    ['google','2'],['oracle','2'],['hubspot','2'],['notion','2'],['ctc','2']
  ];
  i int; n_rows int; n_primary int;
  n_listed int; n_no_primary int; n_two_primary int; n_over_cap int; n_links int; n_multi int;
  r record;
begin
  for i in 1 .. array_length(expected_after, 1) loop
    select count(*), count(*) filter (where l.is_primary) into n_rows, n_primary
      from ow_companies c join ow_company_business_domains l on l.company_id = c.id
     where c.slug = expected_after[i][1];
    if n_rows <> expected_after[i][2]::int then
      raise exception '% の事業領域が % 件（期待 %）', expected_after[i][1], n_rows, expected_after[i][2];
    end if;
    if n_primary <> 1 then raise exception '% の主が % 件（期待 1）', expected_after[i][1], n_primary; end if;
  end loop;

  for r in
    select d.slug,
           count(b.company_id) as raw_all,
           count(*) filter (where c.is_published and c.listing_status='listed' and coalesce(c.is_test,false)=false) as listed
      from ow_business_domains d
      left join ow_company_business_domains b on b.domain_id = d.id
      left join ow_companies c on c.id = b.company_id
     where d.is_active group by d.slug
  loop
    if (r.slug,r.raw_all,r.listed) not in (
      ('ai',17,15),('infra',19,19),('devtools',5,5),('security',11,11),('crm',10,10),
      ('collab',8,8),('project-management',7,7),('erp',4,4),('finance',7,7),('legal',2,2),
      ('hr',7,6),('marketing',6,5),('hardware',7,7),('marketplace',2,2)
    ) then
      raise exception '適用後の % が 全件% / 掲載中% で想定と違う', r.slug, r.raw_all, r.listed;
    end if;
  end loop;

  select count(*) into n_listed from ow_companies
   where is_published and listing_status='listed' and coalesce(is_test,false)=false;
  select count(*) into n_no_primary from ow_companies c
   where exists (select 1 from ow_company_business_domains l where l.company_id=c.id)
     and not exists (select 1 from ow_company_business_domains l where l.company_id=c.id and l.is_primary);
  select count(*) into n_two_primary from (
    select company_id from ow_company_business_domains where is_primary group by company_id having count(*)>1) x;
  /* ⚠️ 上限3件は DB の制約ではなくアプリ側の定数なので DB では破れる。**破っていないことを数える。** */
  select count(*) into n_over_cap from (
    select company_id from ow_company_business_domains group by company_id having count(*)>3) x;
  select count(*) into n_links from ow_company_business_domains;
  select count(*) into n_multi from (
    select company_id from ow_company_business_domains group by company_id having count(*)>1) x;

  if n_listed <> 83 then raise exception '掲載中が % 社（期待 83）', n_listed; end if;
  if n_no_primary <> 0 then raise exception '主が無い企業が % 社（期待 0）', n_no_primary; end if;
  if n_two_primary <> 0 then raise exception '主が2件以上の企業が % 社（期待 0）', n_two_primary; end if;
  if n_over_cap <> 0 then raise exception '3件を超える企業が % 社（期待 0）', n_over_cap; end if;
  if n_links <> 112 then raise exception '紐づけ行が % 件（期待 112）', n_links; end if;
  /* ⚠️★**18 であって 19 ではない。** 指示書の想定値（19）はワークデイを二重に数えていた。
        適用前の複数値は7社（ワークデイ＋第1バッチの6社）で、このバッチが触る12社のうち
        **ワークデイは既にその7社に入っている**ので、新たに複数値になるのは11社。7 + 11 = 18。
        （最初 19 で書いて事後アサートが正しく止めた。実測を正とする） */
  if n_multi <> 18 then raise exception '複数値を持つ企業が % 社（期待 18）', n_multi; end if;

  raise notice '事後アサート OK: 紐づけ % 件 / 複数値 % 社 / 掲載中 % 社 / 主なし0 主2件0 上限超え0',
    n_links, n_multi, n_listed;
end $$;

commit;
