-- ═══════════════════════════════════════════════════════════════════════════
-- 企業データの出典を記録する表を作る（2026-08-30）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- `headquarters_address` を 19社 → **73社**（掲載79社）まで埋めたが、
-- **どの値がどこから来たのかがどこにも残っていない。**
-- 求人には `source_url` / `source_verified_at` を入れたのに、企業には無かった。
--
-- 実測（2026-08-30 / migration を機械的に解析）:
--   * **登記（国税庁 法人番号公表サイト）由来 … 42社** → 登記上の**本店**所在地
--   * **各社の公式サイト由来 … 30社**             → **オフィス**所在地（人がいる場所）
--   * **出所が記録されていない … 1社**（伊藤忠テクノソリューションズ）
-- ⚠️ この2つは**意味が違う**。登記の本店と実際のオフィスは一致しないことがある。
--    列を1つ見ただけでは区別できないので、記録する場所が要る。
--
-- ── ★設計メモ（CLAUDE.md）から2点変えた。実データが前提と違ったため ─────────
-- メモは「`ow_companies` に `source_urls text[]` を1組足す / 別テーブルにしない」
-- としており、その理由を2つ挙げていた。**どちらも実際の作業と違っていた。**
--
-- | メモの前提 | 実際 |
-- |---|---|
-- | 「1社の公式サイト・IR・採用ページを**一巡してまとめて埋める**ので出典と項目が1対1にならない」 | **項目ごとのバッチ**だった（住所だけを73社に）。企業単位に1組だと、次に別の項目を別の出所で埋めた日に**混ざる** |
-- | 「1出典が**複数社にまたがる等の必然が無い**」 | **国税庁の1サイトが42社にまたがった** |
--
-- → **(company_id, field) を主キーにした表**にする。メモの想定より粒度は細かいが、
--    列を24本足す案（12項目×2列）でもなく、1組に潰す案でもない中間。
-- ⚠️ **メモの結論を無視したのではなく、メモ自身が「実際に数社埋めてから形を決める」と
--    書いていた**。その条件が満たされたので決めた。
--
-- ── ★`source_url` は NULL を許す ───────────────────────────────────────────
-- **公式サイト由来30社のうち、個別URLが migration に残っているのは13社だけ**だった
-- （`20260829140000` は6社ぶんURLの記載が無く、`20260813061500` も2件のみ）。
-- ⚠️ **無いものを埋めない。** NULL は「**URLが記録されていない**」という事実。
--    それらしいURLを推測で入れると、CLAUDE.md「値が無いことを、ある値に置き換えない」に反する。
-- ⚠️ 登記の42社には `https://www.houjin-bangou.nta.go.jp/` を入れる。
--    法人番号を控えていないので**個社ページの深いURLは作れない**が、
--    再確認の入口としてはこれで足りる。
--
-- ── ★この表は運営専用（`ow_transitions` と同じ形）────────────────────────
-- RLS を有効にし、**ポリシーは1本も書かない**。anon / authenticated に GRANT しない。
-- 読むのは admin クライアントだけ。求職者にも企業にも出さない。
-- ⚠️ 表示する日が来たら、**先に「何を見せるか」を決めてからポリシーを書く**こと。
--
-- ── 語彙 ────────────────────────────────────────────────────────────────────
-- `field` / `source_kind` は CHECK で縛る（CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
-- ⚠️ **UI と API はまだ無い。** 作るときは `src/lib/constants/companySources.ts` を見ること。
--    route の中に `new Set([...])` を書かない。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260830-0236-ow_companies.sql（スキーマ+データ / 89行）
--   ⚠️ 追加のみ（新しい表）なので既存データは変わらない。戻すなら DROP TABLE。
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE public.ow_company_data_sources (
  company_id  uuid        NOT NULL REFERENCES public.ow_companies(id) ON DELETE CASCADE,
  field       text        NOT NULL,
  source_kind text        NOT NULL,
  source_url  text,
  verified_at timestamptz NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, field),

  /* ⚠️ 項目を増やすときは、ここと `src/lib/constants/companySources.ts` の両方を直す。
        綴りが1文字ずれると、その行は誰からも見つからない静かな死蔵になる。 */
  CONSTRAINT ow_company_data_sources_field_check
    CHECK (field IN ('headquarters_address')),

  /* registry      … 公的な登記情報（国税庁 法人番号公表サイト）＝**本店**所在地
     official_site … 各社の公式サイト＝**オフィス**所在地
     company_input … 企業自身が入力した
     unknown       … 調べたが出所を特定できなかった */
  CONSTRAINT ow_company_data_sources_kind_check
    CHECK (source_kind IN ('registry','official_site','company_input','unknown')),

  /* ⚠️ `unknown` に URL があってはいけない（出所不明なのにURLがある＝矛盾）。
        逆に registry / official_site の URL が NULL なのは**許す**
        （「URLが記録されていない」という事実を持てるようにするため）。 */
  CONSTRAINT ow_company_data_sources_unknown_no_url
    CHECK (source_kind <> 'unknown' OR source_url IS NULL)
);

COMMENT ON TABLE public.ow_company_data_sources IS
  '企業データの項目ごとの出典。運営専用（RLS 有効・ポリシー無し・anon/authenticated に GRANT 無し）。';
COMMENT ON COLUMN public.ow_company_data_sources.source_url IS
  'NULL は「URLが記録されていない」という事実。推測で埋めないこと。';
COMMENT ON COLUMN public.ow_company_data_sources.verified_at IS
  '最後に出典と突き合わせた日時。鮮度のしきい値は src/lib/constants/companySources.ts。';

CREATE INDEX ow_company_data_sources_verified_at_idx
  ON public.ow_company_data_sources (verified_at);

/* ★RLS を有効にし、ポリシーは書かない（`ow_transitions` と同じ）。
   ⚠️ CLAUDE.md「新しいテーブルには GRANT を必ず書く」——ここでは
      **意図して誰にも配らない**ことを明示する。service_role だけが読み書きする。
   ⚠️ RLS で弾かれると 200 + 0件で返る（403 ではない）。
      「anon で0件だった」を遮断の証拠にしないこと。 */
ALTER TABLE public.ow_company_data_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ow_company_data_sources FROM anon, authenticated;

-- ── バックフィル ────────────────────────────────────────────────────────────
/* ⚠️ 対象は migration ファイルを機械的に解析して作った（推測ではない）。
      同じ企業を複数の migration が触っている場合は**後勝ち**（最後に書いた出所が正）。 */
INSERT INTO public.ow_company_data_sources
  (company_id, field, source_kind, source_url, verified_at, note)
VALUES
  ('09d67e54-0381-45c8-b698-568e1fc47033'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-13', '投入元: 20260813061500_fill_company_profile_9_companies.sql'),
  ('81aa95dc-2304-4faa-9c4a-f2f5454e8e11'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-13', '投入元: 20260813061500_fill_company_profile_9_companies.sql'),
  ('8b9f84b0-b4be-4191-8322-07c6a2e5e91a'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-13', '投入元: 20260813061500_fill_company_profile_9_companies.sql'),
  ('9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-13', '投入元: 20260813061500_fill_company_profile_9_companies.sql'),
  ('a5ffac90-70aa-4242-b867-6d9334317851'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-13', '投入元: 20260813061500_fill_company_profile_9_companies.sql'),
  ('aaaaaaaa-0001-0001-0001-000000000007'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-13', '投入元: 20260813061500_fill_company_profile_9_companies.sql'),
  ('ae15610d-477a-410d-b74a-54ab3e351add'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-13', '投入元: 20260813061500_fill_company_profile_9_companies.sql'),
  ('daa558e5-054f-4475-ab00-3817170759ce'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-13', '投入元: 20260813061500_fill_company_profile_9_companies.sql'),
  ('fb7397eb-a9c7-4ce3-964a-d7a72159847f'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-13', '投入元: 20260813061500_fill_company_profile_9_companies.sql'),
  ('88defb4b-b18c-437b-8b7d-d41a43232af4'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-28', '投入元: 20260828070000_fill_hq_twilio_concur.sql'),
  ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-28', '投入元: 20260828070000_fill_hq_twilio_concur.sql'),
  ((select id from public.ow_companies where name = 'Asana Japan株式会社'), 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-28', '投入元: 20260828150000_fill_headquarters_address_7.sql'),
  ((select id from public.ow_companies where name = 'Indeed Japan株式会社'), 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-28', '投入元: 20260828150000_fill_headquarters_address_7.sql'),
  ((select id from public.ow_companies where name = 'New Relic株式会社'), 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-28', '投入元: 20260828150000_fill_headquarters_address_7.sql'),
  ((select id from public.ow_companies where name = 'パロアルトネットワークス株式会社'), 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-28', '投入元: 20260828150000_fill_headquarters_address_7.sql'),
  ((select id from public.ow_companies where name = 'ブレイズ株式会社'), 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-28', '投入元: 20260828150000_fill_headquarters_address_7.sql'),
  ((select id from public.ow_companies where name = 'ページャーデューティー株式会社'), 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-28', '投入元: 20260828150000_fill_headquarters_address_7.sql'),
  ((select id from public.ow_companies where name = '日本IBM株式会社'), 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-28', '投入元: 20260828150000_fill_headquarters_address_7.sql'),
  ('28b826eb-fb86-4124-aa08-c489cad662f1'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829130000_fill_headquarters_address_6.sql'),
  ('2e54ff06-2f4d-420c-9a5c-9a80a85ca55a'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829130000_fill_headquarters_address_6.sql'),
  ('63d390da-e8c4-464a-8c30-e112fcd2709c'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829130000_fill_headquarters_address_6.sql'),
  ('cf44d740-b835-454d-91a3-f1e2eddc7251'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829130000_fill_headquarters_address_6.sql'),
  ('d1c26664-5643-42bc-84e4-6f0c940bb39d'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829130000_fill_headquarters_address_6.sql'),
  ('dd76b17d-e3c1-44a9-b747-4ecde10b8cec'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829130000_fill_headquarters_address_6.sql'),
  ('1027a327-18c0-4191-b27b-a28bf5781126'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829140000_fill_headquarters_address_6b.sql'),
  ('8dc04d46-3430-45de-91f8-e37c8880b8a5'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829140000_fill_headquarters_address_6b.sql'),
  ('c3664ef1-5571-4645-b30f-1474e7961c17'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829140000_fill_headquarters_address_6b.sql'),
  ('d6650b18-5ef2-40c9-9938-2adbad70fe2b'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829140000_fill_headquarters_address_6b.sql'),
  ('f4acddc0-c746-4537-9edf-6f3c1f2c90b3'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829140000_fill_headquarters_address_6b.sql'),
  ('f8ebbe74-b647-46ea-869f-b126d1c4f316'::uuid, 'headquarters_address', 'official_site', NULL, timestamptz '2026-08-29', '投入元: 20260829140000_fill_headquarters_address_6b.sql'),
  ('1f73df31-8e55-4e70-a928-afe1150d72d0'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('1f8010f2-ba3f-4f7a-b7f4-d5b60400e638'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('40dca29e-aa4b-4654-aada-8e29763f8521'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('4df6e844-74d6-4f50-98f9-08468a12f1dc'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('565b0f13-252d-44d0-8b90-e00acacf4b75'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('6396920c-70d3-47d2-9f4e-67bc2efe262f'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('7d186c45-ce23-4d96-8eae-cd6e7c00faee'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('829a1ea9-d577-4404-9ba7-e301680523a8'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('94edfbe5-0496-4c1d-865c-d2d448232135'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('a9de1561-eb91-4ebf-842d-f6d39865b7ef'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('b8b7a2d4-20a8-4fe1-8651-61a6503f762e'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('bf24736f-fa65-4c5a-9764-98c96ace3b07'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('c32027b9-cfbd-4a70-bf4c-464e42790db4'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('eccd3dfb-decd-4277-a3a4-df489d3b3e5e'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('f201ed17-a9e2-4859-85aa-474578b2870d'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('fc1f7cb7-9530-4d6a-85cf-15196a4b155e'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829150000_fill_headquarters_address_17_registry.sql'),
  ('3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829160000_fill_headquarters_address_5_registry.sql'),
  ('87bcae88-2779-4bf7-b461-b3c8661b2764'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829160000_fill_headquarters_address_5_registry.sql'),
  ('cb386dd2-427c-49d1-b3f8-1e1d3a921fd8'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829160000_fill_headquarters_address_5_registry.sql'),
  ('da8cfab5-f5c2-4648-b866-895be46a1494'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829160000_fill_headquarters_address_5_registry.sql'),
  ('e4d317d3-48b9-4718-ae3e-8d27147d05f5'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829160000_fill_headquarters_address_5_registry.sql'),
  ('08e4aff6-a12c-4963-ad43-960ac9e39967'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('0a216ebb-c1fa-4d19-b066-f45e45c3ba2e'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('1241f8a5-b645-4aa2-9fa1-bbfc573f1774'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('1413b97e-ef19-4e40-87ae-e31ac8996bdd'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('27988ac1-fd93-445d-a9fd-6dad74c92686'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('355ce5c6-0412-4512-8864-1d477c97c917'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('3efd857e-315c-4650-9727-1e5aa1245753'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('4fecbf31-498c-40b0-a04e-3a6cb978433f'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('53ea9a54-feef-413b-8a7c-e31e4def2e11'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('7dac3c6e-bc5f-4550-9170-4338ea809be2'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('943620b5-0fa2-48b4-a072-d47f900ba9f0'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('99132c64-ff07-4945-aeb6-7e21e6c256c9'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('9ccf1640-6a5c-42e3-bbcf-4110f715fbf4'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('b8aa0e3d-828c-4bbe-b588-88450aab5739'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('bcea5e4e-94ee-4019-8ce3-237a7edf79a7'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('dcd2c652-4335-4031-b4d2-a4f22c98182b'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('e3eafa66-02ce-4060-a5fe-57e4317c8e7c'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('e459ac79-5dad-499d-bb65-b758d4281123'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('ec97fde1-6f22-4ab5-89ee-9cea0b258f2a'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql'),
  ('f32e6905-f25f-4c01-b64f-c5695fd45a1d'::uuid, 'headquarters_address', 'registry', 'https://www.houjin-bangou.nta.go.jp/', timestamptz '2026-08-29', '投入元: 20260829170000_fill_headquarters_address_20_registry.sql')
ON CONFLICT (company_id, field) DO NOTHING;

/* ★出所が記録されていない1社。**空欄のままにせず「不明」と記録する。**
   ⚠️ 2026-08-30 に調べたが、この住所を入れた migration が見つからなかった
      （`baseline` より前か、SQL Editor で直接入れられたか）。
      `verified_at` は「調べた日」。**URLは入れない**（無いので）。 */
INSERT INTO public.ow_company_data_sources
  (company_id, field, source_kind, source_url, verified_at, note)
SELECT id, 'headquarters_address', 'unknown', NULL, timestamptz '2026-08-30',
       '2026-08-30 に調査。投入元の migration を特定できなかった（baseline 以前か直接SQL）'
  FROM public.ow_companies
 WHERE name = '伊藤忠テクノソリューションズ株式会社'
ON CONFLICT (company_id, field) DO NOTHING;

DO $$
DECLARE v_rows int; v_reg int; v_site int; v_unk int; v_addr int; v_orphan int; v_bad int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.ow_company_data_sources;
  SELECT count(*) INTO v_reg  FROM public.ow_company_data_sources WHERE source_kind = 'registry';
  SELECT count(*) INTO v_site FROM public.ow_company_data_sources WHERE source_kind = 'official_site';
  SELECT count(*) INTO v_unk  FROM public.ow_company_data_sources WHERE source_kind = 'unknown';

  IF v_reg  <> 42 THEN RAISE EXCEPTION 'registry が % 行（42 のはず）。中止', v_reg; END IF;
  IF v_site <> 30 THEN RAISE EXCEPTION 'official_site が % 行（30 のはず）。中止', v_site; END IF;
  IF v_unk  <> 1  THEN RAISE EXCEPTION 'unknown が % 行（1 のはず）。中止', v_unk; END IF;
  IF v_rows <> 73 THEN RAISE EXCEPTION '合計 % 行（73 のはず）。中止', v_rows; END IF;

  /* ★掲載79社で住所を持つのは73社。**その73社と過不足なく一致すること。**
        （名前指定の select が NULL を返していたら、ここで落ちる） */
  SELECT count(*) INTO v_addr FROM public.ow_companies
   WHERE is_published AND listing_status = 'listed' AND is_test = false
     AND headquarters_address IS NOT NULL AND headquarters_address <> '';
  IF v_addr <> 73 THEN RAISE EXCEPTION '住所を持つ掲載企業が % 社（73 のはず）。中止', v_addr; END IF;

  SELECT count(*) INTO v_orphan
    FROM public.ow_companies c
   WHERE c.is_published AND c.listing_status = 'listed' AND c.is_test = false
     AND c.headquarters_address IS NOT NULL AND c.headquarters_address <> ''
     AND NOT EXISTS (SELECT 1 FROM public.ow_company_data_sources s
                      WHERE s.company_id = c.id AND s.field = 'headquarters_address');
  IF v_orphan <> 0 THEN RAISE EXCEPTION '出典の記録が無い企業が % 社ある。中止', v_orphan; END IF;

  /* ★逆向き。**住所が空なのに出典だけある**行を作っていないこと */
  SELECT count(*) INTO v_bad
    FROM public.ow_company_data_sources s JOIN public.ow_companies c ON c.id = s.company_id
   WHERE s.field = 'headquarters_address'
     AND (c.headquarters_address IS NULL OR c.headquarters_address = '');
  IF v_bad <> 0 THEN RAISE EXCEPTION '住所が空なのに出典がある行が % 件。中止', v_bad; END IF;

  RAISE NOTICE '完了: 合計 % 行（登記 % / 公式サイト % / 不明 %）', v_rows, v_reg, v_site, v_unk;
END $$;

COMMIT;
