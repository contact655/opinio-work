-- ★Jamf Japan合同会社 の企業情報を公開情報で埋める（2026-11-04 / 柴さんの指示）
--
-- ── 経緯 ────────────────────────────────────────────────────────────────────
-- 2026-11-04 に実在の利用者が職歴の入力から作った会社（source='user'）。
-- 業種（ソフトウェア・SaaS）だけで、英語名・HP・説明・事業領域などが空だった。
-- ⚠️ **一覧への掲載はしない**（listing_status='draft' のまま。柴さんの指示）。承認も触らない。
--
-- ── 出典（2026-11-04 に確認） ──────────────────────────────────────────────
-- ・国税庁 法人番号公表サイト（法人番号 2010401128965）
--     商号 Ｊａｍｆ　Ｊａｐａｎ合同会社（ジャムフジャパン）
--     所在地 東京都千代田区丸の内２丁目４番１号丸の内ビルディング２８階（2025-12-12 に移転）
--     旧商号 Ｊａｍｆ　Ｊａｐａｎ株式会社（2021-03-02 に合同会社へ）。閉鎖の記載なし
--     https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=2010401128965
-- ・Jamf 公式（日本語）会社概要: 2002年創立・製品構成
--     https://www.jamf.com/ja/about/
-- ・Jamf 公式プレスリリース（Beth Tschida の CEO 就任）: Francisco Partners による買収が
--   2026年1月に完了し非公開企業になった／Jamf の名前のまま・本社はミネアポリス
--     https://www.jamf.com/resources/press-releases/jamf-names-beth-tschida-as-chief-executive-officer/
--
-- ── 入れないもの（推測値を入れない） ────────────────────────────────────────
-- ・employee_count / employee_count_band … 日本法人の人数を示す公開情報が見つからない
-- ・founded_year … 日本法人の設立年が公開情報で確定できない（2002年は米国 Jamf の創立）
-- ・logo_url … Storage へのアップロードが要るので別の作業にする（いまは頭文字で出る）
-- ・nearest_station / branch_locations / main_customers / customer_cases
--
-- ⚠️ phase は最終親会社で判定する（CLAUDE.md「phase カラムの定義」）。
--    2026年1月に NASDAQ から上場廃止 → 'non_listed'。
-- ⚠️ 事業領域の主は「セキュリティ」（Okta・ゼットスケーラー・フォーティネットと同じ）。
--    デバイス管理に専用の事業領域が無く、製品の柱の1つが Jamf Protect（エンドポイント保護）のため。
-- ⚠️ 作業前ダンプ: .dumps/20261104-1941-ow_companies-ow_company_business_domains-ow_company_data_sources.sql
--    （305,430 バイト / ow_companies 134行・ow_company_business_domains 117行・ow_company_data_sources 96行）
-- ⚠️ 対象は id で明示列挙する。同じ会社を触った migration は無い（本日作成の会社）。

do $$
declare
  n bigint;
begin
  select count(*) into n
    from public.ow_companies
   where id = '12d4c216-d0ea-4517-99f7-de0272553e48'
     and name = 'Jamf Japan合同会社'
     and listing_status = 'draft'
     and is_test = false
     and description is null
     and url is null;
  -- ⚠️ 想定と違えば中止する（利用者や別セッションが先に埋めていた場合など）
  if n <> 1 then
    raise exception 'Jamf Japan が想定の状態（draft / 説明とHPが空）で見つからない（%件）。中止する', n;
  end if;
  if exists (select 1 from public.ow_company_business_domains
              where company_id = '12d4c216-d0ea-4517-99f7-de0272553e48') then
    raise exception 'Jamf Japan に事業領域が既にある。中止する';
  end if;
end $$;

update public.ow_companies
   set name_en                = 'Jamf Japan',
       url                    = 'https://www.jamf.com/ja/',
       tagline                = 'Apple製デバイスを企業・学校でまとめて管理する',
       description            = 'Mac・iPhone・iPad などApple製デバイスの管理とセキュリティを専門とするJamfの日本法人。デバイス管理の「Jamf Pro」「Jamf School」、エンドポイント保護の「Jamf Protect」、アクセス管理の「Jamf Connect」などを、企業・教育機関・行政機関に提供している。'
                                || E'\n\n'
                                || 'Jamfは2002年に米国で創立。2026年1月に投資会社 Francisco Partners による買収が完了し、NASDAQ への上場を終えて非公開企業となった。',
       headquarters_address   = '東京都千代田区丸の内2-4-1 丸の内ビルディング28階',
       capital_type           = 'foreign_subsidiary',
       parent_company_name    = 'Jamf',
       parent_company_country = '米国',
       capital_notes          = '2026年1月に Francisco Partners が買収し、NASDAQ の上場を終えて非公開化',
       phase                  = 'non_listed',
       is_foreign             = true,
       main_products          = array[
         'Jamf Pro（企業・高等教育向けデバイス管理）',
         'Jamf School（小中高向けデバイス管理）',
         'Jamf Now（中小企業向けデバイス管理）',
         'Jamf Protect（エンドポイント保護）',
         'Jamf Connect（アイデンティティ・アクセス管理）'
       ],
       search_aliases         = 'ジャムフ ジャムフジャパン'
 where id = '12d4c216-d0ea-4517-99f7-de0272553e48';

insert into public.ow_company_business_domains (company_id, domain_id, is_primary, display_order)
select '12d4c216-d0ea-4517-99f7-de0272553e48', d.id, true, 0
  from public.ow_business_domains d
 where d.slug = 'security' and d.is_active;

insert into public.ow_company_data_sources (company_id, field, source_kind, source_url, verified_at, note)
values
  ('12d4c216-d0ea-4517-99f7-de0272553e48', 'headquarters_address', 'registry',
   'https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=2010401128965',
   now(), '法人番号 2010401128965。2025-12-12 に虎ノ門から移転'),
  ('12d4c216-d0ea-4517-99f7-de0272553e48', 'phase', 'official_site',
   'https://www.jamf.com/resources/press-releases/jamf-names-beth-tschida-as-chief-executive-officer/',
   now(), '2026年1月に Francisco Partners による買収が完了し非公開化')
on conflict (company_id, field) do update
  set source_kind = excluded.source_kind, source_url = excluded.source_url,
      verified_at = excluded.verified_at, note = excluded.note, updated_at = now();

-- ⚠️ 検算。掲載・公開・承認を動かしていないことも見る
do $$
declare
  r record;
  dom_n bigint;
  src_n bigint;
  listed_n bigint;
begin
  select listing_status, is_published, is_approved, url, phase, description
    into r from public.ow_companies where id = '12d4c216-d0ea-4517-99f7-de0272553e48';
  if r.listing_status <> 'draft' or r.is_published is not true or r.is_approved is not false then
    raise exception '掲載・公開・承認が動いている: % / % / %', r.listing_status, r.is_published, r.is_approved;
  end if;
  if r.url is null or r.phase <> 'non_listed' or r.description not like '%' || E'\n\n' || '%' then
    raise exception '値が入っていない: url=% phase=%', r.url, r.phase;
  end if;
  select count(*) into dom_n from public.ow_company_business_domains
   where company_id = '12d4c216-d0ea-4517-99f7-de0272553e48' and is_primary;
  if dom_n <> 1 then
    raise exception '主の事業領域が1件でない: %', dom_n;
  end if;
  select count(*) into src_n from public.ow_company_data_sources
   where company_id = '12d4c216-d0ea-4517-99f7-de0272553e48';
  if src_n <> 2 then
    raise exception '出典が2件でない: %', src_n;
  end if;
  select count(*) into listed_n from public.ow_companies
   where listing_status = 'listed' and is_test is not true;
  if listed_n <> 21 then
    raise exception '掲載社数が想定（21）と違う: %', listed_n;
  end if;
  raise notice 'Jamf Japan: 事業領域(主)=% / 出典=% / 掲載社数=%（変化なし）', dom_n, src_n, listed_n;
end $$;
