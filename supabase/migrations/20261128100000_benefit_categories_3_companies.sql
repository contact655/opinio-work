-- ★福利厚生にカテゴリを入れる（2026-11-28 / 柴さんの指示）
--
-- 対象は福利厚生の値がある3社だけ（2026-11-28 実測で3社・29項目。id を明示列挙する）。
--   ・株式会社セールスフォース・ジャパン（c3664ef1-…）10件 … 柴さんが渡した分類表のとおり
--   ・スマートキャンプ株式会社（d079cdfe-…）9件 … たたき台を柴さんが了承
--   ・【テスト】株式会社サンプルワークス（ce44864d-…、is_test）10件 … たたき台を柴さんが了承
--
-- 形: ow_companies.benefits の各項目に "category" を足すだけ（列は増やさない）。
--     値は src/lib/companies/benefits.ts の BENEFIT_CATEGORIES のキー
--     （money / time_off / workstyle / learning / health / family / other）。
--
-- ⚠️ 項目は名前の完全一致で突き合わせる。1件でも一致しない項目がある会社があれば、
--    何も書かずに中止する（名前が変わっていたら推測で当てない）。
-- ⚠️ 項目の並び・name・detail は変えない。category だけを足す。
-- ⚠️ 同じ列を触った直近の migration: 20260831030000_benefits_to_jsonb.sql（text[] → jsonb）。
--    打ち消すものではないことを確認した。
-- ⚠️ draft_data の中の benefits は触らない（3社とも下書きに benefits の値は無い。2026-11-28 実測）。
--
-- 戻し方: 各項目から category を外す
--   update ow_companies set benefits = (select jsonb_agg(e - 'category' order by o) from jsonb_array_elements(benefits) with ordinality t(e, o))
--    where id in ('c3664ef1-5571-4645-b30f-1474e7961c17','d079cdfe-f8f1-49db-b871-117651136362','ce44864d-5e66-4684-8723-29282e3d6f5c');

begin;

create temp table _benefit_cat (company_id uuid, name text, category text) on commit drop;

insert into _benefit_cat (company_id, name, category) values
  -- セールスフォース・ジャパン
  ('c3664ef1-5571-4645-b30f-1474e7961c17', '確定拠出年金（401k相当）', 'money'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17', 'RSU（譲渡制限付き株式）', 'money'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17', 'ボランティア休暇（年7日）', 'time_off'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17', 'フルフレックス制度', 'workstyle'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17', 'リモートワーク可（ハイブリッド）', 'workstyle'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17', 'Ohana Groups（社内コミュニティ）', 'workstyle'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17', '書籍・学習費用補助', 'learning'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17', '各種社会保険完備', 'health'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17', 'ウェルネス費用補助', 'health'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17', '育児・介護休暇制度', 'family'),
  -- スマートキャンプ
  ('d079cdfe-f8f1-49db-b871-117651136362', '住宅手当（オフィスから1.5km圏内または通勤15分以内で月1〜2万円）', 'money'),
  ('d079cdfe-f8f1-49db-b871-117651136362', '引越し祝い金10万円', 'money'),
  ('d079cdfe-f8f1-49db-b871-117651136362', '社員紹介手当', 'money'),
  ('d079cdfe-f8f1-49db-b871-117651136362', '確定拠出年金', 'money'),
  ('d079cdfe-f8f1-49db-b871-117651136362', '夏季休暇3日・冬季休暇2日', 'time_off'),
  ('d079cdfe-f8f1-49db-b871-117651136362', 'フレックスタイム制（コアタイム10:00〜16:00）', 'workstyle'),
  ('d079cdfe-f8f1-49db-b871-117651136362', '書籍購入制度（業務書籍全額会社負担）', 'learning'),
  ('d079cdfe-f8f1-49db-b871-117651136362', '予防接種手当（インフルエンザ全額会社負担）', 'health'),
  ('d079cdfe-f8f1-49db-b871-117651136362', 'オンライン診療（ファストドクター・AndL）', 'health'),
  -- 【テスト】サンプルワークス
  ('ce44864d-5e66-4684-8723-29282e3d6f5c', '確定拠出年金', 'money'),
  ('ce44864d-5e66-4684-8723-29282e3d6f5c', 'ストックオプション', 'money'),
  ('ce44864d-5e66-4684-8723-29282e3d6f5c', '在宅勤務手当（月5,000円）', 'money'),
  ('ce44864d-5e66-4684-8723-29282e3d6f5c', 'リフレッシュ休暇（勤続3年ごとに5日）', 'time_off'),
  ('ce44864d-5e66-4684-8723-29282e3d6f5c', 'フレックスタイム制（コアタイム 11:00-15:00）', 'workstyle'),
  ('ce44864d-5e66-4684-8723-29282e3d6f5c', 'リモートワーク可（週2出社）', 'workstyle'),
  ('ce44864d-5e66-4684-8723-29282e3d6f5c', '副業可（届出制）', 'workstyle'),
  ('ce44864d-5e66-4684-8723-29282e3d6f5c', '書籍購入補助（月1万円まで）', 'learning'),
  ('ce44864d-5e66-4684-8723-29282e3d6f5c', 'カンファレンス参加費の全額補助', 'learning'),
  ('ce44864d-5e66-4684-8723-29282e3d6f5c', '人間ドック補助（年1回）', 'health');

do $$
declare
  r record;
  v_items int;
  v_matched int;
  v_unmatched text;
begin
  for r in select distinct company_id from _benefit_cat loop
    select jsonb_array_length(benefits) into v_items from ow_companies where id = r.company_id;
    if v_items is null then
      raise exception '中止: % の benefits が空です', r.company_id;
    end if;
    -- DB の項目のうち、表に無い名前（＝一致しない項目）
    select string_agg(e->>'name', ' / ') into v_unmatched
      from ow_companies c, jsonb_array_elements(c.benefits) e
     where c.id = r.company_id
       and not exists (select 1 from _benefit_cat b where b.company_id = r.company_id and b.name = e->>'name');
    if v_unmatched is not null then
      raise exception '中止: % に名前が一致しない項目があります: %', r.company_id, v_unmatched;
    end if;
    -- 表の項目のうち、DB に無い名前
    select string_agg(b.name, ' / ') into v_unmatched
      from _benefit_cat b
     where b.company_id = r.company_id
       and not exists (select 1 from ow_companies c, jsonb_array_elements(c.benefits) e where c.id = r.company_id and e->>'name' = b.name);
    if v_unmatched is not null then
      raise exception '中止: % の DB に無い項目があります: %', r.company_id, v_unmatched;
    end if;
    select count(*) into v_matched from _benefit_cat where company_id = r.company_id;
    if v_matched <> v_items then
      raise exception '中止: % の件数が合いません（DB % 件 / 表 % 件）', r.company_id, v_items, v_matched;
    end if;
  end loop;
end $$;

update ow_companies c
   set benefits = (
     select jsonb_agg(e || jsonb_build_object('category', b.category) order by o)
       from jsonb_array_elements(c.benefits) with ordinality t(e, o)
       join _benefit_cat b on b.company_id = c.id and b.name = e->>'name'
   )
 where c.id in ('c3664ef1-5571-4645-b30f-1474e7961c17','d079cdfe-f8f1-49db-b871-117651136362','ce44864d-5e66-4684-8723-29282e3d6f5c');

-- 検算: 29項目すべてに category が入り、項目数は変わっていない
do $$
declare v_total int; v_cat int;
begin
  select count(*), count(*) filter (where e ? 'category') into v_total, v_cat
    from ow_companies c, jsonb_array_elements(c.benefits) e
   where c.id in ('c3664ef1-5571-4645-b30f-1474e7961c17','d079cdfe-f8f1-49db-b871-117651136362','ce44864d-5e66-4684-8723-29282e3d6f5c');
  if v_total <> 29 or v_cat <> 29 then
    raise exception '検算に失敗: 項目 % 件 / category あり % 件（どちらも 29 のはず）', v_total, v_cat;
  end if;
end $$;

commit;
