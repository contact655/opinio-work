-- ★ブランド名（brand_name）を7社に入れる（2026-11-27 / 柴さんの指定）
--
-- 表示名は companyBrandName()（brand_name → 英語社名 → 法人格を外した社名）。
-- この7社は brand_name が空で、英語社名から作った名前が日本での呼び名とずれていた
-- （例: 「Asahi Breweries, Ltd.」「Thinca」）。値は柴さんの指定どおり。
--
-- 対象: 会社IDを明示した7行の brand_name だけ。
--   ・brand_name が今も空（NULL か空白だけ）の行だけを更新する。すでに値がある行は上書きせず、NOTICE で知らせる
--   ・更新した行が7行でなければ中止する（全体をロールバック）
--   ・ほかの列は書かない。⚠️ updated_at を自動で書くトリガーは ow_companies に無い（2026-11-27 確認）
--   ⚠️ ただし trg_ow_companies_normalized_name が更新のたびに search_key（検索用の派生列）を
--      name・name_en・brand_name などから作り直すので、7行の search_key は変わる（ブランド名でも検索に当たるようになる）
--
-- 作業前ダンプ: .dumps/20261127-1400-ow_companies.sql（135行）
-- 同じ列を触った直近の migration: 20261127110000_companies_blank_strings_to_null.sql
--   （空文字を NULL にしただけ。この7社の brand_name はそれ以前から NULL で、打ち消すものは無い）
--
-- 戻し方（7行を NULL に戻す）:
--   update public.ow_companies set brand_name = null where id in (
--     '60304f29-e070-4ef6-9b44-8a899a411a8d','86228c9f-a4c6-43c0-a618-15d05318982b',
--     '28b826eb-fb86-4124-aa08-c489cad662f1','cb386dd2-427c-49d1-b3f8-1e1d3a921fd8',
--     'b8b7a2d4-20a8-4fe1-8651-61a6503f762e','a9de1561-eb91-4ebf-842d-f6d39865b7ef',
--     '27988ac1-fd93-445d-a9fd-6dad74c92686');

do $$
declare
  v_target constant jsonb := jsonb_build_object(
    '60304f29-e070-4ef6-9b44-8a899a411a8d', 'アサヒビール',                       -- アサヒビール株式会社
    '86228c9f-a4c6-43c0-a618-15d05318982b', 'みずほ証券',                         -- みずほ証券株式会社
    '28b826eb-fb86-4124-aa08-c489cad662f1', 'シンカ',                             -- 株式会社シンカ
    'cb386dd2-427c-49d1-b3f8-1e1d3a921fd8', 'フライル',                           -- 株式会社フライル
    'b8b7a2d4-20a8-4fe1-8651-61a6503f762e', '富士フイルムビジネスイノベーション', -- 富士フイルムビジネスイノベーションジャパン株式会社
    'a9de1561-eb91-4ebf-842d-f6d39865b7ef', 'AWS',                                -- アマゾン ウェブ サービス ジャパン合同会社
    '27988ac1-fd93-445d-a9fd-6dad74c92686', 'Cisco'                               -- シスコシステムズ合同会社
  );
  v_exists int;
  v_filled record;
  v_updated int;
begin
  -- ① 7社がすべて実在するか
  select count(*) into v_exists
    from public.ow_companies c
   where c.id in (select k::uuid from jsonb_object_keys(v_target) k);
  if v_exists <> 7 then
    raise exception '対象の会社が % 社しか見つからない（7社のはず）。中止', v_exists;
  end if;

  -- ② すでに brand_name が入っている行は上書きしない（知らせるだけ）
  for v_filled in
    select c.id, c.name, c.brand_name
      from public.ow_companies c
     where c.id in (select k::uuid from jsonb_object_keys(v_target) k)
       and c.brand_name is not null and btrim(c.brand_name) <> ''
  loop
    raise notice '上書きしない: % (%) にはすでに brand_name「%」が入っている', v_filled.name, v_filled.id, v_filled.brand_name;
  end loop;

  -- ③ 空の行だけを更新
  update public.ow_companies c
     set brand_name = v_target ->> c.id::text
   where c.id in (select k::uuid from jsonb_object_keys(v_target) k)
     and (c.brand_name is null or btrim(c.brand_name) = '');
  get diagnostics v_updated = row_count;

  -- ④ 7行でなければ中止
  if v_updated <> 7 then
    raise exception '更新した行が % 行（7行のはず）。中止してロールバックする', v_updated;
  end if;

  -- ⑤ 検算: 7社の brand_name が指定どおりか
  if exists (
    select 1 from public.ow_companies c
     where c.id in (select k::uuid from jsonb_object_keys(v_target) k)
       and c.brand_name is distinct from (v_target ->> c.id::text)
  ) then
    raise exception '検算に失敗: brand_name が指定と一致しない行がある。中止';
  end if;

  raise notice 'brand_name を % 社に入れた', v_updated;
end
$$;
