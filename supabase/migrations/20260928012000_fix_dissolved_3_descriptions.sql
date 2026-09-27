-- ★合併で解散した3社の本文を、現在形のままの状態から直す（2026-09-28 / 柴さんの指示）
--
-- 非掲載82社を国税庁法人番号公表サイトで当たって見つかった閉鎖3社。
-- `20260928000500`（マルケト）と**同じ形の問題**で、**消えた法人を現役として
-- 説明したまま**だった。
--
-- ⚠️★**非掲載化は要らない。3社とも既に `listing_status='draft'`。**
--    ここは職歴の企業ピッカーのマスタでもあり、**在籍した人は実在する**ので
--    選択肢から消すべきではない（マルケトを外したのは掲載企業だったから。軸が違う）。
--    直すのは**本文・従業員数・商号**だけ。
--
-- ── 登記で確かめた事実（3社とも「合併による解散」で、合併先まで明記されていた）──
--
-- ① Ｓｌａｃｋ　Ｊａｐａｎ株式会社（法人番号 4010001185050）
--    状態: 登記記録の閉鎖等（合併による解散等）／ 事由発生 令和3年12月2日
--    「令和３年１２月１日 …株式会社セールスフォース・ドットコム（4010401076766）に
--      合併し解散」
--    ⚠️★合併先の法人番号 4010401076766 は、**掲載中の「株式会社セールスフォース・
--       ジャパン」と同じ法人**（旧商号が株式会社セールスフォース・ドットコム。
--       2026-09-27 に登記で確認済み）。
--
-- ② Ａｐｐｔｉｏ株式会社（法人番号 2010401151612）
--    事由発生 令和6年5月22日／「令和６年５月１日 …日本アイ・ビー・エム株式会社
--    （1010001128061）に合併し解散」
--
-- ③ Ｃｏｎｆｌｕｅｎｔ　Ｊａｐａｎ合同会社（法人番号 4010903006196）
--    事由発生 令和8年9月11日／「令和８年８月１日 …日本アイ・ビー・エム株式会社
--    （1010001128061）に合併し解散」
--
-- ⚠️ 本文には**解散日（合併の効力発生日）**を書く。「事由発生年月日」は登記の
--    処理日で、数日ずれる。**混同しない。**
--
-- ⚠️★「事業は合併先に引き継がれている」と書いてよい理由: **吸収合併は権利義務の
--    包括承継**で、これは登記の事実から導ける。製品が今も売られているかは
--    **確かめていないので書かない**（マルケトで「2018年に買収」を書かなかったのと同じ）。
--
-- ── 何を変えるか ────────────────────────────────────────────────────────────
--
-- | 社名 | 商号 | employee_count | 別名 |
-- |---|---|---|---|
-- | Slack Japan株式会社 | **変えない**（登記と一致） | 約200名 → NULL | スラック（据え置き） |
-- | アプティオ株式会社 | **Apptio株式会社** | 約50名 → NULL | **アプティオ**を追加 |
-- | コンフルエント合同会社 | **Confluent Japan合同会社** | 約100名 → NULL | **コンフルエント**を追加 |
--
-- ⚠️★`employee_count` を NULL にするのは、**存在しない法人の現在の従業員数は
--    測れない**ため（データ表示の原則「値が無い → 項目ごと非表示」）。
--    旧値はこのコメントと作業前ダンプに残してある。
-- ⚠️★カタカナ→ラテンになる2社は `search_aliases` にカタカナを退避する。
--    name も name_en もラテンになるので、入れないと**カタカナで打った人に出ない。**
--    実測（適用前）: 新しい normalized_name は**他社と衝突0件・自由入力との一致0件**。
--
-- ⚠️ description は markdown。段落は**空行区切り**。太字は使わない
--    （日本語で `**` が約物と隣り合うと生のまま出る）。
-- ⚠️ 「リーダー」「急拡大」などの評価語は落とす（2026-08-13 の方針）。
-- ⚠️ 「NASDAQ上場」も落とす —— 親会社の話であり、いま合併先が変わっている。
--
-- ⚠️ 作業前ダンプ: .dumps/20260928-0109-ow_companies.sql（215,073 バイト / 106行）
-- ⚠️★対象を id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 同じ列を触った直近の migration を確認した: `20260928010000` は別の6社で、
--    この3社は含まれていない。打ち消しにはならない。

do $$
declare
  n bigint;
begin
  select count(*) into n from public.ow_companies
   where (id, name) in (
     ('cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16'::uuid, 'Slack Japan株式会社'),
     ('08e4aff6-a12c-4963-ad43-960ac9e39967'::uuid, 'アプティオ株式会社'),
     ('9ccf1640-6a5c-42e3-bbcf-4110f715fbf4'::uuid, 'コンフルエント合同会社')
   )
     and listing_status = 'draft';
  if n <> 3 then
    raise exception '想定した3社が draft で見つからない（%件）。中止する', n;
  end if;
end $$;

-- ① Slack Japan（商号は登記と一致しているので name は変えない）
update public.ow_companies
   set employee_count = null,
       description =
         'ビジネスチャット・コラボレーションツール「Slack」の日本法人だった会社。'
         || E'\n\n'
         || '2021年12月1日に株式会社セールスフォース・ドットコム（現在の株式会社セールスフォース・ジャパン）に合併して解散している'
         || '（出典は国税庁法人番号公表サイト、法人番号 4010001185050）。合併により、事業は同社に引き継がれている。'
 where id = 'cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16';

-- ② Apptio（カタカナ → 登記の商号。カタカナは別名へ退避）
update public.ow_companies
   set name = 'Apptio株式会社',
       search_aliases = 'アプティオ',
       employee_count = null,
       description =
         'ITコスト管理・IT財務管理（ITFM）の製品「Apptio」の日本法人だった会社。'
         || 'TBM（Technology Business Management）フレームワークに基づき、IT予算の可視化と最適化を支援していた。'
         || E'\n\n'
         || '2024年5月1日に日本アイ・ビー・エム株式会社に合併して解散している'
         || '（出典は国税庁法人番号公表サイト、法人番号 2010401151612）。合併により、事業は同社に引き継がれている。'
 where id = '08e4aff6-a12c-4963-ad43-960ac9e39967';

-- ③ Confluent Japan（同上）
update public.ow_companies
   set name = 'Confluent Japan合同会社',
       search_aliases = 'コンフルエント',
       employee_count = null,
       description =
         'Apache Kafka を基盤とするデータストリーミングプラットフォーム「Confluent」の日本法人だった会社。'
         || 'リアルタイムのデータパイプラインやイベント駆動アーキテクチャの基盤として提供していた。'
         || E'\n\n'
         || '2026年8月1日に日本アイ・ビー・エム株式会社に合併して解散している'
         || '（出典は国税庁法人番号公表サイト、法人番号 4010903006196）。合併により、事業は同社に引き継がれている。'
 where id = '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4';

-- ⚠️ 検算。**件数では入れ違いを検出できない**ので id と値の組で確かめる（ui-debugging ⑱）。
do $$
declare
  r record;
  n_alias bigint;
begin
  for r in
    select c.id, c.name, c.description, c.employee_count, c.normalized_name,
           coalesce(c.search_aliases,'') as aliases, c.listing_status, c.is_published, v.want
      from public.ow_companies c
      join (values
        ('cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16'::uuid, 'Slack Japan株式会社'),
        ('08e4aff6-a12c-4963-ad43-960ac9e39967'::uuid, 'Apptio株式会社'),
        ('9ccf1640-6a5c-42e3-bbcf-4110f715fbf4'::uuid, 'Confluent Japan合同会社')
      ) as v(id, want) on v.id = c.id
  loop
    if r.name <> r.want then
      raise exception '社名が想定と違う（%）: % / 想定 %', r.id, r.name, r.want;
    end if;
    -- ★解散の事実が入っていること（肯定形）
    if r.description not like '%合併して解散している%' then
      raise exception '解散の事実が本文に入っていない: %', r.name;
    end if;
    -- ★現在形の言い回しが残っていないこと（否定形。両方やる）
    if r.description ~ '継続|急拡大|進化中|注目' then
      raise exception '現在形の言い回しが残っている: %', r.name;
    end if;
    -- ★markdown の段落（空行区切り）
    if position(E'\n\n' in r.description) = 0 then
      raise exception '段落が空行で区切られていない: %', r.name;
    end if;
    if r.employee_count is not null then
      raise exception 'employee_count が NULL になっていない（%）: %', r.name, r.employee_count;
    end if;
    -- ★掲載状態は動かしていないこと（ページは生かしたまま）
    if r.listing_status <> 'draft' or r.is_published is not true then
      raise exception '掲載状態が動いた（%）: % / %', r.name, r.listing_status, r.is_published;
    end if;
    raise notice '% / normalized=% / aliases=%', r.name, r.normalized_name, r.aliases;
  end loop;

  -- ★カタカナで探せることを担保する（3社とも別名を持っていること）
  select count(*) into n_alias from public.ow_companies
   where id in ('cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16',
                '08e4aff6-a12c-4963-ad43-960ac9e39967',
                '9ccf1640-6a5c-42e3-bbcf-4110f715fbf4')
     and coalesce(search_aliases,'') <> '';
  if n_alias <> 3 then
    raise exception 'カタカナ別名が入っていない（%件）', n_alias;
  end if;

  -- ★normalized_name が他社と衝突していないこと
  select count(*) into n_alias from (
    select normalized_name from public.ow_companies
     where normalized_name in ('slackjapan','apptio','confluentjapan')
     group by normalized_name having count(*) > 1
  ) s;
  if n_alias <> 0 then
    raise exception 'normalized_name が他社と衝突した（%件）', n_alias;
  end if;
end $$;
