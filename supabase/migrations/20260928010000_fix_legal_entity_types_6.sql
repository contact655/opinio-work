-- ★法人格が登記と違っていた6社を直す（2026-09-28 / 柴さんの指示）
--
-- 非掲載82社を国税庁法人番号公表サイトで当たった結果。
-- `20260927235500` で掲載中5社に当てたのと**同じ訂正を、非掲載側にも当てる。**
--
-- ⚠️★**ディレクトリには出ないが、職歴の企業ピッカーには出る。**
--    誤った法人格を選択肢として見せ続けることになるので直す。
--
-- ── 直すもの（すべて登記の商号を実際に引いて確認）──────────────────────────
--
-- | いまの name | 登記の商号 | 何が違うか |
-- |---|---|---|
-- | CrowdStrike株式会社     | クラウドストライク合同会社        | ★法人格（旧商号に株式会社の記載あり） |
-- | Snowflake Japan株式会社 | Ｓｎｏｗｆｌａｋｅ合同会社        | ★法人格 |
-- | エヌシーノ合同会社       | ｎＣｉｎｏ株式会社                | ★法人格（**逆向き**。合同→株式） |
-- | フォーティネット株式会社 | フォーティネットジャパン合同会社  | ★法人格 ＋「ジャパン」 |
-- | ノービフォー株式会社     | ＫｎｏｗＢｅ４ Ｊａｐａｎ合同会社 | ★法人格 ＋ 表記 |
-- | コンカー株式会社         | 株式会社コンカー                  | 前株／後株 |
--
-- ⚠️★**半角ラテンで入れる**（登記の全角は登記側の正規化）。`20260927235500` と同じ。
-- ⚠️ 商号がカタカナの会社（クラウドストライク／フォーティネットジャパン／コンカー）は
--    **カタカナのまま**入れる。ラテンに寄せない —— 登記がそうなっている。
--
-- ── 波及を先に実測した（2026-09-28）────────────────────────────────────────
--
-- ① **表示名は変わらない。** 6社とも `name_en` を持ち、`companyDisplayName` は
--    そちらを優先する（CrowdStrike Japan / Snowflake Japan / nCino Japan /
--    Concur Japan / KnowBe4 Japan / Fortinet Japan）。
-- ② **`normalized_name` はトリガーが作り直す。** 新しい値で
--    **他社との衝突0件・自由入力（`company_text`）との一致も0件**。
--    ⚠️ コンカーだけ値が変わらない（法人格は正規化で落ちるため）。
-- ③ **ラテンでの検索は `name_en` が拾う**（3経路とも `name_en.ilike` を見る）ので、
--    カタカナ商号に変わる会社でも `CrowdStrike` で引ける。
-- ④ ★**カタカナで探せなくなる2社にだけ `search_aliases` を足す。**
--    `nCino株式会社` と `KnowBe4 Japan合同会社` は name も name_en もラテンなので、
--    別名が無いと**カタカナで打った人に出なくなる。**
--    ⚠️ Snowflake は既に「スノーフレイク」、CrowdStrike は既に「クラウドストライク」を
--       持っているので**据え置く**（消さない）。
-- ⑤ 6社とも `listing_status='draft'` ／ 職歴0件。**求職者の一覧には元から出ていない。**
--
-- ⚠️ 作業前ダンプ: .dumps/20260928-0055-ow_companies.sql（214,999 バイト / 106行）
-- ⚠️★対象を id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 同じ列を触った直近の migration を確認した: `20260927235500` は掲載中5社のみで、
--    この6社は**含まれていない**。打ち消しにはならない。

do $$
declare
  n bigint;
begin
  -- ⚠️ 6社が「いまの名前のまま」存在することを先に確かめる。1社でも違えば中止する。
  select count(*) into n from public.ow_companies
   where (id, name) in (
     ('87bcae88-2779-4bf7-b461-b3c8661b2764'::uuid, 'CrowdStrike株式会社'),
     ('cb70da1c-4b3b-429b-a06b-cdc2c50172f8'::uuid, 'Snowflake Japan株式会社'),
     ('b8aa0e3d-828c-4bbe-b588-88450aab5739'::uuid, 'エヌシーノ合同会社'),
     ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e'::uuid, 'コンカー株式会社'),
     ('99132c64-ff07-4945-aeb6-7e21e6c256c9'::uuid, 'ノービフォー株式会社'),
     ('3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2'::uuid, 'フォーティネット株式会社')
   );
  if n <> 6 then
    raise exception '想定した社名の行が6件そろわない（%件）。中止する', n;
  end if;
end $$;

-- ① 法人格（登記: クラウドストライク合同会社）。別名「クラウドストライク」は据え置き
update public.ow_companies
   set name = 'クラウドストライク合同会社'
 where id = '87bcae88-2779-4bf7-b461-b3c8661b2764';

-- ② 法人格（登記: Ｓｎｏｗｆｌａｋｅ合同会社）。別名「スノーフレイク」は据え置き
update public.ow_companies
   set name = 'Snowflake合同会社'
 where id = 'cb70da1c-4b3b-429b-a06b-cdc2c50172f8';

-- ③ 法人格（登記: ｎＣｉｎｏ株式会社）★合同→株式の**逆向き**。カタカナを別名へ退避
update public.ow_companies
   set name = 'nCino株式会社',
       search_aliases = 'エヌシーノ'
 where id = 'b8aa0e3d-828c-4bbe-b588-88450aab5739';

-- ④ 前株／後株（登記: 株式会社コンカー）。カタカナのままなので別名は不要
update public.ow_companies
   set name = '株式会社コンカー'
 where id = '91523b3b-15e4-4f6b-8c9b-a90b67552b9e';

-- ⑤ 法人格＋表記（登記: ＫｎｏｗＢｅ４ Ｊａｐａｎ合同会社）。カタカナを別名へ退避
--    ⚠️ 登記のフリガナは「ノウビフォージャパン」。DB の旧名は「ノービフォー」。
--       **どちらで打っても出るように両方入れる**（別名は部分一致）。
update public.ow_companies
   set name = 'KnowBe4 Japan合同会社',
       search_aliases = 'ノービフォー ノウビフォージャパン'
 where id = '99132c64-ff07-4945-aeb6-7e21e6c256c9';

-- ⑥ 法人格＋「ジャパン」（登記: フォーティネットジャパン合同会社）
--    ⚠️ 新しい名前が「フォーティネット」を含むので、別名は要らない
update public.ow_companies
   set name = 'フォーティネットジャパン合同会社'
 where id = '3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2';

-- ⚠️ 検算。**件数では入れ違いを検出できない**ので id と値の組で確かめる（ui-debugging ⑱）。
do $$
declare
  r record;
  n_alias bigint;
begin
  for r in
    select c.id, c.name, c.normalized_name, coalesce(c.search_aliases,'') as aliases, v.want
      from public.ow_companies c
      join (values
        ('87bcae88-2779-4bf7-b461-b3c8661b2764'::uuid, 'クラウドストライク合同会社'),
        ('cb70da1c-4b3b-429b-a06b-cdc2c50172f8'::uuid, 'Snowflake合同会社'),
        ('b8aa0e3d-828c-4bbe-b588-88450aab5739'::uuid, 'nCino株式会社'),
        ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e'::uuid, '株式会社コンカー'),
        ('99132c64-ff07-4945-aeb6-7e21e6c256c9'::uuid, 'KnowBe4 Japan合同会社'),
        ('3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2'::uuid, 'フォーティネットジャパン合同会社')
      ) as v(id, want) on v.id = c.id
  loop
    if r.name <> r.want then
      raise exception '社名が想定と違う（%）: % / 想定 %', r.id, r.name, r.want;
    end if;
    -- ★トリガーが normalized_name を作り直しているか
    if coalesce(r.normalized_name,'') = '' then
      raise exception 'normalized_name が空（%）。トリガーが効いていない', r.name;
    end if;
    -- ★全角が混ざっていないこと（DB の既存表記に合わせる）
    if r.name ~ '[Ａ-Ｚａ-ｚ０-９]' then
      raise exception '社名に全角英数が混ざっている: %', r.name;
    end if;
    raise notice '% / normalized=% / aliases=%', r.name, r.normalized_name, r.aliases;
  end loop;

  -- ★カタカナで探せることを担保する（name も name_en もラテンになる2社）
  select count(*) into n_alias from public.ow_companies
   where id in ('b8aa0e3d-828c-4bbe-b588-88450aab5739','99132c64-ff07-4945-aeb6-7e21e6c256c9')
     and coalesce(search_aliases,'') <> '';
  if n_alias <> 2 then
    raise exception 'nCino／KnowBe4 のカタカナ別名が入っていない（%件）', n_alias;
  end if;

  -- ★既にあった別名を消していないこと（据え置きの2社）
  select count(*) into n_alias from public.ow_companies
   where id in ('87bcae88-2779-4bf7-b461-b3c8661b2764','cb70da1c-4b3b-429b-a06b-cdc2c50172f8')
     and coalesce(search_aliases,'') <> '';
  if n_alias <> 2 then
    raise exception '据え置きのはずの別名が消えている（%件）', n_alias;
  end if;

  -- ★normalized_name が他社と衝突していないこと
  select count(*) into n_alias from (
    select normalized_name from public.ow_companies
     where normalized_name in ('クラウドストライク','snowflake','ncino','コンカー',
                               'knowbe4japan','フォーティネットジャパン')
     group by normalized_name having count(*) > 1
  ) s;
  if n_alias <> 0 then
    raise exception 'normalized_name が他社と衝突した（%件）', n_alias;
  end if;
end $$;
