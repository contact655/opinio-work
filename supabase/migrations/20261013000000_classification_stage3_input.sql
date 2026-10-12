-- ════════════════════════════════════════════════════════════════════════
-- 会社の分類 段3：入力の準備（2026-10-12 / 柴さんの判断。段3〜5はまとめて作り、最後に1回で出す）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★会社のデータ・画面に出るものは変えない。変えるのはマスタの「印」と RPC の判定だけ。
--
-- ① ow_industries.retired_at … 段2で使わなくなった業種（と元から無効だった「インターネット・Webサービス」）に印を付ける。
--    これで「無効」が2つの意味（使わなくなった／まだ出していない＝段1で入れた新しい行）に割れていたのを分ける。
--    入力の選択肢は「retired_at が空」の行（＝今の有効な行＋出す前の新しい行）。公開側は今までどおり is_active。
-- ② 「業種特化」（vertical。2026-09-06 に下げた事業）を status='rejected' に。入力の選択肢（status='active'）から外すため
-- ③ set_company_business_domains: 受け付ける事業を is_active ではなく status で判定する
--      status='active'（運営が認めたもの。出す前の新しい行を含む）
--      status='pending' かつ その会社が追加したもの（ow_business_domain_proposals）
--    ⚠️ いま本番で動いている画面は有効な行しか出さないので、この変更で挙動は変わらない
--    ⚠️ 新しい行を公開側に出すか（is_active）は最後の migration（段3〜5の出荷）で決める
-- ════════════════════════════════════════════════════════════════════════

begin;

create temp table _before on commit drop as
select
  (select md5(string_agg((to_jsonb(c) - 'updated_at')::text, ',' order by id)) from public.ow_companies c) as companies,
  (select md5(string_agg(concat_ws('|', company_id, domain_id, is_primary, display_order), ',' order by company_id, domain_id)) from public.ow_company_business_domains) as links,
  (select count(*) filter (where is_published) from public.ow_companies) as published,
  (select count(*) filter (where listing_status = 'listed') from public.ow_companies) as listed;

alter table public.ow_industries add column retired_at timestamptz;
comment on column public.ow_industries.retired_at is
  '使わなくなった業種（引き継ぎ先は successor_id）。入力の選択肢は retired_at が空の行。公開側に出すかは is_active';

update public.ow_industries set retired_at = now()
 where is_active = false
   and slug not in ('life-services','life-travel','hr-recruiting-support','consulting-hr-org','finance-vc','mfg-automotive',
                    'mfg-pharma-medical','trading-general','media-web','medical-hospital','medical-care-welfare',
                    'public-government','public-npo');

update public.ow_business_domains set status = 'rejected' where slug = 'vertical';

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

  SELECT coalesce(array_agg(DISTINCT d), '{}'::uuid[])
    INTO v_ids
    FROM unnest(coalesce(p_domain_ids, '{}'::uuid[])) AS d;

  v_count := coalesce(array_length(v_ids, 1), 0);

  -- ★最大3件（lib/companies/businessDomains.ts の MAX_BUSINESS_DOMAINS_PER_COMPANY と同じ値）
  IF v_count > 3 THEN
    RAISE EXCEPTION '事業領域は 3 件までです' USING ERRCODE = '22023';
  END IF;

  -- ★運営が認めた事業（status='active'）か、この会社が追加して確認待ちの事業（2026-10-12 から status で判定）
  IF v_count > 0 THEN
    SELECT count(*) INTO v_valid
      FROM ow_business_domains m
     WHERE m.id = ANY(v_ids)
       AND (m.status = 'active'
            OR (m.status = 'pending' AND EXISTS (
                  SELECT 1 FROM ow_business_domain_proposals p
                   WHERE p.domain_id = m.id AND p.company_id = p_company_id)));
    IF v_valid <> v_count THEN
      RAISE EXCEPTION '選べない事業が含まれています' USING ERRCODE = '22023';
    END IF;
  END IF;

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

  DELETE FROM ow_company_business_domains WHERE company_id = p_company_id;

  IF v_count > 0 THEN
    INSERT INTO ow_company_business_domains (company_id, domain_id, is_primary, display_order)
    SELECT p_company_id,
           m.id,
           (m.id = p_primary_domain_id),
           row_number() OVER (ORDER BY (m.id = p_primary_domain_id) DESC, m.display_order, m.name)
      FROM ow_business_domains m
     WHERE m.id = ANY(v_ids);
  END IF;

  RETURN v_count;
END $function$;

do $$
declare b record; n int;
begin
  select * into b from _before;
  if (select md5(string_agg((to_jsonb(c) - 'updated_at')::text, ',' order by id)) from public.ow_companies c) <> b.companies
     or (select md5(string_agg(concat_ws('|', company_id, domain_id, is_primary, display_order), ',' order by company_id, domain_id)) from public.ow_company_business_domains) <> b.links
     or (select count(*) filter (where is_published) from public.ow_companies) <> b.published
     or (select count(*) filter (where listing_status = 'listed') from public.ow_companies) <> b.listed then
    raise exception '検算失敗: 会社または事業の紐付けが変わった';
  end if;
  select count(*) into n from public.ow_industries where retired_at is not null;
  if n <> 16 then raise exception '検算失敗: 使わなくなった業種が % 行（16のはず）', n; end if;
  if exists (select 1 from public.ow_companies c join public.ow_industries i on i.id = c.industry_id where i.retired_at is not null) then
    raise exception '検算失敗: 使わなくなった業種に会社が残っている';
  end if;
  raise notice '検算OK: retired 16行・会社と事業の紐付けは不変（公開 %・掲載 %）', b.published, b.listed;
end $$;

commit;
