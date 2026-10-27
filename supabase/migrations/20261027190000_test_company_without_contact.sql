-- ★検証用の会社「【テスト】担当者なし株式会社」を作る（2026-10-27 / 話を聞きたい人 フェーズ1a・柴さんの了承済み）
--
-- 目的: 担当者がいない会社で「話を聞いてみたい」を押す → 記録と運営への通知だけ →
--       担当者が登録されたら届く、の経路を検証用アカウントで確かめる。
--       既存の検証用の掲載企業（Third Box・サンプルワークス）はどちらも検証用の担当者がいるので、この経路を通せない。
--
-- ・is_test = true（求職者側の一覧・集計からは除外される。人の流れ・遷移検索・/home の集計は isAggregatableUser /
--   is_test の除外を通る）
-- ・掲載中（listed / is_published / is_approved）。業種は IT・インターネット、主の事業領域は ai（Third Box と同じ）
-- ・担当者（ow_company_admins）は作らない
-- ・検証が終わったら listing_status = 'draft' に戻す（消さない）
--
-- 作業前ダンプ: .dumps/20261027-1758-ow_companies-ow_company_business_domains.sql（ow_companies 132行 / ow_company_business_domains 116行）
-- 戻し方: update ow_companies set listing_status = 'draft' where id = 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19';

do $$
declare
  v_id constant uuid := 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19';
  v_industry constant uuid := 'c0bfc2c3-2bf1-44dc-b0cf-5b9d46dab701'; -- IT・インターネット
  v_domain uuid;
  v_before int;
begin
  select count(*) into v_before from ow_companies;
  if v_before <> 132 then raise exception '想定外: ow_companies が % 行（想定 132）', v_before; end if;
  if exists (select 1 from ow_companies where id = v_id or slug = 'test-no-contact') then
    raise exception '既にある';
  end if;
  select id into v_domain from ow_business_domains where slug = 'ai' and is_active;
  if v_domain is null then raise exception '事業領域 ai が無い'; end if;

  insert into ow_companies (id, name, slug, industry_id, is_test, is_published, listing_status, is_approved, published_at, tagline, description, phase)
  values (v_id, '【テスト】担当者なし株式会社', 'test-no-contact', v_industry, true, true, 'listed', true, now(),
          '検証用の会社です（担当者なし）',
          '「話を聞いてみたい」の検証のために作った会社です。実在しません。担当者は登録していません。',
          'non_listed');

  insert into ow_company_business_domains (company_id, domain_id, is_primary) values (v_id, v_domain, true);

  if (select count(*) from ow_companies) <> 133 then raise exception '件数が合わない'; end if;
  if exists (select 1 from ow_company_admins where company_id = v_id) then raise exception '担当者がいる'; end if;
end $$;
