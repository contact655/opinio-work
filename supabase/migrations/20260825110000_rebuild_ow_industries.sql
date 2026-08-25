-- 業種マスタ（ow_industries）を作り直す（2026-08-25 / 業種分類フェーズ1）
--
-- ── 何をするか ──────────────────────────────────────────────────────────────
--   旧110行（2階層）を全て消し、**フラット20件**に入れ替える。
--   そのうえで87社の `industry_id` を `industry`(text) から機械的に埋める。
--
-- ── なぜ全置換か（残す案を採らなかった理由）────────────────────────────────
--   ① `ow_industries` を参照する FK は **2本だけ**（2026-08-25 実測）。
--        ow_companies.industry_id  → ON DELETE SET NULL
--        ow_industries.parent_id   → ON DELETE RESTRICT（自己参照）
--      関数・ビュー・RLSポリシーの本文からの参照は **0件**
--      （pg_get_functiondef / pg_get_viewdef / pg_get_expr を正規表現検索）。
--      src からの参照も `/biz/company` の2ファイルだけ。
--   ② 残すと**同名の行が2組できる**。新20件のうち「金融・保険」「運輸・物流」は
--      既存トップレベルと**完全に同名**で、`name` に UNIQUE が無いため DB で止まらない。
--      `/admin` と `/biz` のセレクトで区別できなくなる。
--   ③ **slug も3件衝突する**（it-software / finance-insurance / logistics）。
--      残す案だと新側の slug を別綴りにするしかなく、命名規則が不揃いになる。
--   ④ 旧110行のうち**実際に使われていたのは5件だけ**（SaaS 66 / ハードウェア 8 /
--      SIer 6 / その他（IT）2 = 82社）。残り105行は0社の死蔵だった。
--
-- ⚠️ **DELETE → INSERT の順を崩さないこと。** 上の③のとおり slug が3件衝突するので、
--    順序が逆になると `ow_industries_slug_key` に弾かれる。
--
-- ⚠️ **子 → 親の順に消すこと。** `parent_id` は ON DELETE **RESTRICT** なので、
--    NO ACTION と違い「同じ文の中で子も消えるから OK」にはならない（即時チェック）。
--    1文で全削除しようとすると必ず失敗する。
--
-- ── 直近に同じ列を触った migration の確認（CLAUDE.md のルール②）────────────
--   `industry_id` を含む migration は3本。打ち消しが無いことを確認した:
--     20260727000000_baseline.sql            … 列と FK の定義
--     20260811004949_industry_recategorize.sql … ⚠️ 本文に
--        「`industry_id` / `saas_category_id` / `ow_company_genres` は触らない（別途判断）」
--        と明記されており、**industry(text) だけを更新している。打ち消していない。**
--     archive/275_add_smartcamp_update_irodas.sql … 2社の投入時に設定
--
-- ⚠️ **`updated_at` は触らない。**
--    `/companies` の既定の並び順は `updated_at` 降順（lib/search/companies.ts:132）。
--    87社を一括で now() にすると**全部同値になり一覧の並びが変わる**。
--    フェーズ1は「求職者側の見え方を変えない」ことが要件なので、意図的に更新しない。
--
-- ⚠️ **`industry`(text) は残す。** 求職者側の読み手15箇所はこの列を読み続ける。
--    落とすのは事業領域（ow_business_domains）へ読み手を移した後。
--
-- 作業前ダンプ:
--   .dumps/20260825-1809-ow_industries-ow_companies-ow_saas_categories-ow_genres-ow_company_genres.sql

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_industries bigint;
  v_companies  bigint;
  v_no_text    bigint;
  r record;
BEGIN
  SELECT count(*) INTO v_industries FROM public.ow_industries;
  IF v_industries <> 110 THEN
    RAISE EXCEPTION '想定外: ow_industries が % 行（110行のはず）', v_industries;
  END IF;

  SELECT count(*) INTO v_companies FROM public.ow_companies;
  IF v_companies <> 87 THEN
    RAISE EXCEPTION '想定外: ow_companies が % 社（87社のはず）', v_companies;
  END IF;

  -- 起点は industry(text)。空だと埋められないので先に止める
  SELECT count(*) INTO v_no_text FROM public.ow_companies
   WHERE industry IS NULL OR btrim(industry) = '';
  IF v_no_text > 0 THEN
    RAISE EXCEPTION '想定外: industry(text) が空の企業が % 社ある', v_no_text;
  END IF;

  -- ⚠️ マッピング表に無い値があれば、その企業は industry_id が埋まらない。先に止める
  FOR r IN
    SELECT industry, count(*) AS n FROM public.ow_companies
     WHERE industry NOT IN (
       'AI・データ','クラウドインフラ','開発者ツール','セキュリティ','CRM・営業支援',
       'コラボレーション','経理・財務','HR・人材','マーケティング','マーケットプレイス',
       'ハードウェア・半導体','コマース・EC','ヘルスケア','金融','電設資材・卸売業','IT / SaaS')
     GROUP BY industry
  LOOP
    RAISE EXCEPTION '想定外: マッピング表に無い industry の値がある: % (%社)', r.industry, r.n;
  END LOOP;
END $$;

-- ── 1. 旧110行を消す（子 → 親の順）────────────────────────────────────────
--    ⚠️ ここで82社の industry_id が ON DELETE SET NULL で NULL になる。
--       同じトランザクション内の手順4で埋め直す。途中で落ちれば全部巻き戻る。
--    ⚠️ `WHERE true` を明示する（Supabase の safeupdate 対策。CLAUDE.md）
DELETE FROM public.ow_industries WHERE parent_id IS NOT NULL;
DELETE FROM public.ow_industries WHERE true;

-- ── 2. 同名を DB で止める ──────────────────────────────────────────────────
--    `ow_roles_name_parent_id_key : UNIQUE NULLS NOT DISTINCT (name, parent_id)` と同じ形。
--    ⚠️ 将来サブ業種を作ったとき、各親の下に「その他」を置けるように (name, parent_id) で持つ。
--       いまはフラット（parent_id が全て NULL）なので、NULLS NOT DISTINCT により
--       同名はこれ1本で止まる。
ALTER TABLE public.ow_industries
  ADD CONSTRAINT ow_industries_name_parent_id_key
  UNIQUE NULLS NOT DISTINCT (name, parent_id);

-- ── 3. 新20件を入れる（すべてフラット / parent_id = NULL）──────────────────
--    ⚠️ **これ以上値を増やさないこと。** 85社規模で分類を細かくする方向には行かない。
INSERT INTO public.ow_industries (name, slug, display_order, parent_id, is_active) VALUES
  ('IT・ソフトウェア',             'it-software',                     1,  NULL, true),
  ('インターネット・Webサービス',   'internet-web',                    2,  NULL, true),
  ('電子機器・半導体',             'electronics-semiconductor',       3,  NULL, true),
  ('通信',                        'telecom',                         4,  NULL, true),
  ('電機・機械',                   'machinery',                       5,  NULL, true),
  ('素材・化学',                   'materials-chemicals',             6,  NULL, true),
  -- 電力・ガス・石油・EV充電の置き場。素材・化学とも電機・機械とも別（2026-08-25 追加）
  ('エネルギー・インフラ',          'energy-infrastructure',           7,  NULL, true),
  ('食品・飲料',                   'food-beverage',                   8,  NULL, true),
  ('商社・卸売',                   'trading-wholesale',               9,  NULL, true),
  ('小売・流通',                   'retail-distribution',            10,  NULL, true),
  ('金融・保険',                   'finance-insurance',              11,  NULL, true),
  ('不動産・建設',                 'realestate-construction',        12,  NULL, true),
  ('運輸・物流',                   'logistics',                      13,  NULL, true),
  ('医療・ヘルスケア',             'healthcare',                     14,  NULL, true),
  ('教育',                        'education',                      15,  NULL, true),
  /* ⚠️ 「人材サービス」と「コンサルティング」は**分けてある**（2026-08-25）。
        求職者にとって別業界であり、まとめるとコンサルティングファームが
        人材紹介会社と同じ箱に入る。Opinio 自身が人材紹介業なので分類先も曖昧になる。
        **統合し直さないこと。** */
  ('人材サービス',                 'hr-services',                    16,  NULL, true),
  ('コンサルティング',             'consulting',                     17,  NULL, true),
  ('メディア・広告・エンタメ',      'media-advertising-entertainment', 18,  NULL, true),
  ('公共・団体',                   'public-organization',            19,  NULL, true),
  ('その他サービス',               'other-services',                 20,  NULL, true);

-- ── 4. 87社の industry_id を industry(text) から機械的に埋める ─────────────
--    ⚠️ 対象の値を明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
--       ここに書いた16値以外は、上の事前チェックで既に弾いている。
UPDATE public.ow_companies c
   SET industry_id = i.id
  FROM (VALUES
    -- 事業領域（機能軸）で分かれているだけで、業種としては全て IT・ソフトウェア
    ('AI・データ',           'it-software'),
    ('クラウドインフラ',      'it-software'),
    ('開発者ツール',          'it-software'),
    ('セキュリティ',          'it-software'),
    ('CRM・営業支援',        'it-software'),
    ('コラボレーション',      'it-software'),
    ('経理・財務',           'it-software'),
    ('HR・人材',             'it-software'),
    ('マーケティング',        'it-software'),
    -- Ubie（ヘルスケア）/ nCino（金融）はどちらも SaaS を売る企業。対象業界が特定なだけ
    ('ヘルスケア',           'it-software'),
    ('金融',                'it-software'),
    -- 粒度が粗い旧値。Third Box / TYU / データプールの3社
    ('IT / SaaS',           'it-software'),
    -- Uber / Mirakl。自社でWebサービスを運営する
    ('マーケットプレイス',    'internet-web'),
    -- Apple / Intel / NVIDIA / Qualcomm / Dell / Lenovo / 日本HP
    ('ハードウェア・半導体',  'electronics-semiconductor'),
    -- アサヒビール。IT/SaaS 企業ではない（旧値がコマース・ECだったのは誤り）
    ('コマース・EC',         'food-beverage'),
    -- 海光電業。電線・ケーブルの専門商社
    ('電設資材・卸売業',      'trading-wholesale')
  ) AS m(industry_text, slug)
  JOIN public.ow_industries i ON i.slug = m.slug
 WHERE c.industry = m.industry_text;

-- ── 5. 事後チェック（1社でも欠けたら全部巻き戻す）──────────────────────────
DO $$
DECLARE
  v_rows bigint; v_null bigint; v_flat bigint;
  v_soft bigint; v_web bigint; v_elec bigint; v_trade bigint; v_food bigint;
BEGIN
  SELECT count(*) INTO v_rows FROM public.ow_industries;
  IF v_rows <> 20 THEN
    RAISE EXCEPTION '事後チェック失敗: ow_industries が % 行（20行のはず）', v_rows;
  END IF;

  SELECT count(*) INTO v_flat FROM public.ow_industries WHERE parent_id IS NOT NULL;
  IF v_flat <> 0 THEN
    RAISE EXCEPTION '事後チェック失敗: parent_id が入った行が % 件ある（フラットのはず）', v_flat;
  END IF;

  -- ★ これが本命。1社でも NULL なら中止する
  SELECT count(*) INTO v_null FROM public.ow_companies WHERE industry_id IS NULL;
  IF v_null <> 0 THEN
    RAISE EXCEPTION '事後チェック失敗: industry_id が NULL の企業が % 社ある', v_null;
  END IF;

  -- 分布が予行（2026-08-25 の SELECT）と一致すること
  SELECT count(*) INTO v_soft  FROM public.ow_companies c JOIN public.ow_industries i ON i.id=c.industry_id WHERE i.slug='it-software';
  SELECT count(*) INTO v_web   FROM public.ow_companies c JOIN public.ow_industries i ON i.id=c.industry_id WHERE i.slug='internet-web';
  SELECT count(*) INTO v_elec  FROM public.ow_companies c JOIN public.ow_industries i ON i.id=c.industry_id WHERE i.slug='electronics-semiconductor';
  SELECT count(*) INTO v_trade FROM public.ow_companies c JOIN public.ow_industries i ON i.id=c.industry_id WHERE i.slug='trading-wholesale';
  SELECT count(*) INTO v_food  FROM public.ow_companies c JOIN public.ow_industries i ON i.id=c.industry_id WHERE i.slug='food-beverage';

  IF v_soft  <> 76 THEN RAISE EXCEPTION '事後チェック失敗: IT・ソフトウェア が % 社（76社のはず）', v_soft;  END IF;
  IF v_elec  <> 7  THEN RAISE EXCEPTION '事後チェック失敗: 電子機器・半導体 が % 社（7社のはず）', v_elec;  END IF;
  IF v_web   <> 2  THEN RAISE EXCEPTION '事後チェック失敗: インターネット・Webサービス が % 社（2社のはず）', v_web; END IF;
  IF v_trade <> 1  THEN RAISE EXCEPTION '事後チェック失敗: 商社・卸売 が % 社（1社のはず）', v_trade; END IF;
  IF v_food  <> 1  THEN RAISE EXCEPTION '事後チェック失敗: 食品・飲料 が % 社（1社のはず）', v_food;  END IF;
END $$;

-- ── 6. 割り当てが「仮値」であることを列に記録する ──────────────────────────
COMMENT ON COLUMN public.ow_companies.industry_id IS
  '2026-08-25 に industry(text) から機械導出した仮の割り当て。自社Webサービス運営企業（Google / Meta / Uber / Indeed 等）がIT・ソフトウェアに寄っている可能性があり未検証';

COMMIT;
