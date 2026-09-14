-- ★61社をディレクトリ（一覧・検索・サジェスト・sitemap・LP）から外す（2026-09-14）
--
-- ── 何をするか ──────────────────────────────────────────────────────────────
-- `listing_status` を `'listed'` → `'draft'` にするだけ。**行は消さない。**
--   ⚠️★**`is_published` は true のまま。** 企業ページ（`/companies/<slug>`）は残す。
--      理由は「職歴の企業ピッカーで選べる会社としては残す」ため（柴さんの指示）。
--
-- ── なぜ `is_published` を倒さないか（2026-09-14 に実測して決めた）───────────
--   ・職歴のリンク … `lib/utils/timeline.ts:178` は **`is_published` だけ**を見る。
--                    倒すと2件（富士フイルムBI・フライル）がテキストに落ちる
--   ・♡ ブックマーク … `mypage/bookmarks` は可視性を一切見ていないので、
--                    倒すと **PKSHA の1件が 404 へのリンクとして残る**
--   ・記事CTA … `resolvePublishedCompanyHref` は `filterVisibleCompaniesStrict`
--                （`is_published` のみ）。倒すと6社ぶんの CTA が消える
--   ・SEO … ディレクトリから外すだけなら sitemap 除外＋`noindex` で足りる
--           （`companies/[id]/page.tsx:250` が `listingStatus !== 'listed'` で付ける）
--
-- ⚠️ この状態（`is_published=true` かつ `listing_status='draft'`）は新設ではない。
--    既に5社が同じ形で動いている: アサヒビール／スマートキャンプ／みずほ証券／
--    株式会社エージェント／海光電業（うち海光電業は面談対応者1名を掲載したまま）。
--
-- ── 当てる前の状態（2026-09-14 実測 / 本番）───────────────────────────────
--   掲載中（is_published AND listing_status='listed' AND NOT is_test）… **83社**
--   対象61社は**全社**  listing_status='listed' / is_published=true /
--                       is_approved=true / is_test=false
--   対象61社の公開求人 … **0件**（公開求人は Salesforce の2件のみ。対象外）
--   対象61社の面談対応者・企業管理者・フォロー … **すべて0**
--   ⚠️ 「話を聞ける人」がいるのは 日本ヒューレット・パッカード合同会社（slug `hp`）で、
--      対象に入っている 株式会社日本HP（slug `hp-jp`）とは**別法人**。取り違え注意。
--
-- ── 当てたあと ──────────────────────────────────────────────────────────────
--   掲載中 … **22社**
--   ⚠️★**コード側の変更とセットで出すこと。** この migration だけでは
--      「顧客の業界」チップが6→1、事業領域チップが14→11 に痩せる。
--      同じコミットで `/companies` のチップをマスタから作る形に変えてある（A案）。
--   ⚠️ `getBusinessDomainFacets` / `fetchAvailableTargetIndustries` は
--      `unstable_cache`（revalidate 300）。この migration は `revalidateTag` を
--      呼ばないので、**フッターの「事業領域から探す」は最大5分ずれる。**
--
-- ── 直近に同じ列を触った migration の確認（CLAUDE.md の②）────────────────────
-- `listing_status` に値を **SET** している migration は1本だけ（全文検索で確認）:
--
--   `20260813043000_company_visibility_single_axis.sql`
--     2026-08-13 に可視性を2軸に分けたときのもの。
--     `is_approved = false` の4社と検証用スタブ1社を `'draft'` へ倒している。
--     ⚠️ **打ち消していない。** 対象が重ならない —— あちらは**未承認**の企業、
--        こちらは**承認済みで掲載中**の61社（事前アサートで `is_approved` を確認済み）。
--        id も1社も重複しない。
--
-- そのほかの migration は `listing_status` を **WHERE / CHECK / COMMENT** で読むだけ。
-- 掲載の切り替えは基本的に `/admin` の `updateListingStatus` で行われてきた。
--
-- ⚠️ 新規 INSERT で `'draft'` を入れている前例はある
--    （`20260828120000_add_mizuho_securities.sql` — まさに
--     「`is_published = true` かつ `listing_status = 'draft'`」で入れている）。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   下の id 一覧に対して `listing_status = 'listed'` を当てるだけで戻る。
--   ⚠️ `is_approved` は全社 true なので `check_listed_requires_approval` /
--      `trg_guard_company_approval` に弾かれない。
--
-- ⚠️ 作業前ダンプ: `.dumps/20260914-1543-ow_companies.sql`（スキーマ+データ / 104行）

begin;

-- 対象61社。⚠️ **id で明示列挙する**（CLAUDE.md「全社一括の UPDATE を禁止する」）
create temporary table _unlist_targets (id uuid primary key) on commit drop;

insert into _unlist_targets (id) values
    ('6396920c-70d3-47d2-9f4e-67bc2efe262f'),  -- akamai              アカマイ・テクノロジーズ合同会社
    ('565b0f13-252d-44d0-8b90-e00acacf4b75'),  -- mongodb             MongoDB Japan合同会社
    ('4fecbf31-498c-40b0-a04e-3a6cb978433f'),  -- gainsight           ゲインサイト・ジャパン株式会社
    ('3efd857e-315c-4650-9727-1e5aa1245753'),  -- arista              アリスタネットワークス合同会社
    ('1e541353-c177-40a9-968a-af3af14e1194'),  -- elastic             エラスティック株式会社
    ('1241f8a5-b645-4aa2-9fa1-bbfc573f1774'),  -- zactory             ザクトリー株式会社
    ('0ece9af4-96cb-443c-b8a8-0f358c8e3a64'),  -- meta                Meta日本法人
    ('0a216ebb-c1fa-4d19-b066-f45e45c3ba2e'),  -- cloudflare          クラウドフレア・ジャパン株式会社
    ('f4a6aa23-3775-4548-981b-156e416ef6f6'),  -- palo-alto-networks  パロアルトネットワークス株式会社
    ('cb70da1c-4b3b-429b-a06b-cdc2c50172f8'),  -- snowflake           Snowflake Japan株式会社
    ('a9de1561-eb91-4ebf-842d-f6d39865b7ef'),  -- aws                 アマゾン ウェブ サービス ジャパン合同会社
    ('9ef65fa1-e04b-4098-a7b1-4ee3d535a23a'),  -- ibm                 日本IBM株式会社
    ('dcd2c652-4335-4031-b4d2-a4f22c98182b'),  -- apple               アップルジャパン合同会社
    ('c32027b9-cfbd-4a70-bf4c-464e42790db4'),  -- hp-jp               株式会社日本HP
    ('99132c64-ff07-4945-aeb6-7e21e6c256c9'),  -- nobefore            ノービフォー株式会社
    ('1413b97e-ef19-4e40-87ae-e31ac8996bdd'),  -- clickhouse          クリックハウス株式会社
    ('f4acddc0-c746-4537-9edf-6f3c1f2c90b3'),  -- dell                デル・テクノロジーズ株式会社
    ('478a9ede-ea0f-48c1-859c-d47f84d35b6b'),  -- braze               ブレイズ株式会社
    ('3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2'),  -- fortinet            フォーティネット株式会社
    ('1f8010f2-ba3f-4f7a-b7f4-d5b60400e638'),  -- oracle              日本オラクル株式会社
    ('7dac3c6e-bc5f-4550-9170-4338ea809be2'),  -- vmware              ヴイエムウェア株式会社
    ('7baafcb1-d929-46c1-97be-b0fb580b480b'),  -- pagerduty           ページャーデューティー株式会社
    ('8dc04d46-3430-45de-91f8-e37c8880b8a5'),  -- workday             株式会社ワークデイ
    ('87bcae88-2779-4bf7-b461-b3c8661b2764'),  -- crowdstrike         CrowdStrike株式会社
    ('829a1ea9-d577-4404-9ba7-e301680523a8'),  -- nvidia              エヌビディア合同会社
    ('be74d989-db8f-4be1-882c-40cf94e07fe2'),  -- palantir            パランティア・テクノロジーズ
    ('94edfbe5-0496-4c1d-865c-d2d448232135'),  -- qualcomm            クアルコムジャパン合同会社
    ('d71a7da6-a769-456e-99ab-a077d89a0d43'),  -- photoruction        株式会社フォトラクション
    ('b1d7996c-d260-4025-b495-bd1e2b9bb795'),  -- andpad              株式会社アンドパッド
    ('78560eee-1a82-44b8-b9f6-d9c88fb60f4b'),  -- dandori-work        株式会社ダンドリワーク
    ('0b93a8f2-d378-4d5a-aecc-9040fde2113c'),  -- spiderplus          スパイダープラス株式会社
    ('fb7397eb-a9c7-4ce3-964a-d7a72159847f'),  -- ubie                Ubie株式会社
    ('09d67e54-0381-45c8-b698-568e1fc47033'),  -- pksha               株式会社PKSHA Technology
    ('e459ac79-5dad-499d-bb65-b758d4281123'),  -- kong                コング・ジャパン株式会社
    ('da8cfab5-f5c2-4648-b866-895be46a1494'),  -- docusign            DocuSign Japan株式会社
    ('bcea5e4e-94ee-4019-8ce3-237a7edf79a7'),  -- sap                 SAPジャパン株式会社
    ('a1a7036b-a5c4-4328-b5db-96ac1d5e29df'),  -- kyriba              キリバ株式会社
    ('b8b7a2d4-20a8-4fe1-8651-61a6503f762e'),  -- fujifilm-bi         富士フイルムビジネスイノベーションジャパン株式会社
    ('b8aa0e3d-828c-4bbe-b588-88450aab5739'),  -- ncino               エヌシーノ合同会社
    ('943620b5-0fa2-48b4-a072-d47f900ba9f0'),  -- uber                ウーバー・ジャパン株式会社
    ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e'),  -- concur              コンカー株式会社
    ('355ce5c6-0412-4512-8864-1d477c97c917'),  -- miracle             ミラクル株式会社
    ('1027a327-18c0-4191-b27b-a28bf5781126'),  -- coupa               クーパ・ソフトウェア株式会社
    ('53ea9a54-feef-413b-8a7c-e31e4def2e11'),  -- blackline           ブラックライン株式会社
    ('27988ac1-fd93-445d-a9fd-6dad74c92686'),  -- cisco               シスコシステムズ合同会社
    ('ec97fde1-6f22-4ab5-89ee-9cea0b258f2a'),  -- intel               インテル株式会社
    ('e7e9b0be-20c2-4434-afea-7a27c89332e2'),  -- indeed              Indeed Japan株式会社
    ('cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16'),  -- slack               Slack Japan株式会社
    ('f201ed17-a9e2-4859-85aa-474578b2870d'),  -- lenovo              レノボ・ジャパン合同会社
    ('eccd3dfb-decd-4277-a3a4-df489d3b3e5e'),  -- adobe               アドビ株式会社
    ('08e4aff6-a12c-4963-ad43-960ac9e39967'),  -- aptio               アプティオ株式会社
    ('9ccf1640-6a5c-42e3-bbcf-4110f715fbf4'),  -- confluent           コンフルエント合同会社
    ('7d186c45-ce23-4d96-8eae-cd6e7c00faee'),  -- google              グーグル合同会社
    ('40dca29e-aa4b-4654-aada-8e29763f8521'),  -- microsoft           日本マイクロソフト株式会社
    ('1f73df31-8e55-4e70-a928-afe1150d72d0'),  -- dropbox             Dropbox Japan株式会社
    ('cb386dd2-427c-49d1-b3f8-1e1d3a921fd8'),  -- flyle               株式会社フライル
    ('0d4734e0-0717-475e-a6d1-806aa2cd45ff'),  -- new-relic           New Relic株式会社
    ('d1c26664-5643-42bc-84e4-6f0c940bb39d'),  -- translead           株式会社Translead
    ('63d390da-e8c4-464a-8c30-e112fcd2709c'),  -- irodas              株式会社irodas
    ('2e54ff06-2f4d-420c-9a5c-9a80a85ca55a'),  -- timee               株式会社タイミー
    ('28b826eb-fb86-4124-aa08-c489cad662f1')   -- shinka              株式会社シンカ
;

-- ── 事前アサート ────────────────────────────────────────────────────────────
-- ⚠️ 「エラーが出なかった」を成功にしない。当てる前の姿を数えて確かめる。
do $$
declare
  v_found int; v_listed_targets int; v_listed_total int; v_jobs int;
begin
  select count(*) into v_found
    from _unlist_targets t join public.ow_companies c on c.id = t.id;
  if v_found <> 61 then
    raise exception '対象 id が61件見つからない（実測 % 件）。行が消えたか id が変わっている', v_found;
  end if;

  /* 旧値の確認。⚠️ 1社でも 'draft' なら、誰かが先に触っている。
     ⚠️★`is_approved` も見る。**戻せることの担保**になる ——
        `check_listed_requires_approval`（listing_status <> 'listed' OR is_approved）と
        `trg_guard_company_approval` があるので、未承認の社は `'listed'` へ戻せない。 */
  select count(*) into v_listed_targets
    from _unlist_targets t join public.ow_companies c on c.id = t.id
   where c.listing_status = 'listed' and c.is_published
     and c.is_approved and not c.is_test;
  if v_listed_targets <> 61 then
    raise exception
      '対象61社が「承認済み・掲載中・非テスト」ではない（実測 % 件）。先に誰かが触っている',
      v_listed_targets;
  end if;

  select count(*) into v_listed_total
    from public.ow_companies
   where is_published and listing_status = 'listed' and not is_test;
  if v_listed_total <> 83 then
    raise exception '掲載中が83社ではない（実測 % 社）。前提が動いているので人が見ること', v_listed_total;
  end if;

  -- ⚠️ 公開求人を持つ企業を一覧から外さない（外すと /jobs から辿れる先が消える）
  select count(*) into v_jobs
    from _unlist_targets t join public.ow_jobs j on j.company_id = t.id
   where j.status = 'published' and not j.is_test;
  if v_jobs <> 0 then
    raise exception '対象に公開求人を持つ企業がある（求人 % 件）。外す前に求人の扱いを決めること', v_jobs;
  end if;

  raise notice '事前: 対象61社すべて掲載中 / 掲載中の合計 % 社 / 対象の公開求人 % 件', v_listed_total, v_jobs;
end $$;

-- ⚠️★**当てる前の「掲載中83社」を控えておく。** 事後アサート④で
--    「対象外を1社も巻き添えにしていない」ことを集合の差分で確かめるために要る。
create temporary table _pre_listed on commit drop as
  select id from public.ow_companies
   where is_published and listing_status = 'listed' and not is_test;

-- ── 本体 ────────────────────────────────────────────────────────────────────
-- ⚠️ 旧値は全社 `'listed'`（上の事前アサートで確認済み）。
-- ⚠️★**`is_published` / `is_approved` は触らない。** 触ると上の「戻し方」も
--    ページも職歴のリンクも壊れる。動かすのは `listing_status` だけ。
-- ⚠️ `updated_at` は `/admin` の `updateListingStatus` と同じく一緒に進める。
update public.ow_companies c
   set listing_status = 'draft',
       updated_at     = now()
  from _unlist_targets t
 where c.id = t.id
   and c.listing_status = 'listed';

-- ── 事後アサート ────────────────────────────────────────────────────────────
do $$
declare
  v_still int; v_unpub int; v_listed_total int; v_outside int;
begin
  -- ① 対象が1社も掲載中に残っていない
  select count(*) into v_still
    from _unlist_targets t join public.ow_companies c on c.id = t.id
   where c.listing_status = 'listed';
  if v_still <> 0 then
    raise exception '対象がまだ掲載中（% 社）', v_still;
  end if;

  -- ② ★`is_published` を巻き添えにしていない（ページと職歴のリンクが生きていること）
  select count(*) into v_unpub
    from _unlist_targets t join public.ow_companies c on c.id = t.id
   where c.is_published is not true;
  if v_unpub <> 0 then
    raise exception 'is_published を倒してしまっている（% 社）。ページと職歴のリンクが死ぬ', v_unpub;
  end if;

  -- ③ 掲載中は 83 - 61 = 22社
  select count(*) into v_listed_total
    from public.ow_companies
   where is_published and listing_status = 'listed' and not is_test;
  if v_listed_total <> 22 then
    raise exception '掲載中が22社にならない（実測 % 社）', v_listed_total;
  end if;

  -- ④ ★対象外を1社も動かしていない。
  --    当てる前に掲載中だった83社を `_pre_listed` に控えてあるので、
  --    「(83社 − 対象61社) と いまの掲載中22社」が**完全に一致する**ことを見る。
  --    ⚠️ ①の言い換えにしないこと。①は「対象が残っていないか」で、
  --       こちらは「**巻き添えで落ちた社が居ないか**」。向きが逆。
  select count(*) into v_outside from (
    (select p.id from _pre_listed p
      where not exists (select 1 from _unlist_targets t where t.id = p.id)
     except
     select c.id from public.ow_companies c
      where c.is_published and c.listing_status = 'listed' and not c.is_test)
    union all
    (select c.id from public.ow_companies c
      where c.is_published and c.listing_status = 'listed' and not c.is_test
     except
     select p.id from _pre_listed p
      where not exists (select 1 from _unlist_targets t where t.id = p.id))
  ) diff;
  if v_outside <> 0 then
    raise exception '対象外の企業が動いている（差分 % 社）。巻き添えを起こしている', v_outside;
  end if;

  raise notice '事後: 掲載中 % 社 / 対象で is_published が倒れたもの % 社', v_listed_total, v_unpub;
end $$;

commit;
