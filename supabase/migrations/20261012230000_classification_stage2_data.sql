-- ════════════════════════════════════════════════════════════════════════
-- 会社の分類 段2：データ移行（2026-10-12 / 柴さんの判断）
-- ════════════════════════════════════════════════════════════════════════
--
-- 一覧と判断: docs/classification-stage2-lists-20261012.md（2026-10-12 確定）
--
-- ★書き込むのは一覧に判断を反映したものだけ。新しい行（段1で入れた業種13・事業178）は**無効のまま**。
--   ⚠️ そのため「新しい行へ付け替える会社」はこの段では動かさず、段5（新しい行の有効化）と同時に行う:
--      業種 PIVOT→Webメディア／大塚製薬→医薬品・医療機器／JTB→旅行・観光（と 飲食・エンタメ・その他サービスの生活・サービスへの移動）
--      事業 アップル・デル・レノボ・日本HP→電子部品／DocuSign→電子契約／コンカー→経費精算／キリバ→フィンテック／
--           ウーバー→フードデリバリー／トランス・コスモス→カスタマーサポート代行・BPO・広告運用
--      理由: 無効な行は anon から見えない（RLS）ので、付け替えた瞬間に企業ページ・一覧から業種や事業が**黙って消える**。
--   ⚠️ 同じ理由で「ハードウェア・半導体→半導体」「経理・財務→会計ソフト」の改名も段5へ回す
--      （アップルを「半導体」、キリバを「会計ソフト」と出す時間を作らないため）。
--
-- 守ること（提案B）: 公開・掲載の状態は変えない。会社の行で変えてよい列は 'industry_id','company_stage','capital_type','parent_company_name','parent_company_country','is_foreign','hq_country','customer_all_industries','serves_consumers','updated_at' だけ。
--   想定と1つでも違えば例外で全部巻き戻す。
-- 作業前ダンプ: .dumps/（段2の直前に取得）
-- ════════════════════════════════════════════════════════════════════════

begin;

create temp table _before on commit drop as
select
  (select count(*) filter (where is_published) from public.ow_companies) as published,
  (select count(*) filter (where listing_status = 'listed') from public.ow_companies) as listed,
  (select md5(string_agg((to_jsonb(c) - array['industry_id','company_stage','capital_type','parent_company_name','parent_company_country','is_foreign','hq_country','customer_all_industries','serves_consumers','updated_at'])::text, ',' order by id)) from public.ow_companies c) as companies_rest,
  (select md5(string_agg(concat_ws('|', company_id, domain_id, is_primary, display_order), ',' order by company_id, domain_id))
     from public.ow_company_business_domains where company_id not in ('b1d7996c-d260-4025-b495-bd1e2b9bb795', '0b93a8f2-d378-4d5a-aecc-9040fde2113c', 'd71a7da6-a769-456e-99ab-a077d89a0d43', '78560eee-1a82-44b8-b9f6-d9c88fb60f4b', 'fc1f7cb7-9530-4d6a-85cf-15196a4b155e', '6c218a59-a951-44ee-9003-163956376554', 'bf24736f-fa65-4c5a-9764-98c96ace3b07')) as domains_rest,
  (select md5(string_agg(concat_ws('|', id, industry_id, company_stage, capital_type, is_foreign, hq_country, customer_all_industries, serves_consumers), ',' order by id))
     from public.ow_companies where is_test) as test_companies;

do $$ begin
  if (select published from _before) <> 120 or (select listed from _before) <> 24 then
    raise exception '中止: 公開 % ・掲載 % が想定（120・24）と違う', (select published from _before), (select listed from _before);
  end if;
  if exists (select 1 from public.ow_companies where company_stage is not null or hq_country is not null or customer_all_industries or serves_consumers) then
    raise exception '中止: 新しい列に既に値がある';
  end if;
end $$;

create temp table _exp_stage (id uuid primary key, v text) on commit drop;
insert into _exp_stage values
  ('08e4aff6-a12c-4963-ad43-960ac9e39967'::uuid, 'listed'),
  ('6c218a59-a951-44ee-9003-163956376554'::uuid, 'listed'),
  ('9ccf1640-6a5c-42e3-bbcf-4110f715fbf4'::uuid, 'listed'),
  ('ae15610d-477a-410d-b74a-54ab3e351add'::uuid, 'startup_growth'),
  ('a5ffac90-70aa-4242-b867-6d9334317851'::uuid, 'listed'),
  ('da8cfab5-f5c2-4648-b866-895be46a1494'::uuid, 'listed'),
  ('1f73df31-8e55-4e70-a928-afe1150d72d0'::uuid, 'listed'),
  ('aaaaaaaa-0001-0001-0001-000000000007'::uuid, 'listed'),
  ('e7e9b0be-20c2-4434-afea-7a27c89332e2'::uuid, 'listed'),
  ('0ece9af4-96cb-443c-b8a8-0f358c8e3a64'::uuid, 'listed'),
  ('565b0f13-252d-44d0-8b90-e00acacf4b75'::uuid, 'listed'),
  ('bf24736f-fa65-4c5a-9764-98c96ace3b07'::uuid, 'startup_growth'),
  ('f8ebbe74-b647-46ea-869f-b126d1c4f316'::uuid, 'listed'),
  ('daa558e5-054f-4475-ab00-3817170759ce'::uuid, 'startup_growth'),
  ('bcea5e4e-94ee-4019-8ce3-237a7edf79a7'::uuid, 'listed'),
  ('8b9f84b0-b4be-4191-8322-07c6a2e5e91a'::uuid, 'listed'),
  ('4df6e844-74d6-4f50-98f9-08468a12f1dc'::uuid, 'listed'),
  ('cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16'::uuid, 'listed'),
  ('cb70da1c-4b3b-429b-a06b-cdc2c50172f8'::uuid, 'listed'),
  ('88defb4b-b18c-437b-8b7d-d41a43232af4'::uuid, 'listed'),
  ('fb7397eb-a9c7-4ce3-964a-d7a72159847f'::uuid, 'startup_growth'),
  ('e3eafa66-02ce-4060-a5fe-57e4317c8e7c'::uuid, 'listed'),
  ('b8aa0e3d-828c-4bbe-b588-88450aab5739'::uuid, 'listed'),
  ('6396920c-70d3-47d2-9f4e-67bc2efe262f'::uuid, 'listed'),
  ('20cd4ddd-f00e-4065-909d-97a317558ad3'::uuid, 'listed'),
  ('60304f29-e070-4ef6-9b44-8a899a411a8d'::uuid, 'listed'),
  ('dcd2c652-4335-4031-b4d2-a4f22c98182b'::uuid, 'listed'),
  ('fc1f7cb7-9530-4d6a-85cf-15196a4b155e'::uuid, 'listed'),
  ('eccd3dfb-decd-4277-a3a4-df489d3b3e5e'::uuid, 'listed'),
  ('a9de1561-eb91-4ebf-842d-f6d39865b7ef'::uuid, 'listed'),
  ('3efd857e-315c-4650-9727-1e5aa1245753'::uuid, 'listed'),
  ('f32e6905-f25f-4c01-b64f-c5695fd45a1d'::uuid, 'startup_growth'),
  ('ec97fde1-6f22-4ab5-89ee-9cea0b258f2a'::uuid, 'listed'),
  ('943620b5-0fa2-48b4-a072-d47f900ba9f0'::uuid, 'listed'),
  ('829a1ea9-d577-4404-9ba7-e301680523a8'::uuid, 'listed'),
  ('1e541353-c177-40a9-968a-af3af14e1194'::uuid, 'listed'),
  ('a1a7036b-a5c4-4328-b5db-96ac1d5e29df'::uuid, 'startup_growth'),
  ('94edfbe5-0496-4c1d-865c-d2d448232135'::uuid, 'listed'),
  ('87bcae88-2779-4bf7-b461-b3c8661b2764'::uuid, 'listed'),
  ('0a216ebb-c1fa-4d19-b066-f45e45c3ba2e'::uuid, 'listed'),
  ('1413b97e-ef19-4e40-87ae-e31ac8996bdd'::uuid, 'startup_growth'),
  ('7d186c45-ce23-4d96-8eae-cd6e7c00faee'::uuid, 'listed'),
  ('4fecbf31-498c-40b0-a04e-3a6cb978433f'::uuid, 'startup_growth'),
  ('e459ac79-5dad-499d-bb65-b758d4281123'::uuid, 'startup_growth'),
  ('1241f8a5-b645-4aa2-9fa1-bbfc573f1774'::uuid, 'startup_growth'),
  ('27988ac1-fd93-445d-a9fd-6dad74c92686'::uuid, 'listed'),
  ('0b93a8f2-d378-4d5a-aecc-9040fde2113c'::uuid, 'listed'),
  ('dd76b17d-e3c1-44a9-b747-4ecde10b8cec'::uuid, 'listed'),
  ('f4acddc0-c746-4537-9edf-6f3c1f2c90b3'::uuid, 'listed'),
  ('be74d989-db8f-4be1-882c-40cf94e07fe2'::uuid, 'listed'),
  ('f4a6aa23-3775-4548-981b-156e416ef6f6'::uuid, 'listed'),
  ('3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2'::uuid, 'listed'),
  ('53ea9a54-feef-413b-8a7c-e31e4def2e11'::uuid, 'listed'),
  ('478a9ede-ea0f-48c1-859c-d47f84d35b6b'::uuid, 'listed'),
  ('7baafcb1-d929-46c1-97be-b0fb580b480b'::uuid, 'listed'),
  ('355ce5c6-0412-4512-8864-1d477c97c917'::uuid, 'startup_growth'),
  ('f201ed17-a9e2-4859-85aa-474578b2870d'::uuid, 'listed'),
  ('7dac3c6e-bc5f-4550-9170-4338ea809be2'::uuid, 'listed'),
  ('138ff010-8671-414a-ab06-752d61f50dd7'::uuid, 'listed'),
  ('b8b7a2d4-20a8-4fe1-8651-61a6503f762e'::uuid, 'listed'),
  ('9ef65fa1-e04b-4098-a7b1-4ee3d535a23a'::uuid, 'listed'),
  ('1f8010f2-ba3f-4f7a-b7f4-d5b60400e638'::uuid, 'listed'),
  ('9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6'::uuid, 'listed'),
  ('40dca29e-aa4b-4654-aada-8e29763f8521'::uuid, 'listed'),
  ('c7353772-0c07-4f0d-8d20-294215125303'::uuid, 'listed'),
  ('09d67e54-0381-45c8-b698-568e1fc47033'::uuid, 'listed'),
  ('81aa95dc-2304-4faa-9c4a-f2f5454e8e11'::uuid, 'mega_venture'),
  ('b1d7996c-d260-4025-b495-bd1e2b9bb795'::uuid, 'startup_growth'),
  ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e'::uuid, 'listed'),
  ('28b826eb-fb86-4124-aa08-c489cad662f1'::uuid, 'listed'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17'::uuid, 'listed'),
  ('2e54ff06-2f4d-420c-9a5c-9a80a85ca55a'::uuid, 'listed'),
  ('cb386dd2-427c-49d1-b3f8-1e1d3a921fd8'::uuid, 'startup_growth'),
  ('e4d317d3-48b9-4718-ae3e-8d27147d05f5'::uuid, 'listed'),
  ('8dc04d46-3430-45de-91f8-e37c8880b8a5'::uuid, 'listed'),
  ('c32027b9-cfbd-4a70-bf4c-464e42790db4'::uuid, 'listed');
create temp table _exp_hq (id uuid primary key, v text) on commit drop;
insert into _exp_hq values
  ('08e4aff6-a12c-4963-ad43-960ac9e39967'::uuid, 'US'),
  ('6c218a59-a951-44ee-9003-163956376554'::uuid, 'US'),
  ('9ccf1640-6a5c-42e3-bbcf-4110f715fbf4'::uuid, 'US'),
  ('ae15610d-477a-410d-b74a-54ab3e351add'::uuid, 'US'),
  ('a5ffac90-70aa-4242-b867-6d9334317851'::uuid, 'US'),
  ('da8cfab5-f5c2-4648-b866-895be46a1494'::uuid, 'US'),
  ('1f73df31-8e55-4e70-a928-afe1150d72d0'::uuid, 'US'),
  ('aaaaaaaa-0001-0001-0001-000000000007'::uuid, 'US'),
  ('99132c64-ff07-4945-aeb6-7e21e6c256c9'::uuid, 'US'),
  ('0ece9af4-96cb-443c-b8a8-0f358c8e3a64'::uuid, 'US'),
  ('565b0f13-252d-44d0-8b90-e00acacf4b75'::uuid, 'US'),
  ('0d4734e0-0717-475e-a6d1-806aa2cd45ff'::uuid, 'US'),
  ('bf24736f-fa65-4c5a-9764-98c96ace3b07'::uuid, 'US'),
  ('f8ebbe74-b647-46ea-869f-b126d1c4f316'::uuid, 'US'),
  ('daa558e5-054f-4475-ab00-3817170759ce'::uuid, 'US'),
  ('bcea5e4e-94ee-4019-8ce3-237a7edf79a7'::uuid, 'DE'),
  ('4df6e844-74d6-4f50-98f9-08468a12f1dc'::uuid, 'US'),
  ('cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16'::uuid, 'US'),
  ('cb70da1c-4b3b-429b-a06b-cdc2c50172f8'::uuid, 'US'),
  ('88defb4b-b18c-437b-8b7d-d41a43232af4'::uuid, 'US'),
  ('e3eafa66-02ce-4060-a5fe-57e4317c8e7c'::uuid, 'DE'),
  ('b8aa0e3d-828c-4bbe-b588-88450aab5739'::uuid, 'US'),
  ('6396920c-70d3-47d2-9f4e-67bc2efe262f'::uuid, 'US'),
  ('20cd4ddd-f00e-4065-909d-97a317558ad3'::uuid, 'IE'),
  ('dcd2c652-4335-4031-b4d2-a4f22c98182b'::uuid, 'US'),
  ('fc1f7cb7-9530-4d6a-85cf-15196a4b155e'::uuid, 'US'),
  ('eccd3dfb-decd-4277-a3a4-df489d3b3e5e'::uuid, 'US'),
  ('a9de1561-eb91-4ebf-842d-f6d39865b7ef'::uuid, 'US'),
  ('3efd857e-315c-4650-9727-1e5aa1245753'::uuid, 'US'),
  ('f32e6905-f25f-4c01-b64f-c5695fd45a1d'::uuid, 'US'),
  ('ec97fde1-6f22-4ab5-89ee-9cea0b258f2a'::uuid, 'US'),
  ('943620b5-0fa2-48b4-a072-d47f900ba9f0'::uuid, 'US'),
  ('829a1ea9-d577-4404-9ba7-e301680523a8'::uuid, 'US'),
  ('1e541353-c177-40a9-968a-af3af14e1194'::uuid, 'NL'),
  ('a1a7036b-a5c4-4328-b5db-96ac1d5e29df'::uuid, 'US'),
  ('94edfbe5-0496-4c1d-865c-d2d448232135'::uuid, 'US'),
  ('87bcae88-2779-4bf7-b461-b3c8661b2764'::uuid, 'US'),
  ('0a216ebb-c1fa-4d19-b066-f45e45c3ba2e'::uuid, 'US'),
  ('1413b97e-ef19-4e40-87ae-e31ac8996bdd'::uuid, 'US'),
  ('1027a327-18c0-4191-b27b-a28bf5781126'::uuid, 'US'),
  ('7d186c45-ce23-4d96-8eae-cd6e7c00faee'::uuid, 'US'),
  ('4fecbf31-498c-40b0-a04e-3a6cb978433f'::uuid, 'US'),
  ('e459ac79-5dad-499d-bb65-b758d4281123'::uuid, 'US'),
  ('1241f8a5-b645-4aa2-9fa1-bbfc573f1774'::uuid, 'US'),
  ('27988ac1-fd93-445d-a9fd-6dad74c92686'::uuid, 'US'),
  ('dd76b17d-e3c1-44a9-b747-4ecde10b8cec'::uuid, 'US'),
  ('f4acddc0-c746-4537-9edf-6f3c1f2c90b3'::uuid, 'US'),
  ('be74d989-db8f-4be1-882c-40cf94e07fe2'::uuid, 'US'),
  ('f4a6aa23-3775-4548-981b-156e416ef6f6'::uuid, 'US'),
  ('3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2'::uuid, 'US'),
  ('53ea9a54-feef-413b-8a7c-e31e4def2e11'::uuid, 'US'),
  ('478a9ede-ea0f-48c1-859c-d47f84d35b6b'::uuid, 'US'),
  ('7baafcb1-d929-46c1-97be-b0fb580b480b'::uuid, 'US'),
  ('f201ed17-a9e2-4859-85aa-474578b2870d'::uuid, 'CN'),
  ('7dac3c6e-bc5f-4550-9170-4338ea809be2'::uuid, 'US'),
  ('d6650b18-5ef2-40c9-9938-2adbad70fe2b'::uuid, 'US'),
  ('9ef65fa1-e04b-4098-a7b1-4ee3d535a23a'::uuid, 'US'),
  ('1f8010f2-ba3f-4f7a-b7f4-d5b60400e638'::uuid, 'US'),
  ('9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6'::uuid, 'US'),
  ('40dca29e-aa4b-4654-aada-8e29763f8521'::uuid, 'US'),
  ('c7353772-0c07-4f0d-8d20-294215125303'::uuid, 'US'),
  ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e'::uuid, 'DE'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17'::uuid, 'US'),
  ('e4d317d3-48b9-4718-ae3e-8d27147d05f5'::uuid, 'US'),
  ('8dc04d46-3430-45de-91f8-e37c8880b8a5'::uuid, 'US'),
  ('c32027b9-cfbd-4a70-bf4c-464e42790db4'::uuid, 'US');
create temp table _exp_move (id uuid primary key, slug text) on commit drop;
insert into _exp_move values
  ('ade6ff7e-df4d-4d37-a325-a2deba5f0c10'::uuid, 'it-software-saas'),
  ('3d98fbf5-c6a4-4d2d-a91a-0643e0f81c2d'::uuid, 'electronics-semiconductor'),
  ('fde6f9c3-e2a5-457f-a6f1-e184b3a57682'::uuid, 'retail-wholesale'),
  ('75f33a19-a361-457e-8fa2-cae13e8a7931'::uuid, 'retail-store'),
  ('5c4cde89-72f2-45d1-b995-4d9aeb2af583'::uuid, 'finance-insurance-sub'),
  ('86228c9f-a4c6-43c0-a618-15d05318982b'::uuid, 'finance-securities'),
  ('4f2be18a-cb77-4981-a5cf-dce81d1c06e2'::uuid, 'it-software-saas'),
  ('539af64f-ffa5-454d-b494-82731643d294'::uuid, 'media-ad-agency');

-- ① 業種の行の名前・親を変える（id と slug は変えない）
update public.ow_industries set is_active = true, display_order = 9 where slug = 'realestate-construction';  -- 既存の（無効だった）大分類を使う
update public.ow_industries set display_order = 3 where slug = 'public-npo';
update public.ow_industries set name = 'IT・インターネット' where slug = 'it-software';
update public.ow_industries set name = 'ソフトウェア・SaaS' where slug = 'it-software-saas';
update public.ow_industries set name = 'SIer・受託開発' where slug = 'it-software-sier';
update public.ow_industries set name = '通信・ネットワーク', parent_id = (select id from public.ow_industries where slug = 'it-software'), display_order = 4 where slug = 'telecom';
update public.ow_industries set name = 'ゲーム', parent_id = (select id from public.ow_industries where slug = 'it-software'), display_order = 5 where slug = 'media-game';
update public.ow_industries set name = 'メーカー' where slug = 'manufacturing';
update public.ow_industries set name = '電機・電子部品' where slug = 'electronics-semiconductor';
update public.ow_industries set name = '化学・素材' where slug = 'materials-chemicals';
update public.ow_industries set name = '商社・小売・流通' where slug = 'retail-distribution';
update public.ow_industries set name = '小売' where slug = 'retail-store';
update public.ow_industries set name = '専門商社' where slug = 'retail-wholesale';
update public.ow_industries set name = '物流', parent_id = (select id from public.ow_industries where slug = 'retail-distribution'), display_order = 6 where slug = 'logistics';
update public.ow_industries set name = '金融' where slug = 'finance-insurance';
update public.ow_industries set name = '銀行' where slug = 'finance-bank';
update public.ow_industries set name = '人材紹介・派遣' where slug = 'hr-agency';
update public.ow_industries set name = '求人メディア・採用プラットフォーム' where slug = 'hr-media-tech';
update public.ow_industries set name = '戦略・総合' where slug = 'consulting-strategy';
update public.ow_industries set name = 'IT・DX' where slug = 'consulting-it';
update public.ow_industries set name = '会計・財務' where slug = 'consulting-professional';
update public.ow_industries set name = '広告・メディア' where slug = 'media-advertising-entertainment';
update public.ow_industries set name = '出版・放送' where slug = 'media-publishing';
update public.ow_industries set name = '不動産', parent_id = (select id from public.ow_industries where slug = 'realestate-construction'), display_order = 1 where slug = 'realestate';
update public.ow_industries set name = '建設・設計', parent_id = (select id from public.ow_industries where slug = 'realestate-construction'), display_order = 2 where slug = 'construction';
update public.ow_industries set name = '医療・介護' where slug = 'healthcare';
update public.ow_industries set name = '官公庁・団体・教育' where slug = 'public-organization';
update public.ow_industries set name = '学校・教育', parent_id = (select id from public.ow_industries where slug = 'public-organization'), display_order = 2 where slug = 'education';
update public.ow_industries set aliases = array['IT・ソフトウェア']::text[] where slug = 'it-software';
update public.ow_industries set aliases = array['SaaS・業務システム']::text[] where slug = 'it-software-saas';
update public.ow_industries set aliases = array['通信']::text[] where slug = 'telecom';
update public.ow_industries set aliases = array['製造業']::text[] where slug = 'manufacturing';
update public.ow_industries set aliases = array['電子機器・半導体']::text[] where slug = 'electronics-semiconductor';
update public.ow_industries set aliases = array['小売・流通']::text[] where slug = 'retail-distribution';
update public.ow_industries set aliases = array['卸売・商社機能','商社・卸売']::text[] where slug = 'retail-wholesale';
update public.ow_industries set aliases = array['運輸・物流']::text[] where slug = 'logistics';
update public.ow_industries set aliases = array['金融・保険']::text[] where slug = 'finance-insurance';
update public.ow_industries set aliases = array['求人媒体・HRTech']::text[] where slug = 'hr-media-tech';
update public.ow_industries set aliases = array['医療・ヘルスケア']::text[] where slug = 'healthcare';
update public.ow_industries set aliases = array['公共・団体']::text[] where slug = 'public-organization';

-- ② 使わなくなる業種を無効に（行は残す・引き継ぎ先を記録。判断 #7）
update public.ow_industries set is_active = false, successor_id = null where slug = 'it-software-digital-mkt';
update public.ow_industries set is_active = false, successor_id = (select id from public.ow_industries where slug = 'electronics-semiconductor') where slug = 'it-software-hardware';
update public.ow_industries set is_active = false, successor_id = (select id from public.ow_industries where slug = 'it-software-saas') where slug = 'it-software-ai-data';
update public.ow_industries set is_active = false, successor_id = null where slug = 'it-software-other';
update public.ow_industries set is_active = false, successor_id = (select id from public.ow_industries where slug = 'electronics-semiconductor') where slug = 'machinery';
update public.ow_industries set is_active = false, successor_id = null where slug = 'energy-infrastructure';
update public.ow_industries set is_active = false, successor_id = (select id from public.ow_industries where slug = 'retail-wholesale') where slug = 'trading-wholesale';
update public.ow_industries set is_active = false, successor_id = (select id from public.ow_industries where slug = 'retail-store') where slug = 'retail-ec';
update public.ow_industries set is_active = false, successor_id = (select id from public.ow_industries where slug = 'retail-store') where slug = 'retail-other';
update public.ow_industries set is_active = false, successor_id = null where slug = 'finance-fintech';
update public.ow_industries set is_active = false, successor_id = null where slug = 'finance-other';
update public.ow_industries set is_active = false, successor_id = (select id from public.ow_industries where slug = 'hr-agency') where slug = 'hr-dispatch';
update public.ow_industries set is_active = false, successor_id = null where slug = 'hr-other';
update public.ow_industries set is_active = false, successor_id = null where slug = 'consulting-other';
update public.ow_industries set is_active = false, successor_id = null where slug = 'media-other';

-- ③ 会社の業種を付け替える（新しい行が要らない8社。PIVOT・大塚製薬・JTB は段5の有効化と同時）
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'it-software-saas') where id = 'ade6ff7e-df4d-4d37-a325-a2deba5f0c10';  -- 株式会社Quollio Technologies
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'electronics-semiconductor') where id = '3d98fbf5-c6a4-4d2d-a91a-0643e0f81c2d';  -- 株式会社キーエンス
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'retail-wholesale') where id = 'fde6f9c3-e2a5-457f-a6f1-e184b3a57682';  -- 海光電業株式会社
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'retail-store') where id = '75f33a19-a361-457e-8fa2-cae13e8a7931';  -- 株式会社ニトリ
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'finance-insurance-sub') where id = '5c4cde89-72f2-45d1-b995-4d9aeb2af583';  -- プルデンシャル生命保険株式会社
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'finance-securities') where id = '86228c9f-a4c6-43c0-a618-15d05318982b';  -- みずほ証券株式会社
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'it-software-saas') where id = '4f2be18a-cb77-4981-a5cf-dce81d1c06e2';  -- 株式会社セゾンテクノロジー
update public.ow_companies set industry_id = (select id from public.ow_industries where slug = 'media-ad-agency') where id = '539af64f-ffa5-454d-b494-82731643d294';  -- トランス・コスモス株式会社

-- ④ 事業の名前・別名・業種・区分（会社の紐付けは動かない）
update public.ow_business_domains set name = 'クラウド・インフラ', aliases = array['クラウドインフラ']::text[], display_kind = 'main' where slug = 'infra';
update public.ow_business_domains set name = 'HR Tech', aliases = array['HR・人材','HRテック']::text[], display_kind = 'main' where slug = 'hr';
update public.ow_business_domains set name = 'Webマーケティング', aliases = array['マーケティング']::text[], display_kind = 'main' where slug = 'marketing';
update public.ow_business_domains set name = 'DX推進', aliases = array['コンサルティング']::text[], display_kind = 'main' where slug = 'consulting';
update public.ow_business_domains set name = '業務効率化', aliases = array['コラボレーション','プロジェクト管理']::text[], display_kind = 'main' where slug = 'collab';
update public.ow_business_domains set name = 'リーガルテック', aliases = array['法務・契約']::text[], display_kind = 'search' where slug = 'legal';
update public.ow_business_domains set aliases = array['SFA']::text[] where slug = 'crm';
update public.ow_business_domains set industry_id = (select id from public.ow_industries where slug = 'manufacturing') where slug = 'hardware';
update public.ow_business_domains set industry_id = (select id from public.ow_industries where slug = 'consulting') where slug = 'consulting';
update public.ow_business_domains set industry_id = (select id from public.ow_industries where slug = 'it-software') where slug in ('ai','infra','devtools','security','crm','collab','project-management','erp','finance','legal','hr','marketing','marketplace');

-- ⑤ プロジェクト管理を業務効率化にまとめる（7社）
delete from public.ow_company_business_domains where company_id = 'bf24736f-fa65-4c5a-9764-98c96ace3b07' and domain_id = (select id from public.ow_business_domains where slug = 'project-management');  -- Notion: 業務効率化（旧コラボ）が主で既にある
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'collab') where company_id = 'b1d7996c-d260-4025-b495-bd1e2b9bb795' and domain_id = (select id from public.ow_business_domains where slug = 'project-management');  -- 株式会社アンドパッド
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'collab') where company_id = '0b93a8f2-d378-4d5a-aecc-9040fde2113c' and domain_id = (select id from public.ow_business_domains where slug = 'project-management');  -- スパイダープラス株式会社
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'collab') where company_id = 'd71a7da6-a769-456e-99ab-a077d89a0d43' and domain_id = (select id from public.ow_business_domains where slug = 'project-management');  -- 株式会社フォトラクション
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'collab') where company_id = '78560eee-1a82-44b8-b9f6-d9c88fb60f4b' and domain_id = (select id from public.ow_business_domains where slug = 'project-management');  -- 株式会社ダンドリワーク
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'collab') where company_id = 'fc1f7cb7-9530-4d6a-85cf-15196a4b155e' and domain_id = (select id from public.ow_business_domains where slug = 'project-management');  -- アトラシアン株式会社
update public.ow_company_business_domains set domain_id = (select id from public.ow_business_domains where slug = 'collab') where company_id = '6c218a59-a951-44ee-9003-163956376554' and domain_id = (select id from public.ow_business_domains where slug = 'project-management');  -- Asana Japan株式会社
update public.ow_business_domains set status = 'merged', merged_into = (select id from public.ow_business_domains where slug = 'collab'), is_active = false where slug = 'project-management';

-- ⑥ 事業ステージ（自動の74社＋判断した2社。候補7・空欄32は書かない）
update public.ow_companies set company_stage = 'listed' where id in ('08e4aff6-a12c-4963-ad43-960ac9e39967', '6c218a59-a951-44ee-9003-163956376554', '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4', 'a5ffac90-70aa-4242-b867-6d9334317851', 'da8cfab5-f5c2-4648-b866-895be46a1494', '1f73df31-8e55-4e70-a928-afe1150d72d0', 'aaaaaaaa-0001-0001-0001-000000000007', 'e7e9b0be-20c2-4434-afea-7a27c89332e2', '0ece9af4-96cb-443c-b8a8-0f358c8e3a64', '565b0f13-252d-44d0-8b90-e00acacf4b75', 'f8ebbe74-b647-46ea-869f-b126d1c4f316', 'bcea5e4e-94ee-4019-8ce3-237a7edf79a7', '8b9f84b0-b4be-4191-8322-07c6a2e5e91a', '4df6e844-74d6-4f50-98f9-08468a12f1dc', 'cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16', 'cb70da1c-4b3b-429b-a06b-cdc2c50172f8', '88defb4b-b18c-437b-8b7d-d41a43232af4', 'e3eafa66-02ce-4060-a5fe-57e4317c8e7c', 'b8aa0e3d-828c-4bbe-b588-88450aab5739', '6396920c-70d3-47d2-9f4e-67bc2efe262f', '20cd4ddd-f00e-4065-909d-97a317558ad3', '60304f29-e070-4ef6-9b44-8a899a411a8d', 'dcd2c652-4335-4031-b4d2-a4f22c98182b', 'fc1f7cb7-9530-4d6a-85cf-15196a4b155e', 'eccd3dfb-decd-4277-a3a4-df489d3b3e5e', 'a9de1561-eb91-4ebf-842d-f6d39865b7ef', '3efd857e-315c-4650-9727-1e5aa1245753', 'ec97fde1-6f22-4ab5-89ee-9cea0b258f2a', '943620b5-0fa2-48b4-a072-d47f900ba9f0', '829a1ea9-d577-4404-9ba7-e301680523a8', '1e541353-c177-40a9-968a-af3af14e1194', '94edfbe5-0496-4c1d-865c-d2d448232135', '87bcae88-2779-4bf7-b461-b3c8661b2764', '0a216ebb-c1fa-4d19-b066-f45e45c3ba2e', '7d186c45-ce23-4d96-8eae-cd6e7c00faee', '27988ac1-fd93-445d-a9fd-6dad74c92686', '0b93a8f2-d378-4d5a-aecc-9040fde2113c', 'dd76b17d-e3c1-44a9-b747-4ecde10b8cec', 'f4acddc0-c746-4537-9edf-6f3c1f2c90b3', 'be74d989-db8f-4be1-882c-40cf94e07fe2', 'f4a6aa23-3775-4548-981b-156e416ef6f6', '3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2', '53ea9a54-feef-413b-8a7c-e31e4def2e11', '478a9ede-ea0f-48c1-859c-d47f84d35b6b', '7baafcb1-d929-46c1-97be-b0fb580b480b', 'f201ed17-a9e2-4859-85aa-474578b2870d', '7dac3c6e-bc5f-4550-9170-4338ea809be2', '138ff010-8671-414a-ab06-752d61f50dd7', 'b8b7a2d4-20a8-4fe1-8651-61a6503f762e', '9ef65fa1-e04b-4098-a7b1-4ee3d535a23a', '1f8010f2-ba3f-4f7a-b7f4-d5b60400e638', '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6', '40dca29e-aa4b-4654-aada-8e29763f8521', 'c7353772-0c07-4f0d-8d20-294215125303', '09d67e54-0381-45c8-b698-568e1fc47033', '91523b3b-15e4-4f6b-8c9b-a90b67552b9e', '28b826eb-fb86-4124-aa08-c489cad662f1', 'c3664ef1-5571-4645-b30f-1474e7961c17', '2e54ff06-2f4d-420c-9a5c-9a80a85ca55a', 'e4d317d3-48b9-4718-ae3e-8d27147d05f5', '8dc04d46-3430-45de-91f8-e37c8880b8a5', 'c32027b9-cfbd-4a70-bf4c-464e42790db4');  -- 62社
update public.ow_companies set company_stage = 'mega_venture' where id in ('81aa95dc-2304-4faa-9c4a-f2f5454e8e11');  -- 1社
update public.ow_companies set company_stage = 'startup_growth' where id in ('ae15610d-477a-410d-b74a-54ab3e351add', 'bf24736f-fa65-4c5a-9764-98c96ace3b07', 'daa558e5-054f-4475-ab00-3817170759ce', 'fb7397eb-a9c7-4ce3-964a-d7a72159847f', 'f32e6905-f25f-4c01-b64f-c5695fd45a1d', 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df', '1413b97e-ef19-4e40-87ae-e31ac8996bdd', '4fecbf31-498c-40b0-a04e-3a6cb978433f', 'e459ac79-5dad-499d-bb65-b758d4281123', '1241f8a5-b645-4aa2-9fa1-bbfc573f1774', '355ce5c6-0412-4512-8864-1d477c97c917', 'b1d7996c-d260-4025-b495-bd1e2b9bb795', 'cb386dd2-427c-49d1-b3f8-1e1d3a921fd8');  -- 13社

-- ⑦ 外資（判断 #20・C-1/C-2）
update public.ow_companies set capital_type = 'foreign_subsidiary', parent_company_name = 'Anthropic, PBC', parent_company_country = '米国' where id = 'f32e6905-f25f-4c01-b64f-c5695fd45a1d';  -- アンソロピックジャパン合同会社
update public.ow_companies set capital_type = 'foreign_subsidiary', parent_company_name = 'Kyriba Corporation', parent_company_country = '米国' where id = 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df';  -- キリバ株式会社
update public.ow_companies set capital_type = 'foreign_subsidiary', parent_company_name = 'ClickHouse, Inc.', parent_company_country = '米国' where id = '1413b97e-ef19-4e40-87ae-e31ac8996bdd';  -- クリックハウス株式会社
update public.ow_companies set capital_type = 'foreign_subsidiary', parent_company_name = 'Gainsight, Inc.', parent_company_country = '米国' where id = '4fecbf31-498c-40b0-a04e-3a6cb978433f';  -- ゲインサイト・ジャパン株式会社
update public.ow_companies set capital_type = 'foreign_subsidiary', parent_company_name = 'Kong Inc.', parent_company_country = '米国' where id = 'e459ac79-5dad-499d-bb65-b758d4281123';  -- コング・ジャパン株式会社
update public.ow_companies set capital_type = 'foreign_subsidiary', parent_company_name = 'Xactly Corporation', parent_company_country = '米国' where id = '1241f8a5-b645-4aa2-9fa1-bbfc573f1774';  -- ザクトリー株式会社
-- 絞り込みが読む is_foreign を capital_type に揃える（読み手の切り替えは段6）
update public.ow_companies set is_foreign = true where id in ('20cd4ddd-f00e-4065-909d-97a317558ad3', '99132c64-ff07-4945-aeb6-7e21e6c256c9');
update public.ow_companies set is_foreign = false where id = 'e7e9b0be-20c2-4434-afea-7a27c89332e2';
update public.ow_companies set hq_country = 'CN' where id in ('f201ed17-a9e2-4859-85aa-474578b2870d');  -- 1社
update public.ow_companies set hq_country = 'DE' where id in ('bcea5e4e-94ee-4019-8ce3-237a7edf79a7', 'e3eafa66-02ce-4060-a5fe-57e4317c8e7c', '91523b3b-15e4-4f6b-8c9b-a90b67552b9e');  -- 3社
update public.ow_companies set hq_country = 'IE' where id in ('20cd4ddd-f00e-4065-909d-97a317558ad3');  -- 1社
update public.ow_companies set hq_country = 'NL' where id in ('1e541353-c177-40a9-968a-af3af14e1194');  -- 1社
update public.ow_companies set hq_country = 'US' where id in ('08e4aff6-a12c-4963-ad43-960ac9e39967', '6c218a59-a951-44ee-9003-163956376554', '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4', 'ae15610d-477a-410d-b74a-54ab3e351add', 'a5ffac90-70aa-4242-b867-6d9334317851', 'da8cfab5-f5c2-4648-b866-895be46a1494', '1f73df31-8e55-4e70-a928-afe1150d72d0', 'aaaaaaaa-0001-0001-0001-000000000007', '99132c64-ff07-4945-aeb6-7e21e6c256c9', '0ece9af4-96cb-443c-b8a8-0f358c8e3a64', '565b0f13-252d-44d0-8b90-e00acacf4b75', '0d4734e0-0717-475e-a6d1-806aa2cd45ff', 'bf24736f-fa65-4c5a-9764-98c96ace3b07', 'f8ebbe74-b647-46ea-869f-b126d1c4f316', 'daa558e5-054f-4475-ab00-3817170759ce', '4df6e844-74d6-4f50-98f9-08468a12f1dc', 'cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16', 'cb70da1c-4b3b-429b-a06b-cdc2c50172f8', '88defb4b-b18c-437b-8b7d-d41a43232af4', 'b8aa0e3d-828c-4bbe-b588-88450aab5739', '6396920c-70d3-47d2-9f4e-67bc2efe262f', 'dcd2c652-4335-4031-b4d2-a4f22c98182b', 'fc1f7cb7-9530-4d6a-85cf-15196a4b155e', 'eccd3dfb-decd-4277-a3a4-df489d3b3e5e', 'a9de1561-eb91-4ebf-842d-f6d39865b7ef', '3efd857e-315c-4650-9727-1e5aa1245753', 'f32e6905-f25f-4c01-b64f-c5695fd45a1d', 'ec97fde1-6f22-4ab5-89ee-9cea0b258f2a', '943620b5-0fa2-48b4-a072-d47f900ba9f0', '829a1ea9-d577-4404-9ba7-e301680523a8', 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df', '94edfbe5-0496-4c1d-865c-d2d448232135', '87bcae88-2779-4bf7-b461-b3c8661b2764', '0a216ebb-c1fa-4d19-b066-f45e45c3ba2e', '1413b97e-ef19-4e40-87ae-e31ac8996bdd', '1027a327-18c0-4191-b27b-a28bf5781126', '7d186c45-ce23-4d96-8eae-cd6e7c00faee', '4fecbf31-498c-40b0-a04e-3a6cb978433f', 'e459ac79-5dad-499d-bb65-b758d4281123', '1241f8a5-b645-4aa2-9fa1-bbfc573f1774', '27988ac1-fd93-445d-a9fd-6dad74c92686', 'dd76b17d-e3c1-44a9-b747-4ecde10b8cec', 'f4acddc0-c746-4537-9edf-6f3c1f2c90b3', 'be74d989-db8f-4be1-882c-40cf94e07fe2', 'f4a6aa23-3775-4548-981b-156e416ef6f6', '3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2', '53ea9a54-feef-413b-8a7c-e31e4def2e11', '478a9ede-ea0f-48c1-859c-d47f84d35b6b', '7baafcb1-d929-46c1-97be-b0fb580b480b', '7dac3c6e-bc5f-4550-9170-4338ea809be2', 'd6650b18-5ef2-40c9-9938-2adbad70fe2b', '9ef65fa1-e04b-4098-a7b1-4ee3d535a23a', '1f8010f2-ba3f-4f7a-b7f4-d5b60400e638', '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6', '40dca29e-aa4b-4654-aada-8e29763f8521', 'c7353772-0c07-4f0d-8d20-294215125303', 'c3664ef1-5571-4645-b30f-1474e7961c17', 'e4d317d3-48b9-4718-ae3e-8d27147d05f5', '8dc04d46-3430-45de-91f8-e37c8880b8a5', 'c32027b9-cfbd-4a70-bf4c-464e42790db4');  -- 60社

-- ⑧ ④お客さまの業界（旧 target → 新 customer。大分類へ）
insert into public.ow_company_customer_industries (company_id, industry_id)
select t.company_id, coalesce(p.id, i.id) from public.ow_company_target_industries t
  join public.ow_industries i on i.id = t.industry_id left join public.ow_industries p on p.id = i.parent_id
  join public.ow_companies c on c.id = t.company_id where c.is_test = false
on conflict do nothing;
update public.ow_companies set serves_consumers = true where is_test = false and target_industry_scope = 'consumer';
update public.ow_companies set customer_all_industries = true where is_test = false and target_industry_scope = 'horizontal';


-- ⑨ 検算
do $$
declare b record; n int;
begin
  select * into b from _before;
  if (select count(*) filter (where is_published) from public.ow_companies) <> b.published
     or (select count(*) filter (where listing_status = 'listed') from public.ow_companies) <> b.listed then
    raise exception '検算失敗: 公開／掲載の件数が変わった';
  end if;
  if (select md5(string_agg((to_jsonb(c) - array['industry_id','company_stage','capital_type','parent_company_name','parent_company_country','is_foreign','hq_country','customer_all_industries','serves_consumers','updated_at'])::text, ',' order by id)) from public.ow_companies c) <> b.companies_rest then
    raise exception '検算失敗: 変えてよい列以外が変わった';
  end if;
  if (select md5(string_agg(concat_ws('|', id, industry_id, company_stage, capital_type, is_foreign, hq_country, customer_all_industries, serves_consumers), ',' order by id))
        from public.ow_companies where is_test) <> b.test_companies then
    raise exception '検算失敗: 検証用の会社が変わった';
  end if;
  -- 業種の付け替えは8社だけ・行き先どおり
  select count(*) into n from _exp_move m join public.ow_companies c on c.id = m.id join public.ow_industries i on i.id = c.industry_id where i.slug = m.slug;
  if n <> 8 then raise exception '検算失敗: 業種の付け替えが % 社', n; end if;
  -- ステージは想定の76社だけ・値どおり
  if (select count(*) from public.ow_companies where company_stage is not null) <> 76
     or exists (select 1 from _exp_stage s join public.ow_companies c on c.id = s.id where c.company_stage is distinct from s.v) then
    raise exception '検算失敗: 事業ステージが想定と違う';
  end if;
  -- 本社の国は外資系66社だけ
  if (select count(*) from public.ow_companies where hq_country is not null) <> 66
     or exists (select 1 from _exp_hq h join public.ow_companies c on c.id = h.id where c.hq_country is distinct from h.v) then
    raise exception '検算失敗: 本社の国が想定と違う';
  end if;
  -- 外資系: 実在の会社で is_foreign と capital_type が一致。アクセンチュア入り・Indeed 外れ
  if exists (select 1 from public.ow_companies where is_test = false and is_foreign <> (capital_type = 'foreign_subsidiary')) then
    raise exception '検算失敗: is_foreign と capital_type が食い違う会社が残っている';
  end if;
  if (select count(*) from public.ow_companies where is_test = false and is_foreign) <> 66 then
    raise exception '検算失敗: 外資系が % 社（66のはず）', (select count(*) from public.ow_companies where is_test = false and is_foreign);
  end if;
  -- 事業: プロジェクト管理への紐付けが0、7社とも業務効率化が1件、ほかの会社の明細は不変
  if exists (select 1 from public.ow_company_business_domains where domain_id = (select id from public.ow_business_domains where slug = 'project-management')) then
    raise exception '検算失敗: プロジェクト管理への紐付けが残っている';
  end if;
  select count(*) into n from public.ow_company_business_domains
   where company_id in ('b1d7996c-d260-4025-b495-bd1e2b9bb795', '0b93a8f2-d378-4d5a-aecc-9040fde2113c', 'd71a7da6-a769-456e-99ab-a077d89a0d43', '78560eee-1a82-44b8-b9f6-d9c88fb60f4b', 'fc1f7cb7-9530-4d6a-85cf-15196a4b155e', '6c218a59-a951-44ee-9003-163956376554', 'bf24736f-fa65-4c5a-9764-98c96ace3b07') and domain_id = (select id from public.ow_business_domains where slug = 'collab') and is_primary;
  if n <> 7 then raise exception '検算失敗: 業務効率化が主の会社が % 社（7のはず）', n; end if;
  if (select md5(string_agg(concat_ws('|', company_id, domain_id, is_primary, display_order), ',' order by company_id, domain_id))
        from public.ow_company_business_domains where company_id not in ('b1d7996c-d260-4025-b495-bd1e2b9bb795', '0b93a8f2-d378-4d5a-aecc-9040fde2113c', 'd71a7da6-a769-456e-99ab-a077d89a0d43', '78560eee-1a82-44b8-b9f6-d9c88fb60f4b', 'fc1f7cb7-9530-4d6a-85cf-15196a4b155e', '6c218a59-a951-44ee-9003-163956376554', 'bf24736f-fa65-4c5a-9764-98c96ace3b07')) <> b.domains_rest then
    raise exception '検算失敗: ほかの会社の事業が変わった';
  end if;
  -- お客さま
  if (select count(*) from public.ow_company_customer_industries) <> 10
     or (select count(*) from public.ow_companies where serves_consumers) <> 2
     or (select count(*) from public.ow_companies where customer_all_industries) <> 71 then
    raise exception '検算失敗: お客さまの業界が想定と違う（明細 % ／個人 % ／問わない %）',
      (select count(*) from public.ow_company_customer_industries), (select count(*) from public.ow_companies where serves_consumers),
      (select count(*) from public.ow_companies where customer_all_industries);
  end if;
  -- 新しい行（段1）は無効のまま
  if exists (select 1 from public.ow_industries where slug in ('life-services','life-travel','hr-recruiting-support','consulting-hr-org','finance-vc','mfg-automotive','mfg-pharma-medical','trading-general','media-web','medical-hospital','medical-care-welfare','public-government','public-npo') and is_active)
     or (select count(*) from public.ow_business_domains where is_active) <> 14 then
    raise exception '検算失敗: 有効な行の数が想定と違う（事業 %）', (select count(*) from public.ow_business_domains where is_active);
  end if;
  -- 無効にした業種を使っている会社が無い
  if exists (select 1 from public.ow_companies c join public.ow_industries i on i.id = c.industry_id where not i.is_active) then
    raise exception '検算失敗: 無効な業種を使っている会社がある';
  end if;
  raise notice '検算OK: 業種8社・ステージ76社・本社の国66社・外資系66社・事業7社・お客さま10行／個人2／問わない71。公開 %・掲載 % は変わらず', b.published, b.listed;
end $$;

commit;
