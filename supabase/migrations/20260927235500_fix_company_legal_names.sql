-- ★登記の商号と食い違っていた5社の `name` を直す（2026-09-27 / 柴さんの指示）
--
-- 掲載22社すべてを国税庁法人番号公表サイト（一次情報）で当たった結果。
-- **閉鎖は1社（マルケト。20260927235000 で非掲載にした）だけ**で、残り21社は現存。
-- そのうち **5社で商号が DB と食い違っていた。**
--
-- ── 直すもの（すべて登記の商号を実際に引いて確認）──────────────────────────
--
-- | 法人番号 | いまの name | 登記の商号 | 何が違うか |
-- |---|---|---|---|
-- | 9010401107327 | Box Japan株式会社      | 株式会社Ｂｏｘ Ｊａｐａｎ | **前株／後株** |
-- | 7010003029533 | Datadog Japan株式会社  | Ｄａｔａｄｏｇ Ｊａｐａｎ合同会社 | ★**法人格**（株式会社→合同会社） |
-- | 2010401104446 | Zendesk株式会社        | 合同会社Ｚｅｎｄｅｓｋ | ★**法人格＋前株／後株** |
-- | 6010001207629 | オクタ・ジャパン株式会社 | Ｏｋｔａ Ｊａｐａｎ株式会社 | 表記（カタカナ→ラテン） |
-- | 5010401142385 | ウォークミー株式会社    | ＷａｌｋＭｅ株式会社 | 表記（カタカナ→ラテン） |
--
-- ⚠️ Datadog と Zendesk は **株式会社ではなく合同会社**。これは表記ゆれではなく
--    **事実の誤り**。Zendesk は登記に「旧商号 株式会社Ｚｅｎｄｅｓｋ」とあり、
--    **株式会社から合同会社へ組織変更**している（閉鎖印は無く現存）。
--
-- ⚠️★**半角ラテンで入れる。** 登記は全角（Ｂｏｘ）だが、これは登記側の正規化で、
--    DB の既存表記は半角（`Asana Japan株式会社` / `Databricks Japan株式会社`）。
--    **全角を持ち込むと同じ列に2つの表記が混ざる。**
--
-- ── 波及を先に実測した（2026-09-27）────────────────────────────────────────
--
-- ① **表示名は変わらない。** `companyDisplayName(name, name_en)` は `name_en` が
--    あればそちらを使う（lib/companies/displayName.ts）。5社とも `name_en` を持つ。
-- ② **`normalized_name` はトリガーが作り直す**（`trg_ow_companies_normalized_name`）。
--    Box / Datadog / Zendesk は値が変わらない（法人格は落とされるため）。
--    ★**オクタとウォークミーだけ変わる**（オクタジャパン→oktajapan / ウォークミー→walkme）。
--    ⚠️ その2社は `ow_experiences.company_text`（自由入力）との一致が**現在0件**なので、
--       いま壊れる突き合わせは無い。UNIQUE 制約も無く、衝突する他社も無い。
-- ③ ★**カタカナで探せなくなるのを `search_aliases` で防ぐ。**
--    検索3経路（`/api/companies/lookup` / `/api/companies/search` /
--    `/api/search/suggest`）はいずれも `search_aliases.ilike` を見ている。
--    Box / Datadog / Zendesk は既にカタカナ別名を持つ（ボックス / データドッグ /
--    ゼンデスク）ので**据え置き**。オクタとウォークミーは NULL だったので**入れる。**
-- ④ コードから社名を文字列で直接参照している箇所は **0件**
--    （対照に `companyDisplayName` を引いて 41件出ることを確かめたうえでの0件）。
--
-- ⚠️★**`normalize_company_name` はカタカナ別名を見ない。** ③で守れるのは
--    ピッカー・サジェストの**検索**だけで、スカウトのブロック判定
--    （`can_send_scout()` 条件2b）は `normalized_name` の一致で見る。
--    ＝ 今後「ウォークミー」と**自由入力**した人は在籍企業として自動一致しなくなる。
--    現時点で該当0件なので実害は無いが、**別名まで見る形にするかは別の判断。**
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-2347-ow_companies.sql（214,721 バイト / 106行）
-- ⚠️★対象を id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 同じ列を触った直近の migration を確認した: `20260813093000_fill_name_en_5_companies.sql`
--    は `name_en` だけで `name` は触っていない。打ち消しにはならない。

do $$
declare
  n bigint;
begin
  -- ⚠️ 5社が「いまの名前のまま」存在することを先に確かめる。
  --    1社でも違えば中止する（別セッションが先に直していた場合など）。
  select count(*) into n from public.ow_companies
   where (id, name) in (
     ('c7353772-0c07-4f0d-8d20-294215125303'::uuid, 'Box Japan株式会社'),
     ('a5ffac90-70aa-4242-b867-6d9334317851'::uuid, 'Datadog Japan株式会社'),
     ('d6650b18-5ef2-40c9-9938-2adbad70fe2b'::uuid, 'Zendesk株式会社'),
     ('f8ebbe74-b647-46ea-869f-b126d1c4f316'::uuid, 'オクタ・ジャパン株式会社'),
     ('e3eafa66-02ce-4060-a5fe-57e4317c8e7c'::uuid, 'ウォークミー株式会社')
   );
  if n <> 5 then
    raise exception '想定した社名の行が5件そろわない（%件）。中止する', n;
  end if;
end $$;

-- ① 前株／後株（登記: 株式会社Ｂｏｘ Ｊａｐａｎ）
update public.ow_companies
   set name = '株式会社Box Japan'
 where id = 'c7353772-0c07-4f0d-8d20-294215125303';

-- ② 法人格（登記: Ｄａｔａｄｏｇ Ｊａｐａｎ合同会社）
update public.ow_companies
   set name = 'Datadog Japan合同会社'
 where id = 'a5ffac90-70aa-4242-b867-6d9334317851';

-- ③ 法人格＋前株／後株（登記: 合同会社Ｚｅｎｄｅｓｋ。旧商号 株式会社Ｚｅｎｄｅｓｋ）
update public.ow_companies
   set name = '合同会社Zendesk'
 where id = 'd6650b18-5ef2-40c9-9938-2adbad70fe2b';

-- ④ 表記（登記: Ｏｋｔａ Ｊａｐａｎ株式会社）＋ カタカナを別名へ退避
--    ⚠️「オクタ・ジャパン」と「オクタジャパン」の両方を入れる。別名は ilike の
--       部分一致なので、中黒の有無で当たり外れが変わる（「オクタ」は部分一致で拾える）。
update public.ow_companies
   set name = 'Okta Japan株式会社',
       search_aliases = 'オクタ・ジャパン オクタジャパン'
 where id = 'f8ebbe74-b647-46ea-869f-b126d1c4f316';

-- ⑤ 表記（登記: ＷａｌｋＭｅ株式会社）＋ カタカナを別名へ退避
update public.ow_companies
   set name = 'WalkMe株式会社',
       search_aliases = 'ウォークミー'
 where id = 'e3eafa66-02ce-4060-a5fe-57e4317c8e7c';

-- ⚠️ 検算。**件数では入れ違いを検出できない**ので id と値の組で確かめる
--    （ui-debugging ⑱）。normalized_name がトリガーで作り直されたことも見る。
do $$
declare
  r record;
  expected text;
  n_alias bigint;
begin
  for r in
    select c.id, c.name, c.normalized_name, coalesce(c.search_aliases,'') as aliases,
           v.want
      from public.ow_companies c
      join (values
        ('c7353772-0c07-4f0d-8d20-294215125303'::uuid, '株式会社Box Japan'),
        ('a5ffac90-70aa-4242-b867-6d9334317851'::uuid, 'Datadog Japan合同会社'),
        ('d6650b18-5ef2-40c9-9938-2adbad70fe2b'::uuid, '合同会社Zendesk'),
        ('f8ebbe74-b647-46ea-869f-b126d1c4f316'::uuid, 'Okta Japan株式会社'),
        ('e3eafa66-02ce-4060-a5fe-57e4317c8e7c'::uuid, 'WalkMe株式会社')
      ) as v(id, want) on v.id = c.id
  loop
    if r.name <> r.want then
      raise exception '社名が想定と違う（%）: % / 想定 %', r.id, r.name, r.want;
    end if;
    -- ★トリガーが normalized_name を作り直しているか（空なら効いていない）
    if coalesce(r.normalized_name,'') = '' then
      raise exception 'normalized_name が空（%）。トリガーが効いていない', r.name;
    end if;
    raise notice '% / normalized=% / aliases=%', r.name, r.normalized_name, r.aliases;
  end loop;

  -- ★カタカナで探せることを担保する（別名が空だと検索から消える）
  select count(*) into n_alias from public.ow_companies
   where id in ('f8ebbe74-b647-46ea-869f-b126d1c4f316','e3eafa66-02ce-4060-a5fe-57e4317c8e7c')
     and coalesce(search_aliases,'') <> '';
  if n_alias <> 2 then
    raise exception 'オクタ／ウォークミーのカタカナ別名が入っていない（%件）', n_alias;
  end if;

  -- ★既にあった別名を消していないこと（据え置きの3社）
  select count(*) into n_alias from public.ow_companies
   where id in ('c7353772-0c07-4f0d-8d20-294215125303',
                'a5ffac90-70aa-4242-b867-6d9334317851',
                'd6650b18-5ef2-40c9-9938-2adbad70fe2b')
     and coalesce(search_aliases,'') <> '';
  if n_alias <> 3 then
    raise exception '据え置きのはずの別名が消えている（%件）', n_alias;
  end if;
end $$;
