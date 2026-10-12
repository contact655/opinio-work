-- ════════════════════════════════════════════════════════════════════════
-- 戻し: 20261013010000_classification_launch.sql（新しい業種・事業の有効化と付け替え）を取り消す
-- ════════════════════════════════════════════════════════════════════════
-- ⚠️ 何かあったときだけ使う。使うときは supabase/migrations/ に新しい番号で置いて db push する
--    （このファイル名のままでは db push に拾われない）。
-- ⚠️ コード（段3・段5）も前の版に戻すこと（新しい行が無効に戻ると、新しい入力欄の選択肢が減るだけで壊れはしないが、
--    求職者側の「業種」チップは有効な業種だけを出すので、元の分類で動く）。
-- ⚠️ 出荷後に企業や運営が新しい行を選んで保存していたら、その会社の行は戻せない（下の検算で止まる）。
--    そのときは止まった会社を一覧にして、1社ずつ判断する。
-- ════════════════════════════════════════════════════════════════════════

begin;

create temp table _before on commit drop as
select (select count(*) filter (where is_published) from public.ow_companies) as published,
       (select count(*) filter (where listing_status = 'listed') from public.ow_companies) as listed;

-- 出荷後に新しい行を使い始めた会社がいたら止める（黙って外さない）
do $$ begin
  if exists (
    select 1 from public.ow_companies c join public.ow_industries i on i.id = c.industry_id
     where i.slug in ('life-services','hr-recruiting-support','consulting-hr-org','finance-vc','mfg-automotive','trading-general',
                      'medical-hospital','medical-care-welfare','public-government','public-npo')
        or (i.slug = 'media-web' and c.id <> 'e8e2245d-4663-413e-9fa2-ffd29aa1977e')
        or (i.slug = 'mfg-pharma-medical' and c.id <> 'a4f9fe48-a4c6-4a9e-87a1-c54c26b78187')
        or (i.slug = 'life-travel' and c.id <> '33c70f13-c7e1-42b9-a8b3-76b9abc482fd')) then
    raise exception '中止: 出荷後に新しい業種を選んだ会社がある（1社ずつ判断する）';
  end if;
end $$;

-- ① 会社の事業を戻す
delete from public.ow_company_business_domains where company_id = '539af64f-ffa5-454d-b494-82731643d294'
   and domain_id in (select id from public.ow_business_domains where slug in ('cs-outsourcing','bpo','ad-operations'));
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'marketplace')
 where company_id = '943620b5-0fa2-48b4-a072-d47f900ba9f0' and domain_id = (select id from public.ow_business_domains where slug = 'food-delivery');
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'finance')
 where company_id in ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e','a1a7036b-a5c4-4328-b5db-96ac1d5e29df')
   and domain_id in (select id from public.ow_business_domains where slug in ('expense-management','fintech-it'));
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'legal')
 where company_id = 'da8cfab5-f5c2-4648-b866-895be46a1494' and domain_id = (select id from public.ow_business_domains where slug = 'e-contract');
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'hardware')
 where domain_id = (select id from public.ow_business_domains where slug = 'electronic-components')
   and company_id in ('dcd2c652-4335-4031-b4d2-a4f22c98182b','f4acddc0-c746-4537-9edf-6f3c1f2c90b3','f201ed17-a9e2-4859-85aa-474578b2870d','c32027b9-cfbd-4a70-bf4c-464e42790db4');

-- ② 会社の業種を戻す
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'media-publishing') where id = 'e8e2245d-4663-413e-9fa2-ffd29aa1977e';
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'healthcare') where id = 'a4f9fe48-a4c6-4a9e-87a1-c54c26b78187';
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'other-services') where id = '33c70f13-c7e1-42b9-a8b3-76b9abc482fd';

-- ③ 事業の名前・有効を戻す（段1で入れた178行を無効に）
update public.ow_business_domains set name = 'ハードウェア・半導体', aliases = '{}' where slug = 'hardware';
update public.ow_business_domains set name = '経理・財務', aliases = '{}', display_kind = 'main' where slug = 'finance';
update public.ow_business_domains set is_active = false
 where status = 'active' and slug not in ('ai','infra','devtools','security','crm','collab','erp','finance','legal','hr','marketing','hardware','marketplace','consulting');

-- ④ 業種の行を戻す
update public.ow_industries set parent_id = null, name = '飲食・外食', display_order = 5, aliases = '{}' where slug = 'food-service';
update public.ow_industries set parent_id = (select id from public.ow_industries where slug = 'media-advertising-entertainment'), name = 'エンタメ・映像・音楽', display_order = 4, aliases = '{}' where slug = 'media-entertainment';
update public.ow_industries set parent_id = null, display_order = 18 where slug = 'other-services';
update public.ow_industries set is_active = false
 where slug in ('life-services','life-travel','hr-recruiting-support','consulting-hr-org','finance-vc','mfg-automotive','mfg-pharma-medical',
                'trading-general','media-web','medical-hospital','medical-care-welfare','public-government','public-npo');

do $$ declare b record; begin
  select * into b from _before;
  if (select count(*) filter (where is_published) from public.ow_companies) <> b.published
     or (select count(*) filter (where listing_status = 'listed') from public.ow_companies) <> b.listed then
    raise exception '検算失敗: 公開／掲載の件数が変わった';
  end if;
  if (select count(*) from public.ow_business_domains where is_active) <> 14 then
    raise exception '検算失敗: 有効な事業が % 行（14のはず）', (select count(*) from public.ow_business_domains where is_active);
  end if;
  if exists (select 1 from public.ow_companies c join public.ow_industries i on i.id = c.industry_id where not i.is_active) then
    raise exception '検算失敗: 無効な業種を使っている会社がある';
  end if;
  raise notice '戻しOK（公開 %・掲載 % は不変）', b.published, b.listed;
end $$;

commit;
