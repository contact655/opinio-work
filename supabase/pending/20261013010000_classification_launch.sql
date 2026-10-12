-- ════════════════════════════════════════════════════════════════════════
-- 会社の分類 段3〜5の出荷：新しい業種・事業を有効にし、段2で後回しにした付け替えを行う（2026-10-12 / 柴さんの判断）
-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️★適用は柴さんの「出してよい」のあと。それまで supabase/pending/ に置く（db push に拾わせない）。
--    当てる日に supabase/migrations/ へ移し、**コード（段3・段5）のデプロイと同じタイミング**で出す。
--    先に当てると、いまの画面（事業のチップ＝有効な事業すべて）に約190件が並ぶ。
--
-- 書き換える会社（一覧は docs/classification-stage2-lists-20261012.md「段5の有効化と同時に行うもの」）:
--   業種 PIVOT → 広告・メディア › Webメディア ／ 大塚製薬 → メーカー › 医薬品・医療機器 ／ JTB → 生活・サービス › 旅行・観光
--   事業 アップル・デル・レノボ・日本HP：ハードウェア・半導体 → 電子部品（デル・レノボの2件目「クラウド・インフラ」はそのまま）
--        DocuSign：リーガルテック → 電子契約 ／ コンカー：経理・財務 → 経費精算 ／ キリバ：経理・財務 → フィンテック
--        ウーバー：マーケットプレイス → フードデリバリー（マーケットプレイスは IT の main として残す）
--        トランス・コスモス：（なし）→ ★カスタマーサポート代行・BPO・広告運用
-- 名前を変える事業: ハードウェア・半導体 → 半導体 ／ 経理・財務 → 会計ソフト（旧名は別名に残す）
-- 業種の行: 飲食・外食 → 生活・サービス › 飲食 ／ エンタメ・映像・音楽 → 生活・サービス › エンタメ・レジャー ／
--           その他サービス → 生活・サービスの子
--
-- 守ること: 公開・掲載は変えない／上の会社以外の業種・事業は変えない（下で前後を突き合わせる。違えば全部巻き戻す）
-- 作業前ダンプ: ./scripts/dump-tables.sh ow_industries ow_business_domains ow_company_business_domains ow_companies
-- 戻し方: docs/classification-stage3-5-launch-20261012.md
-- ════════════════════════════════════════════════════════════════════════

begin;

create temp table _moved (id uuid primary key) on commit drop;
insert into _moved values
  ('e8e2245d-4663-413e-9fa2-ffd29aa1977e'), ('a4f9fe48-a4c6-4a9e-87a1-c54c26b78187'), ('33c70f13-c7e1-42b9-a8b3-76b9abc482fd'),
  ('dcd2c652-4335-4031-b4d2-a4f22c98182b'), ('f4acddc0-c746-4537-9edf-6f3c1f2c90b3'), ('f201ed17-a9e2-4859-85aa-474578b2870d'),
  ('c32027b9-cfbd-4a70-bf4c-464e42790db4'), ('da8cfab5-f5c2-4648-b866-895be46a1494'), ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e'),
  ('a1a7036b-a5c4-4328-b5db-96ac1d5e29df'), ('943620b5-0fa2-48b4-a072-d47f900ba9f0'), ('539af64f-ffa5-454d-b494-82731643d294');

create temp table _before on commit drop as
select
  (select count(*) filter (where is_published) from public.ow_companies) as published,
  (select count(*) filter (where listing_status = 'listed') from public.ow_companies) as listed,
  (select md5(string_agg((to_jsonb(c) - array['industry_id','updated_at'])::text, ',' order by id)) from public.ow_companies c) as companies_rest,
  (select md5(string_agg(concat_ws('|', id, industry_id), ',' order by id)) from public.ow_companies where id not in (select id from _moved)) as industries_rest,
  (select md5(string_agg(concat_ws('|', company_id, domain_id, is_primary, display_order), ',' order by company_id, domain_id))
     from public.ow_company_business_domains where company_id not in (select id from _moved)) as links_rest,
  (select count(*) from public.ow_industries where is_active) as ind_active,
  (select count(*) from public.ow_business_domains where is_active) as dom_active,
  (select count(*) from public.ow_business_domains where status = 'active' and not is_active) as dom_to_launch;

do $$ begin
  if (select published from _before) <> 120 or (select listed from _before) <> 24 then
    raise exception '中止: 公開 %・掲載 % が想定（120・24）と違う', (select published from _before), (select listed from _before);
  end if;
  if (select dom_to_launch from _before) <> 178 then
    raise exception '中止: 有効にする事業が % 件（178のはず）', (select dom_to_launch from _before);
  end if;
end $$;

-- ① 業種: 新しい行を有効に、生活・サービスへ移す行
update public.ow_industries set is_active = true
 where slug in ('life-services','life-travel','hr-recruiting-support','consulting-hr-org','finance-vc','mfg-automotive',
                'mfg-pharma-medical','trading-general','media-web','medical-hospital','medical-care-welfare',
                'public-government','public-npo');
update public.ow_industries set parent_id = (select id from public.ow_industries where slug = 'life-services'), name = '飲食', display_order = 2, aliases = array['飲食・外食']::text[] where slug = 'food-service';
update public.ow_industries set parent_id = (select id from public.ow_industries where slug = 'life-services'), name = 'エンタメ・レジャー', display_order = 3, aliases = array['エンタメ・映像・音楽']::text[] where slug = 'media-entertainment';
update public.ow_industries set parent_id = (select id from public.ow_industries where slug = 'life-services'), display_order = 4 where slug = 'other-services';

-- ② 事業: 運営が認めた行（段1で入れた178行）を有効に。名前を変える2行
update public.ow_business_domains set is_active = true where status = 'active' and not is_active;
update public.ow_business_domains set name = '半導体', aliases = array['ハードウェア・半導体']::text[] where slug = 'hardware';
update public.ow_business_domains set name = '会計ソフト', aliases = array['経理・財務']::text[], display_kind = 'search' where slug = 'finance';

-- ③ 会社の業種（3社）
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'media-web') where id = 'e8e2245d-4663-413e-9fa2-ffd29aa1977e';  -- PIVOT
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'mfg-pharma-medical') where id = 'a4f9fe48-a4c6-4a9e-87a1-c54c26b78187';  -- 大塚製薬
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'life-travel') where id = '33c70f13-c7e1-42b9-a8b3-76b9abc482fd';  -- JTB

-- ④ 会社の事業（9社）
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'electronic-components')
 where domain_id = (select id from public.ow_business_domains where slug = 'hardware')
   and company_id in ('dcd2c652-4335-4031-b4d2-a4f22c98182b','f4acddc0-c746-4537-9edf-6f3c1f2c90b3','f201ed17-a9e2-4859-85aa-474578b2870d','c32027b9-cfbd-4a70-bf4c-464e42790db4');
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'e-contract')
 where company_id = 'da8cfab5-f5c2-4648-b866-895be46a1494' and domain_id = (select id from public.ow_business_domains where slug = 'legal');
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'expense-management')
 where company_id = '91523b3b-15e4-4f6b-8c9b-a90b67552b9e' and domain_id = (select id from public.ow_business_domains where slug = 'finance');
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'fintech-it')
 where company_id = 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df' and domain_id = (select id from public.ow_business_domains where slug = 'finance');
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'food-delivery')
 where company_id = '943620b5-0fa2-48b4-a072-d47f900ba9f0' and domain_id = (select id from public.ow_business_domains where slug = 'marketplace');
insert into public.ow_company_business_domains (company_id, domain_id, is_primary, display_order)
select '539af64f-ffa5-454d-b494-82731643d294', d.id, d.slug = 'cs-outsourcing', o.n
  from (values ('cs-outsourcing', 1), ('bpo', 2), ('ad-operations', 3)) as o(slug, n)
  join public.ow_business_domains d on d.slug = o.slug;

-- ⑤ 検算
do $$
declare b record; n int;
begin
  select * into b from _before;
  if (select count(*) filter (where is_published) from public.ow_companies) <> b.published
     or (select count(*) filter (where listing_status = 'listed') from public.ow_companies) <> b.listed then
    raise exception '検算失敗: 公開／掲載の件数が変わった';
  end if;
  if (select md5(string_agg((to_jsonb(c) - array['industry_id','updated_at'])::text, ',' order by id)) from public.ow_companies c) <> b.companies_rest then
    raise exception '検算失敗: 業種以外の列が変わった';
  end if;
  if (select md5(string_agg(concat_ws('|', id, industry_id), ',' order by id)) from public.ow_companies where id not in (select id from _moved)) <> b.industries_rest then
    raise exception '検算失敗: 対象の3社以外の業種が変わった';
  end if;
  if (select md5(string_agg(concat_ws('|', company_id, domain_id, is_primary, display_order), ',' order by company_id, domain_id))
        from public.ow_company_business_domains where company_id not in (select id from _moved)) <> b.links_rest then
    raise exception '検算失敗: 対象以外の会社の事業が変わった';
  end if;
  -- 3社の業種
  select count(*) into n from public.ow_companies c join public.ow_industries i on i.id = c.industry_id
   where (c.id, i.slug) in (('e8e2245d-4663-413e-9fa2-ffd29aa1977e'::uuid, 'media-web'), ('a4f9fe48-a4c6-4a9e-87a1-c54c26b78187'::uuid, 'mfg-pharma-medical'),
                            ('33c70f13-c7e1-42b9-a8b3-76b9abc482fd'::uuid, 'life-travel'));
  if n <> 3 then raise exception '検算失敗: 業種の付け替えが % 社', n; end if;
  -- 事業: ハードウェアの紐付けは3社（インテル・NVIDIA・クアルコム）だけ。主は1社1件
  select count(*) into n from public.ow_company_business_domains where domain_id = (select id from public.ow_business_domains where slug = 'hardware');
  if n <> 3 then raise exception '検算失敗: 半導体の紐付けが % 件（3のはず）', n; end if;
  select count(*) into n from public.ow_company_business_domains where domain_id = (select id from public.ow_business_domains where slug = 'electronic-components');
  if n <> 4 then raise exception '検算失敗: 電子部品の紐付けが % 件（4のはず）', n; end if;
  select count(*) into n from public.ow_company_business_domains where company_id = '539af64f-ffa5-454d-b494-82731643d294';
  if n <> 3 then raise exception '検算失敗: トランス・コスモスの事業が % 件', n; end if;
  if exists (select company_id from public.ow_company_business_domains group by company_id having count(*) filter (where is_primary) <> 1) then
    raise exception '検算失敗: 主の事業が1件でない会社がある';
  end if;
  -- 有効な行
  if (select count(*) from public.ow_industries where is_active) <> b.ind_active + 13 then
    raise exception '検算失敗: 有効な業種が % 行', (select count(*) from public.ow_industries where is_active);
  end if;
  if (select count(*) from public.ow_business_domains where is_active) <> b.dom_active + 178 then
    raise exception '検算失敗: 有効な事業が % 行', (select count(*) from public.ow_business_domains where is_active);
  end if;
  -- 使わなくなった業種・無効な事業を使っている会社が無い
  if exists (select 1 from public.ow_companies c join public.ow_industries i on i.id = c.industry_id where not i.is_active) then
    raise exception '検算失敗: 無効な業種を使っている会社がある';
  end if;
  -- ⚠️ 企業が追加して確認待ちの事業（pending）は無効のまま残る。それ以外の無効な事業を実在の会社が使っていないこと
  if exists (select 1 from public.ow_company_business_domains x join public.ow_business_domains d on d.id = x.domain_id
              join public.ow_companies c on c.id = x.company_id where not d.is_active and d.status <> 'pending' and c.is_test = false) then
    raise exception '検算失敗: 無効な事業を使っている実在の会社がある';
  end if;
  raise notice '検算OK: 業種 +13・事業 +178 を有効化。業種3社・事業9社を付け替え。公開 %・掲載 % は変わらず', b.published, b.listed;
end $$;

commit;
