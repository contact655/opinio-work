-- 職種マスタに大分類「コンサルティング」を足す（2026-10-04 / 柴さんの指示）
--
-- 画面（オンボーディング2画面目の「大分類」）に無く、コンサル出身者が自分の職種を
-- 選べなかった。実測（適用前）: 大分類 18 / 小分類 136 / 全 154 行。
-- `%コンサル%` `%PMO%` に当たる既存の職種は **0件**（重複しない）。
--
-- ⚠️★**業種・事業領域の「コンサルティング」とは別の軸**。3つとも意味が違う:
--      職種（ここ）   … **その人が何をしているか**
--      業種           … その会社がどの産業か（`ow_industries`。親＋子4件）
--      事業領域       … その会社が何を作っているか（2026-09-29 に追加）
--    **統合しないこと。** 同じ語が3箇所に出るのは承知のうえ。
--
-- ⚠️ `is_it_saas = true` にしてある（親・子とも）。
--    ＝ **希望職種（`/mypage` とオンボーディング）の選択肢にも出る**。
--    IT系の受託開発・SIer まわりを想定しており、2026-09-29 に事業領域へ
--    「コンサルティング」を足したのと同じ判断。
--    ⚠️ 出したくないなら false にする。**その場合も職歴の選択肢には出る**（あちらは絞らない）。

-- ── ① 並び ────────────────────────────────────────────────────────────────
-- ⚠️★**末尾（19）ではなく 11 に差し込み、11〜18 を1つずつ後ろへずらす。**
--    `careerReasons.ts` や事業領域の「末尾に足す」とは**事情が違う**:
--      ・大分類は **1〜10 が IT/SaaS の職種（`is_it_saas`）／11〜18 が業界別**という
--        塊になっていて、末尾に足すと **IT系なのに業界別の後ろ**に並ぶ。
--      ・しかも 18 番は **「公務・その他」**。**その他より後ろに実体のある分類を置かない。**
--    ⚠️ `display_order` は順序付けにしか使っていない（値を保存している箇所は無い）。
--       **番号そのものを参照するコードを足さないこと。** 足すとこの差し込みができなくなる。
do $$
declare n int;
begin
  select count(*) into n from public.ow_roles where parent_id is null;
  if n <> 18 then raise exception '大分類が 18 のはずが %。中止する', n; end if;
end $$;

update public.ow_roles
   set display_order = display_order + 1
 where parent_id is null and display_order >= 11;

-- ── ② 大分類 ──────────────────────────────────────────────────────────────
insert into public.ow_roles (name, slug, parent_id, level, display_order, is_it_saas, is_active)
values ('コンサルティング', 'consulting', null, 1, 11, true, true);

-- ── ③ 小分類 ──────────────────────────────────────────────────────────────
-- ⚠️ 「その他◯◯」は `display_order = 22` に置く（他の大分類と同じ流儀。末尾に固定するため）。
insert into public.ow_roles (name, slug, parent_id, level, display_order, is_it_saas, is_active)
select v.name, v.slug,
       (select id from public.ow_roles where slug = 'consulting'),
       2, v.ord, true, true
  from (values
    ('戦略コンサルタント',        'strategy-consultant',  1),
    ('ITコンサルタント',          'it-consultant',        2),
    ('業務・BPRコンサルタント',   'bpr-consultant',       3),
    ('DXコンサルタント',          'dx-consultant',        4),
    ('ERP・SAPコンサルタント',    'erp-consultant',       5),
    ('セキュリティコンサルタント','security-consultant',  6),
    ('人事・組織コンサルタント',  'hr-consultant',        7),
    ('財務・会計コンサルタント',  'finance-consultant',   8),
    ('PMO',                       'pmo',                  9),
    ('その他コンサルティング',    'other-consulting',    22)
  ) as v(name, slug, ord);

-- ── ④ 検算 ────────────────────────────────────────────────────────────────
do $$
declare
  親 int; 子 int; 最後 text; 自分の子 int;
begin
  select count(*) into 親 from public.ow_roles where parent_id is null;
  if 親 <> 19 then raise exception '大分類が 19 のはずが %', 親; end if;

  select count(*) into 子 from public.ow_roles where parent_id is not null;
  if 子 <> 146 then raise exception '小分類が 146 のはずが %', 子; end if;

  select count(*) into 自分の子 from public.ow_roles
   where parent_id = (select id from public.ow_roles where slug = 'consulting');
  if 自分の子 <> 10 then raise exception 'コンサルティングの小分類が 10 のはずが %', 自分の子; end if;

  -- ★「公務・その他」が最後であること（①の理由そのもの）
  select name into 最後 from public.ow_roles
   where parent_id is null order by display_order desc limit 1;
  if 最後 <> '公務・その他' then
    raise exception '大分類の最後が「公務・その他」ではなく「%」になっている', 最後;
  end if;

  -- ★並びが 1..19 の連番であること（ずらし漏れ・重複が無い）
  if exists (
    select 1 from (
      select display_order, row_number() over (order by display_order) as rn
        from public.ow_roles where parent_id is null
    ) t where t.display_order <> t.rn
  ) then
    raise exception '大分類の display_order が 1..19 の連番になっていない';
  end if;
end $$;
