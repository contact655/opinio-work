-- ════════════════════════════════════════════════════════════════════════
-- 会社の分類を「4つの質問」に作り直す — 段1：マスタの器（追加のみ）（2026-10-12 / 柴さんの判断）
-- ════════════════════════════════════════════════════════════════════════
--
-- 経緯と判断: docs/classification-step0-20261012.md（§3-5 の21個・提案A/B/C・§5 段1）
--
-- ★この段は**追加だけ**。画面に出るもの・実在の会社のデータは1つも変えない。
--   ・新しい業種・事業はすべて **is_active = false** で入れる（選択肢にも公開面にも出ない）。
--     段2で既存の行の名前・親を変え、新しい行を有効にし、会社を付け替える。
--   ・既存の行（業種53・事業16）は名前も親も変えない（段2で一覧を出して止まってから）
--   ・ow_companies に足す列はすべて空（NULL／false）で生まれる
--   ・公開状態・掲載状態は前後で同じであることを最後に確かめる（提案B）
--
-- 使い回す既存の行（段2で名前・親を変える。id と slug は変えない）:
--   業種 IT・ソフトウェア→IT・インターネット、SaaS・業務システム→ソフトウェア・SaaS、受託開発・SIer→SIer・受託開発、
--        通信→IT›通信・ネットワーク、メディア›ゲーム→IT›ゲーム、製造業→メーカー、電子機器・半導体→電機・電子部品、
--        素材・化学→化学・素材、小売・流通→商社・小売・流通、卸売・商社機能→専門商社、小売店舗→小売、運輸・物流→商社›物流、
--        金融・保険→金融、銀行・信金→銀行、人材紹介→人材紹介・派遣、求人媒体・HRTech→求人メディア・採用プラットフォーム、
--        戦略・経営→戦略・総合、IT・システム→IT・DX、会計・税務・法務→会計・財務、メディア・広告・エンタメ→広告・メディア、
--        メディア・出版→出版・放送、（無効）不動産・建設→不動産・建設、不動産・建設→その子に、建設→建設・設計、
--        医療・ヘルスケア→医療・介護、公共・団体→官公庁・団体・教育、教育→その子 学校・教育、
--        飲食・外食→生活・サービス›飲食、エンタメ・映像・音楽→生活・サービス›エンタメ・レジャー、その他サービス→生活・サービスの子
--   事業 ai/infra(クラウド・インフラ)/crm/hr(HR Tech)/marketing(Webマーケティング)/security/collab(業務効率化)/
--        devtools/erp/finance(会計ソフト)/legal(リーガルテック)/hardware(半導体)/consulting(DX推進)
--   ⚠️ だから「会計ソフト」「HR Tech」などはここでは作らない（作ると段2の改名が UNIQUE(name) で落ちる）
--
-- 作らないもの（判断どおり）: search の 総合商社（#16）・不動産管理（#13）。
--   SFA は CRM・営業支援の別名（段2）、医薬品・医療機器は業種の別名（#15）、ベンチャーキャピタルはスタートアップ投資の別名（#10）。
--
-- 事前の実測（2026-10-12）: ow_industries 53行 / ow_business_domains 16行 / ow_companies UPDATE 列単位 149/158
-- 作業前ダンプ: .dumps/ に ow_industries ow_business_domains ow_company_business_domains ow_company_target_industries ow_companies
-- ════════════════════════════════════════════════════════════════════════

begin;

create temp table _before on commit drop as
select
  (select md5(string_agg(concat_ws('|', id, is_published, listing_status, industry_id, phase, capital_type, is_foreign, parent_company_country), ',' order by id)) from public.ow_companies) as companies,
  (select count(*) filter (where is_published) from public.ow_companies) as published,
  (select count(*) filter (where listing_status = 'listed') from public.ow_companies) as listed,
  (select md5(string_agg(concat_ws('|', id, name, slug, parent_id, display_order, is_active, requires_business_domain), ',' order by id)) from public.ow_industries) as industries,
  (select md5(string_agg(concat_ws('|', id, name, slug, display_order, is_active), ',' order by id)) from public.ow_business_domains) as domains,
  (select md5(string_agg(concat_ws('|', company_id, domain_id, is_primary, display_order), ',' order by company_id, domain_id)) from public.ow_company_business_domains) as company_domains,
  (select md5(string_agg(concat_ws('|', company_id, industry_id, is_primary), ',' order by company_id, industry_id)) from public.ow_company_target_industries) as company_targets,
  (select count(*) from public.ow_industries) as n_ind,
  (select count(*) from public.ow_business_domains) as n_dom;

do $$ begin
  if (select n_ind from _before) <> 53 or (select n_dom from _before) <> 16 then
    raise exception '中止: マスタの件数が想定と違う（業種 % / 事業 %）', (select n_ind from _before), (select n_dom from _before);
  end if;
end $$;

-- ① 業種: 別名と、段2で使う「引き継ぎ先」
alter table public.ow_industries
  add column aliases text[] not null default '{}',
  add column successor_id uuid references public.ow_industries(id) on delete set null;
comment on column public.ow_industries.aliases is '検索だけに使う別名（例: 医薬品・医療機器 ← 医薬品／医療機器）。画面には出さない';
comment on column public.ow_industries.successor_id is '無効にした業種の引き継ぎ先（段2で入れる）。?target= の救済などに使う';

-- ② 事業: 業種・表示の区分・状態・別名・親・統合先
alter table public.ow_business_domains
  add column industry_id uuid references public.ow_industries(id) on delete restrict,
  add column display_kind text not null default 'main' check (display_kind in ('main', 'search')),
  add column status text not null default 'active' check (status in ('active', 'pending', 'merged', 'rejected')),
  add column aliases text[] not null default '{}',
  add column parent_domain_id uuid references public.ow_business_domains(id) on delete set null,
  add column merged_into uuid references public.ow_business_domains(id) on delete set null,
  add constraint ow_business_domains_merged_check check ((status = 'merged') = (merged_into is not null)),
  add constraint ow_business_domains_parent_not_self check (parent_domain_id is null or parent_domain_id <> id);
comment on column public.ow_business_domains.industry_id is '属する業種（大分類）。main のチップはこの業種を選んだときに出す';
comment on column public.ow_business_domains.display_kind is 'main=業種を選んだときにチップで出す / search=検索したときだけ出す';
comment on column public.ow_business_domains.status is 'active=運営が認めたもの / pending=企業が追加して運営の確認待ち / merged=別の事業にまとめた / rejected=採らなかった。⚠️ 公開面に出すかは今も is_active で決める';
comment on column public.ow_business_domains.aliases is '検索だけに使う別名（例: HR Tech ← HRテック）';
comment on column public.ow_business_domains.parent_domain_id is 'search の事業が属する main（例: 生命保険 → 保険）';
comment on column public.ow_business_domains.merged_into is 'status=merged のときのまとめ先';

-- ②' 企業が追加した事業の申請記録（誰が・どの会社が）。⚠️ 運営専用（RLS 有効・ポリシー0本・GRANT 無し）
--    ow_business_domains に列で持つと anon に読める（SELECT がテーブル単位）ので、別の表にする
create table public.ow_business_domain_proposals (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.ow_business_domains(id) on delete cascade,
  company_id uuid not null references public.ow_companies(id) on delete cascade,
  proposed_by uuid references public.ow_users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.ow_users(id) on delete set null
);
create index ow_business_domain_proposals_domain_idx on public.ow_business_domain_proposals (domain_id);
alter table public.ow_business_domain_proposals enable row level security;
revoke all on public.ow_business_domain_proposals from anon, authenticated;
comment on table public.ow_business_domain_proposals is '企業がその場で追加した事業の記録。運営の確認画面だけが読む（admin クライアント）';

-- ③ 会社: 事業ステージ（新7段）・本社の国・お客さま（業界を問わない／個人）
alter table public.ow_companies
  add column company_stage text check (company_stage in
    ('startup_early', 'startup_growth', 'ipo_prep', 'listed', 'mega_venture', 'sme', 'large')),
  add column hq_country text check (hq_country ~ '^[A-Z]{2}$'),
  add column customer_all_industries boolean not null default false,
  add column serves_consumers boolean not null default false;
comment on column public.ow_companies.company_stage is '事業ステージ（新7段）。listed=自社または親会社が上場している。旧 phase は残す（段7で扱いを決める）';
comment on column public.ow_companies.hq_country is '本社の国（ISO 3166-1 alpha-2）。外資系のときだけ入れる';
comment on column public.ow_companies.customer_all_industries is '④主なお客さまの業界で「業界を問わない」を選んだ（空欄＝未確認と区別する）';
comment on column public.ow_companies.serves_consumers is '④主なお客さまに「個人のお客さま」を含む';
-- ⚠️ ow_companies の UPDATE は列単位 GRANT。足した列は同じ migration で配る（CLAUDE.md）
grant update (company_stage, hq_country, customer_all_industries, serves_consumers) on public.ow_companies to authenticated;

-- ③' ④主なお客さまの業界（大分類だけ・何件でも）。旧 ow_company_target_industries は段7まで残す
create table public.ow_company_customer_industries (
  company_id uuid not null references public.ow_companies(id) on delete cascade,
  industry_id uuid not null references public.ow_industries(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (company_id, industry_id)
);
create index ow_company_customer_industries_industry_idx on public.ow_company_customer_industries (industry_id);
alter table public.ow_company_customer_industries enable row level security;
grant select on public.ow_company_customer_industries to anon, authenticated;
grant insert, update, delete on public.ow_company_customer_industries to authenticated;
-- 読み: 旧 ow_company_target_industries と同じ形
create policy company_customer_industries_anon_read on public.ow_company_customer_industries for select to anon
  using (exists (select 1 from public.ow_companies c where c.id = company_id and c.is_published = true and c.is_test = false));
create policy company_customer_industries_auth_read on public.ow_company_customer_industries for select to authenticated
  using (exists (select 1 from public.ow_companies c where c.id = company_id and c.is_published = true and c.is_test = false)
         or public.auth_company_can(company_id, 'member') or public.auth_is_admin());
-- 書き: いまは運営だけ（企業側の入力は段3で決める）
create policy company_customer_industries_admin_insert on public.ow_company_customer_industries for insert to authenticated
  with check (public.auth_is_admin());
create policy company_customer_industries_admin_update on public.ow_company_customer_industries for update to authenticated
  using (public.auth_is_admin()) with check (public.auth_is_admin());
create policy company_customer_industries_admin_delete on public.ow_company_customer_industries for delete to authenticated
  using (public.auth_is_admin());

-- 大分類だけを受ける（値の集合の制約。UI・API と合わせて3層で守る）
create function public.ow_company_customer_industries_top_only() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.ow_industries where id = new.industry_id and parent_id is not null) then
    raise exception 'お客さまの業界は大分類から選んでください' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function public.ow_company_customer_industries_top_only() from public, anon, authenticated;
create trigger trg_ow_company_customer_industries_top_only
  before insert or update of industry_id on public.ow_company_customer_industries
  for each row execute function public.ow_company_customer_industries_top_only();
-- 生成: scratchpad/gen_s1.py（新しい業種 13 行・事業 main 43・search 135 行）

-- ③ 新しい業種（無効のまま）
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('life-services', '生活・サービス', null, 19, false, false, '{}'::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('life-travel', '旅行・観光', (select id from public.ow_industries where slug = 'life-services'), 1, false, false, '{}'::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('hr-recruiting-support', '採用支援・人事コンサル', (select id from public.ow_industries where slug = 'hr-services'), 5, false, false, '{}'::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('consulting-hr-org', '人事・組織', (select id from public.ow_industries where slug = 'consulting'), 5, false, false, '{}'::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('finance-vc', 'ベンチャーキャピタル', (select id from public.ow_industries where slug = 'finance-insurance'), 6, false, false, array['VC']::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('mfg-automotive', '自動車・輸送機器', (select id from public.ow_industries where slug = 'manufacturing'), 5, false, false, '{}'::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('mfg-pharma-medical', '医薬品・医療機器', (select id from public.ow_industries where slug = 'manufacturing'), 6, false, false, array['医薬品','医療機器','製薬']::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('trading-general', '総合商社', (select id from public.ow_industries where slug = 'retail-distribution'), 5, false, false, '{}'::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('media-web', 'Webメディア', (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 6, false, false, '{}'::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('medical-hospital', '病院・クリニック', (select id from public.ow_industries where slug = 'healthcare'), 1, false, false, '{}'::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('medical-care-welfare', '介護・福祉', (select id from public.ow_industries where slug = 'healthcare'), 2, false, false, '{}'::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('public-government', '官公庁・自治体', (select id from public.ow_industries where slug = 'public-organization'), 1, false, false, '{}'::text[]);
insert into public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain, aliases) values ('public-npo', 'NPO・団体', (select id from public.ow_industries where slug = 'public-organization'), 2, false, false, '{}'::text[]);

-- ④ 新しい事業（無効のまま）
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('フィンテック', 'fintech-it', 101, false, (select id from public.ow_industries where slug = 'it-software'), 'main', 'active', array['FinTech']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ヘルスケアIT', 'healthcare-it', 102, false, (select id from public.ow_industries where slug = 'it-software'), 'main', 'active', array['ヘルステック','HealthTech']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('EdTech', 'edtech', 103, false, (select id from public.ow_industries where slug = 'it-software'), 'main', 'active', array['エドテック']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('人材紹介', 'recruitment-agency', 101, false, (select id from public.ow_industries where slug = 'hr-services'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('エグゼクティブサーチ', 'executive-search', 102, false, (select id from public.ow_industries where slug = 'hr-services'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('人材派遣', 'staffing', 103, false, (select id from public.ow_industries where slug = 'hr-services'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('求人メディア', 'job-media', 104, false, (select id from public.ow_industries where slug = 'hr-services'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ダイレクトリクルーティング', 'direct-recruiting', 105, false, (select id from public.ow_industries where slug = 'hr-services'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('採用支援・RPO', 'rpo', 106, false, (select id from public.ow_industries where slug = 'hr-services'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('研修・組織開発', 'training-od', 107, false, (select id from public.ow_industries where slug = 'hr-services'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('戦略立案', 'strategy', 101, false, (select id from public.ow_industries where slug = 'consulting'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('業務改善', 'operations-improvement', 102, false, (select id from public.ow_industries where slug = 'consulting'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('M&A・財務', 'ma-finance', 103, false, (select id from public.ow_industries where slug = 'consulting'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('人事・組織', 'hr-org', 104, false, (select id from public.ow_industries where slug = 'consulting'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('決済', 'payments', 101, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('融資', 'lending', 102, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('資産運用', 'asset-management', 103, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('保険', 'insurance', 104, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('スタートアップ投資', 'venture-investment', 105, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'main', 'active', array['ベンチャーキャピタル','VC']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('電子部品', 'electronic-components', 101, false, (select id from public.ow_industries where slug = 'manufacturing'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('自動車部品', 'auto-parts', 102, false, (select id from public.ow_industries where slug = 'manufacturing'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('産業機械', 'industrial-machinery', 103, false, (select id from public.ow_industries where slug = 'manufacturing'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('消費財', 'consumer-goods', 104, false, (select id from public.ow_industries where slug = 'manufacturing'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('研究開発', 'r-and-d', 105, false, (select id from public.ow_industries where slug = 'manufacturing'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('輸出入', 'import-export', 101, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('店舗運営', 'store-operations', 102, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('EC', 'e-commerce', 103, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'main', 'active', array['ネット通販','通信販売']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('物流・倉庫', 'logistics-warehouse', 104, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('広告運用', 'ad-operations', 101, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('Webメディア', 'web-media', 102, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('SNS・インフルエンサー', 'sns-influencer', 103, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('出版', 'publishing', 104, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('イベント', 'events', 105, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('不動産売買・仲介', 'real-estate-brokerage', 101, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('不動産管理', 'property-management', 102, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('建設', 'building-construction', 103, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('設計', 'architectural-design', 104, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('医療サービス', 'medical-services', 101, false, (select id from public.ow_industries where slug = 'healthcare'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('介護サービス', 'care-services', 102, false, (select id from public.ow_industries where slug = 'healthcare'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('調剤薬局', 'dispensing-pharmacy', 103, false, (select id from public.ow_industries where slug = 'healthcare'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('行政', 'public-administration', 101, false, (select id from public.ow_industries where slug = 'public-organization'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('教育', 'education-services', 102, false, (select id from public.ow_industries where slug = 'public-organization'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('社会課題の解決', 'social-impact', 103, false, (select id from public.ow_industries where slug = 'public-organization'), 'main', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('経費精算', 'expense-management', 501, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('労務・給与計算', 'payroll-labor', 502, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('勤怠管理', 'attendance-management', 503, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('電子契約', 'e-contract', 504, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('MA・メール配信', 'marketing-automation', 505, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', array['MA','マーケティングオートメーション']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ノーコード', 'no-code', 506, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('RPA', 'rpa', 507, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('IoT', 'iot', 508, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ロボティクス', 'robotics', 509, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('自動運転', 'autonomous-driving', 510, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ドローン', 'drones', 511, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ブロックチェーン', 'blockchain', 512, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('メタバース', 'metaverse', 513, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('マッチングアプリ', 'dating-apps', 514, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('フードデリバリー', 'food-delivery', 515, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('家事代行マッチング', 'home-services-matching', 516, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('スキルシェア', 'skill-sharing', 517, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('フリマアプリ', 'flea-market-apps', 518, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('動画配信', 'video-streaming', 519, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('電子書籍', 'e-books', 520, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('オンライン診療', 'telemedicine', 521, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('プログラミングスクール', 'coding-schools', 522, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('PropTech（不動産テック）', 'proptech', 523, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', array['PropTech','不動産テック']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('建設テック', 'construction-tech', 524, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('物流テック', 'logistics-tech', 525, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('AgriTech（農業）', 'agritech', 526, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', array['AgriTech','アグリテック']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('GovTech（行政）', 'govtech', 527, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', array['GovTech']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('クリエイター支援', 'creator-economy', 528, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ファンコミュニティ', 'fan-community', 529, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ふるさと納税サイト', 'furusato-nozei', 530, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('旅行予約サイト', 'travel-booking', 531, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('口コミ・比較サイト', 'review-comparison', 532, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('受託開発', 'contract-development', 533, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('システム運用・保守', 'system-operations', 534, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('データセンター', 'data-centers', 535, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('通信キャリア', 'telecom-carriers', 536, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('スマホゲーム', 'mobile-games', 537, false, (select id from public.ow_industries where slug = 'it-software'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('新卒紹介', 'new-grad-placement', 501, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ハイクラス転職', 'executive-career', 502, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('副業・業務委託マッチング', 'side-job-matching', 503, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('フリーランスエージェント', 'freelance-agency', 504, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('派遣（IT）', 'staffing-it', 505, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('派遣（製造）', 'staffing-manufacturing', 506, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('派遣（介護）', 'staffing-care', 507, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('外国人材の紹介', 'foreign-talent', 508, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('キャリアコーチング', 'career-coaching', 509, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('再就職支援', 'outplacement', 510, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('アルバイト求人', 'part-time-jobs', 511, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('採用代行（RPO）', 'recruitment-outsourcing', 512, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', array['採用代行']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('適性検査', 'aptitude-tests', 513, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('社員研修', 'corporate-training', 514, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('福利厚生代行', 'benefits-outsourcing', 515, false, (select id from public.ow_industries where slug = 'hr-services'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('経営コンサル', 'management-consulting', 501, false, (select id from public.ow_industries where slug = 'consulting'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ITコンサル', 'it-consulting', 502, false, (select id from public.ow_industries where slug = 'consulting'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('SAP導入', 'sap-implementation', 503, false, (select id from public.ow_industries where slug = 'consulting'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('会計コンサル', 'accounting-consulting', 504, false, (select id from public.ow_industries where slug = 'consulting'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('事業承継・M&A仲介', 'ma-advisory', 505, false, (select id from public.ow_industries where slug = 'consulting'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('PMI支援', 'pmi-support', 506, false, (select id from public.ow_industries where slug = 'consulting'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('マーケティング支援', 'marketing-support', 507, false, (select id from public.ow_industries where slug = 'consulting'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('営業代行', 'sales-outsourcing', 508, false, (select id from public.ow_industries where slug = 'consulting'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('カスタマーサポート代行', 'cs-outsourcing', 509, false, (select id from public.ow_industries where slug = 'consulting'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('BPO', 'bpo', 510, false, (select id from public.ow_industries where slug = 'consulting'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('クレジットカード', 'credit-cards', 501, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('QRコード決済', 'qr-payments', 502, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ネット証券', 'online-brokerage', 503, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('暗号資産', 'crypto-assets', 504, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'search', 'active', array['仮想通貨']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('生命保険', 'life-insurance', 505, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('損害保険', 'non-life-insurance', 506, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('少額短期保険', 'small-amount-insurance', 507, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('リース', 'leasing', 508, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ファクタリング', 'factoring', 509, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('クラウドファンディング', 'crowdfunding', 510, false, (select id from public.ow_industries where slug = 'finance-insurance'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('家電', 'home-appliances', 501, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('化粧品', 'cosmetics', 502, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('日用品', 'daily-goods', 503, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('食品', 'food-products', 504, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('飲料', 'beverages', 505, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('アパレル', 'apparel', 506, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('家具・インテリア', 'furniture-interior', 507, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('スポーツ用品', 'sporting-goods', 508, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('玩具', 'toys', 509, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('精密機器', 'precision-instruments', 510, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('鉄鋼', 'steel', 511, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('化学品', 'chemicals', 512, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('建材', 'building-materials', 513, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('D2Cブランド', 'd2c-brands', 514, false, (select id from public.ow_industries where slug = 'manufacturing'), 'search', 'active', array['D2C']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('食品卸', 'food-wholesale', 501, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('医薬品卸', 'pharma-wholesale', 502, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('スーパー', 'supermarkets', 503, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('コンビニ', 'convenience-stores', 504, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ドラッグストア', 'drugstores', 505, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('百貨店', 'department-stores', 506, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('アパレル小売', 'apparel-retail', 507, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('通販', 'mail-order', 508, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('倉庫・3PL', 'warehousing-3pl', 509, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', array['3PL']::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('運送', 'trucking', 510, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('輸入車販売', 'imported-car-sales', 511, false, (select id from public.ow_industries where slug = 'retail-distribution'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('テレビ', 'tv-broadcasting', 501, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ラジオ', 'radio', 502, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('新聞', 'newspapers', 503, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('雑誌', 'magazines', 504, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('PR・広報代行', 'pr-agency', 505, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('デジタル広告', 'digital-advertising', 506, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('SEO', 'seo', 507, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('動画制作', 'video-production', 508, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('YouTuber事務所', 'creator-agency', 509, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('音楽', 'music', 510, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('映画', 'film', 511, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('アニメ', 'anime', 512, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('イベント運営', 'event-management', 513, false, (select id from public.ow_industries where slug = 'media-advertising-entertainment'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('不動産仲介', 'real-estate-agency', 501, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('不動産開発', 'real-estate-development', 502, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('リフォーム', 'renovation', 503, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('住宅メーカー', 'home-builders', 504, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('シェアオフィス', 'shared-offices', 505, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('民泊', 'vacation-rentals', 506, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('ゼネコン', 'general-contractors', 507, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('設計事務所', 'design-firms', 508, false, (select id from public.ow_industries where slug = 'realestate-construction'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('病院', 'hospitals', 501, false, (select id from public.ow_industries where slug = 'healthcare'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('クリニック', 'clinics', 502, false, (select id from public.ow_industries where slug = 'healthcare'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('歯科', 'dental', 503, false, (select id from public.ow_industries where slug = 'healthcare'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('薬局', 'pharmacies', 504, false, (select id from public.ow_industries where slug = 'healthcare'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('介護施設', 'care-facilities', 505, false, (select id from public.ow_industries where slug = 'healthcare'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('訪問介護', 'home-care', 506, false, (select id from public.ow_industries where slug = 'healthcare'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('保育', 'childcare', 507, false, (select id from public.ow_industries where slug = 'healthcare'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('障がい福祉', 'disability-welfare', 508, false, (select id from public.ow_industries where slug = 'healthcare'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('フィットネス', 'fitness', 509, false, (select id from public.ow_industries where slug = 'healthcare'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('美容クリニック', 'aesthetic-clinics', 510, false, (select id from public.ow_industries where slug = 'healthcare'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('自治体', 'local-governments', 501, false, (select id from public.ow_industries where slug = 'public-organization'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('大学', 'universities', 502, false, (select id from public.ow_industries where slug = 'public-organization'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('学習塾', 'cram-schools', 503, false, (select id from public.ow_industries where slug = 'public-organization'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('英会話スクール', 'english-schools', 504, false, (select id from public.ow_industries where slug = 'public-organization'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('NPO', 'npo', 505, false, (select id from public.ow_industries where slug = 'public-organization'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('業界団体', 'industry-associations', 506, false, (select id from public.ow_industries where slug = 'public-organization'), 'search', 'active', '{}'::text[]);
insert into public.ow_business_domains (name, slug, display_order, is_active, industry_id, display_kind, status, aliases) values ('スポーツクラブ（プロチーム）', 'pro-sports-teams', 507, false, (select id from public.ow_industries where slug = 'public-organization'), 'search', 'active', array['プロスポーツ']::text[]);

-- ⑤ search の親（判断 #11 保険・#14 人材紹介／人材派遣）
update public.ow_business_domains set parent_domain_id = (select id from public.ow_business_domains where name = '人材紹介') where slug = 'new-grad-placement';
update public.ow_business_domains set parent_domain_id = (select id from public.ow_business_domains where name = '人材紹介') where slug = 'executive-career';
update public.ow_business_domains set parent_domain_id = (select id from public.ow_business_domains where name = '人材派遣') where slug = 'staffing-it';
update public.ow_business_domains set parent_domain_id = (select id from public.ow_business_domains where name = '人材派遣') where slug = 'staffing-manufacturing';
update public.ow_business_domains set parent_domain_id = (select id from public.ow_business_domains where name = '人材派遣') where slug = 'staffing-care';
update public.ow_business_domains set parent_domain_id = (select id from public.ow_business_domains where name = '人材紹介') where slug = 'foreign-talent';
update public.ow_business_domains set parent_domain_id = (select id from public.ow_business_domains where name = '保険') where slug = 'life-insurance';
update public.ow_business_domains set parent_domain_id = (select id from public.ow_business_domains where name = '保険') where slug = 'non-life-insurance';

-- 想定件数: industries +13 / domains +178 / parents 8

-- ⑥ 事業は最大3件（それまで API だけで見ていた。入口の RPC でも止める — 調査 §4-3）
create or replace function public.set_company_business_domains(p_company_id uuid, p_domain_ids uuid[], p_primary_domain_id uuid)
 returns integer
 language plpgsql
 set search_path to 'public'
as $function$
DECLARE
  v_ids   uuid[];
  v_count integer;
  v_valid integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ow_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION '企業が見つかりません' USING ERRCODE = '22023';
  END IF;

  -- 重複を落とす（同じ領域を2回送られても1行にする）
  SELECT coalesce(array_agg(DISTINCT d), '{}'::uuid[])
    INTO v_ids
    FROM unnest(coalesce(p_domain_ids, '{}'::uuid[])) AS d;

  v_count := coalesce(array_length(v_ids, 1), 0);

  -- ★最大3件（lib/companies/businessDomains.ts の MAX_BUSINESS_DOMAINS_PER_COMPANY と同じ値）
  IF v_count > 3 THEN
    RAISE EXCEPTION '事業領域は 3 件までです' USING ERRCODE = '22023';
  END IF;

  -- すべてマスタに実在し、有効であること
  IF v_count > 0 THEN
    SELECT count(*) INTO v_valid
      FROM ow_business_domains
     WHERE id = ANY(v_ids) AND is_active = true;
    IF v_valid <> v_count THEN
      RAISE EXCEPTION '事業領域マスタに無い、または無効な id が含まれています'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 主はちょうど1件。0件なら主は無し
  IF v_count = 0 THEN
    IF p_primary_domain_id IS NOT NULL THEN
      RAISE EXCEPTION '事業領域が0件のときは主を指定できません' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_primary_domain_id IS NULL THEN
      RAISE EXCEPTION '主の事業領域を1つ選んでください' USING ERRCODE = '22023';
    END IF;
    IF NOT (p_primary_domain_id = ANY(v_ids)) THEN
      RAISE EXCEPTION '主の事業領域は、選んだ事業領域の中から指定してください'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ⚠️ `WHERE true` ではなく company_id で必ず絞る
  DELETE FROM ow_company_business_domains WHERE company_id = p_company_id;

  IF v_count > 0 THEN
    INSERT INTO ow_company_business_domains (company_id, domain_id, is_primary, display_order)
    SELECT p_company_id,
           m.id,
           (m.id = p_primary_domain_id),
           -- 主を先頭にし、あとはマスタの並び順
           row_number() OVER (ORDER BY (m.id = p_primary_domain_id) DESC, m.display_order, m.name)
      FROM ow_business_domains m
     WHERE m.id = ANY(v_ids);
  END IF;

  RETURN v_count;
END $function$;

-- ⑦ 検算（提案B）: 会社の公開・掲載・分類は1つも変わっていない／既存のマスタ行も変わっていない／新しい行はすべて無効
do $$
declare b record;
begin
  select * into b from _before;
  if (select md5(string_agg(concat_ws('|', id, is_published, listing_status, industry_id, phase, capital_type, is_foreign, parent_company_country), ',' order by id)) from public.ow_companies) <> b.companies then
    raise exception '検算失敗: 会社の公開・掲載・分類の列が変わった';
  end if;
  if (select count(*) filter (where is_published) from public.ow_companies) <> b.published
     or (select count(*) filter (where listing_status = 'listed') from public.ow_companies) <> b.listed then
    raise exception '検算失敗: 公開／掲載の件数が変わった';
  end if;
  if (select md5(string_agg(concat_ws('|', id, name, slug, parent_id, display_order, is_active, requires_business_domain), ',' order by id))
        from public.ow_industries where created_at < now()) is distinct from b.industries then
    raise exception '検算失敗: 既存の業種が変わった';
  end if;
  if (select md5(string_agg(concat_ws('|', id, name, slug, display_order, is_active), ',' order by id))
        from public.ow_business_domains where created_at < now()) is distinct from b.domains then
    raise exception '検算失敗: 既存の事業が変わった';
  end if;
  if (select md5(string_agg(concat_ws('|', company_id, domain_id, is_primary, display_order), ',' order by company_id, domain_id)) from public.ow_company_business_domains) is distinct from b.company_domains
     or (select md5(string_agg(concat_ws('|', company_id, industry_id, is_primary), ',' order by company_id, industry_id)) from public.ow_company_target_industries) is distinct from b.company_targets then
    raise exception '検算失敗: 会社の事業・お客さまの明細が変わった';
  end if;
  if (select count(*) from public.ow_industries) <> b.n_ind + 13 or (select count(*) from public.ow_business_domains) <> b.n_dom + 178 then
    raise exception '検算失敗: 追加した行数が想定と違う（業種 % / 事業 %）', (select count(*) from public.ow_industries), (select count(*) from public.ow_business_domains);
  end if;
  if exists (select 1 from public.ow_industries where created_at >= now() and is_active)
     or exists (select 1 from public.ow_business_domains where created_at >= now() and is_active) then
    raise exception '検算失敗: 新しい行に有効なものがある';
  end if;
  if (select count(*) from public.ow_business_domains where parent_domain_id is not null) <> 8 then
    raise exception '検算失敗: search の親が8件でない';
  end if;
  if exists (select 1 from public.ow_business_domains where created_at >= now() and industry_id is null) then
    raise exception '検算失敗: 業種の付いていない新しい事業がある';
  end if;
  if not has_column_privilege('authenticated', 'public.ow_companies', 'company_stage', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ow_business_domain_proposals', 'SELECT')
     or has_table_privilege('anon', 'public.ow_business_domain_proposals', 'SELECT') then
    raise exception '検算失敗: 権限が想定と違う';
  end if;
  raise notice '検算OK: 業種 +13・事業 +178（すべて無効）。会社の公開 %・掲載 % は変わらず', b.published, b.listed;
end $$;

commit;
