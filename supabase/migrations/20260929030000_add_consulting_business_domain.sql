-- 事業領域に「コンサルティング」を足す（2026-09-29 / 柴さんの指示）
--
-- ── ⚠️★同じ語が業種にもある。承知のうえで足す ──────────────────────────
-- `ow_industries` に **親「コンサルティング」（slug: consulting）＋ 子4件**
-- （戦略・経営 / IT・システム / 会計・税務・法務 / その他コンサル）が既にある。
-- ＝ **同じ語が2つの軸に出る。** CLAUDE.md が「ずれるたびに『どれの話か』を確かめる
--    手間が全員に乗る」と書いている形にあたる。
--
-- ★それでも足す理由: **IT系の業種は全部 `requires_business_domain = true`** で、
--   受託開発・SIer / その他IT の会社も**事業領域を1件選ばないと掲載できない。**
--   ところが既存14件はすべて**製品カテゴリ**（AI・データ / CRM・営業支援 …）で、
--   「顧客のシステムを作る・導入を支援する」会社に当てはまるものが1つも無かった。
--   ＝ **選べないのに必須**という状態だった。
--   ⚠️ 業種「コンサルティング」側は `requires_business_domain = false` なので、
--      戦略コンサル等はそもそも事業領域を求められない。**埋まらないのは IT 側だけ。**
--
-- ⚠️★**CLAUDE.md の「この判断を覆す条件」に当たる。**
--    「事業領域の選択肢に**製品カテゴリでないもの**が入り始めたら、ラベルを
--     『製品・サービス領域』に寄せる」と書いてある。**ラベルは今回変えていない**
--    （求職者側4箇所に及ぶので別の判断）。次に同種のものを足すときに決めること。
--
-- ⚠️ `/companies` の事業領域チップは**マスタ全件**を出す（2026-09-14 の例外）。
--    ＝ **足した瞬間にチップが1つ増え、当面は押すと0社。** 意図どおり。
--    フッター・sitemap・LP は `getBusinessDomainFacets()`（0社は返さない）なので
--    **中身の無いURLは増えない。**
--
-- ⚠️ `display_order` は **末尾（16）**。15 は解体済みの「業種特化」が使っている。
--    ★**途中に差し込まないこと** ——既存の並びが動くと、選択率の前後比較ができなくなる。
--
-- ⚠️ `?industry=consulting` は新しいキー。`LEGACY_KEYS` にも既存 slug にも
--    `consulting` は無いので**衝突しない**（実測）。
--
-- ── 直近に `ow_business_domains` を触った migration ──────────────────────
-- `20260906140000`（「業種特化」を is_active=false）／ `20260907…`（その明細を削除）。
-- **どちらも別の行で、打ち消していない。**

begin;

-- ① 事前チェック
do $$
declare v_total int; v_active int;
begin
  select count(*), count(*) filter (where is_active) into v_total, v_active
    from public.ow_business_domains;
  if v_total <> 15 or v_active <> 14 then
    raise exception '中止: ow_business_domains が想定（全15件 / 有効14件）と違う（実際 % / %）', v_total, v_active;
  end if;
  if exists (select 1 from public.ow_business_domains where slug = 'consulting') then
    raise exception '中止: slug=consulting が既に存在する（適用済みか、別の変更が入っている）';
  end if;
end $$;

insert into public.ow_business_domains (name, slug, description, display_order, is_active)
values (
  'コンサルティング',
  'consulting',
  /* ⚠️ 説明文は `/biz` のチップの tooltip と `/admin` に出る。
        **業種の「コンサルティング」との違い**を書いておかないと取り違える。 */
  '顧客のシステム開発・IT導入の支援そのものを提供する（受託開発・SI・ITコンサル）。'
  '⚠ 自社プロダクトを持つ会社は、そのプロダクトの領域を選ぶ。'
  '⚠ 業種の「コンサルティング」とは別の軸（あちらは会社の業界、これは提供しているもの）。',
  16,
  true
);

-- ② 事後チェック
do $$
declare v_active int; v_order int;
begin
  select count(*) filter (where is_active) into v_active from public.ow_business_domains;
  if v_active <> 15 then
    raise exception '中止: 有効な事業領域が想定（15件）と違う（実際 %件）', v_active;
  end if;

  select display_order into v_order from public.ow_business_domains where slug = 'consulting';
  if v_order <> 16 then
    raise exception '中止: display_order が 16 でない（実際 %）', v_order;
  end if;

  -- ★既存14件の並びが動いていないこと（途中に差し込んでいない）
  if (select count(*) from public.ow_business_domains
       where is_active and display_order between 1 and 14) <> 14 then
    raise exception '中止: 既存の並びが動いている';
  end if;

  raise notice 'OK: 事業領域に「コンサルティング」を追加（有効15件 / display_order 16）';
end $$;

commit;

-- ── 戻し方 ────────────────────────────────────────────────────────────────
-- ⚠️ 明細（ow_company_business_domains）が付いてからは delete しないこと。
--    その場合は update ... set is_active = false（マスタは論理削除を正とする）。
-- delete from public.ow_business_domains where slug = 'consulting';
