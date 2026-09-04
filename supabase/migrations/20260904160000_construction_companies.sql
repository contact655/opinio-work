-- ============================================================================
-- 建設テック4社とゼネコン・サブコン6社の投入 — フェーズ2
--
-- 目的は「建設」という対象業界（軸2）に実企業を紐づけること。
-- ⚠️ 表示フェーズには進まない。**求職者側は1行も触っていない。**
--
-- ── A群（掲載する）建設テック4社 ────────────────────────────────────────────
--   軸1 業種       = IT・ソフトウェア
--   軸1 事業領域   = **プロジェクト管理（このファイルで新設）** を主1件
--   軸2            = vertical / 対象業界 = 建設（主）
--
-- ── B群（掲載しない）ゼネコン・サブコン6社 ─────────────────────────────────
--   目的は掲載ではなく、**建設業界出身者が職歴を入れたときに company_text
--   （自由入力）ではなく company_id で繋がるようにすること。**
--   これが無いと、建設出身の登録者ほどこの機能の対象外になる。
--   軸1 業種 = 建設 / 事業領域 = なし（IT企業ではない）/ 軸2 = 未確認(NULL)
--   is_published = false / listing_status = 'draft'
--
-- ── 出典（全社ぶん。★ow_company_data_sources には入れていない）──────────────
--   `ow_company_data_sources.field` の CHECK が `headquarters_address` の1語しか
--   許しておらず、今回記録したいのは description / url / 社名。語彙を広げるのは
--   3層（定数・CHECK・UI）の変更なので**独立した判断**にする（柴さんと合意）。
--   → ここにコメントとして残す。**すべて 2026-09-04 に公式サイトで確認した。**
--
--   A群
--     アンドパッド      https://andpad.co.jp/company/
--       ⚠️ 会社情報ページに**設立年の記載が無い**ため founded_year は入れない
--          （出典によって2012年と2014年に割れているが、公式で確認できないので空のまま）
--     スパイダープラス  https://spiderplus.co.jp/about-us/profile/
--                       https://spiderplus.co.jp/ir/stock/ （証券コード4192・東証グロース）
--       ⚠️ ベトナムは `SpiderPlus Vietnam Co., Ltd.` という**別法人（グループ会社）**。
--          支店ではないので branch_locations に入れない。既存の branch_locations も
--          12値すべて国内地名で、海外の前例は無い（2026-09-04 実測）。
--     フォトラクション  https://corporate.photoruction.com/company
--       ⚠️ url はサービス側（www.photoruction.com）を入れる。既存76社のうち
--          corp./about. のサブドメインを url にしているのは2社だけ（実測）。
--     ダンドリワーク    https://dandori-work.co.jp/company/
--       ⚠★**商号は「株式会社ダンドリワーク」。「ス」は付かない。**
--          公式の商号欄で確認した。2021年に「リブランディングに伴う商号変更」を
--          しており、これが出典の割れる原因。**「ダンドリワークス」に戻さないこと。**
--
--   B群（すべて会社概要ページで社名とURLを確認）
--     鹿島建設          https://www.kajima.co.jp/
--     大林組            https://www.obayashi.co.jp/
--     清水建設          https://www.shimz.co.jp/
--     大成建設          https://www.taisei.co.jp/
--     竹中工務店        https://www.takenaka.co.jp/
--     高砂熱学工業      https://www.tte-net.com/corporate/profile/
--       ⚠️ ドメインは `tte-net.com`。**`tths.co.jp` でも `tskk.co.jp` でもない**
--          （後者は宝商事という別会社。推測して一度間違えた）。
--
-- 作業前ダンプ:
--   .dumps/20260904-1429-ow_companies-ow_business_domains-ow_company_business_domains-ow_company_target_industries.sql
-- ============================================================================

BEGIN;

-- ── 0. 事前チェック（想定と違えば中止）──────────────────────────────────────
DO $$
DECLARE v_dup int; v_ind int; v_dom int;
BEGIN
  -- 10社が既に存在しないこと（normalized_name と素の名前の両方で見る）
  SELECT count(*) INTO v_dup FROM public.ow_companies
   WHERE name IN ('株式会社アンドパッド','スパイダープラス株式会社','株式会社フォトラクション',
                  '株式会社ダンドリワーク','株式会社ダンドリワークス',
                  '鹿島建設株式会社','株式会社大林組','清水建設株式会社',
                  '大成建設株式会社','株式会社竹中工務店','高砂熱学工業株式会社')
      OR slug IN ('andpad','spiderplus','photoruction','dandori-work',
                  'kajima','obayashi','shimizu','taisei','takenaka','takasago-thermal');
  IF v_dup <> 0 THEN
    RAISE EXCEPTION '投入対象と重なる企業が既に % 件ある。中止', v_dup;
  END IF;

  -- 業種マスタに「IT・ソフトウェア」と「建設」があること
  SELECT count(*) INTO v_ind FROM public.ow_industries
   WHERE slug IN ('it-software','construction') AND is_active;
  IF v_ind <> 2 THEN
    RAISE EXCEPTION '業種マスタに it-software / construction が揃っていない（% 件）', v_ind;
  END IF;

  -- 事業領域「プロジェクト管理」がまだ無いこと
  SELECT count(*) INTO v_dom FROM public.ow_business_domains
   WHERE slug = 'project-management' OR name = 'プロジェクト管理';
  IF v_dom <> 0 THEN
    RAISE EXCEPTION 'プロジェクト管理が既にある。適用済みの可能性。中止';
  END IF;
END $$;

-- ── 1. 事業領域「プロジェクト管理」を新設 ──────────────────────────────────
--
--   ⚠️ 2026-08-25 の「新設しない」は**器を作る当日限定の制約**だった
--      （見え方の変化の原因を切り分けられなくなるため）。器は既に出ているので該当しない。
--   ⚠️「実データが1社以上ある値だけ作る」は満たす（このファイルで4社入る）。
--
--   ⚠️★**コラボレーションに入れなかった理由を残す。** 施工管理アプリを
--      Slack や Box と同じ箱に入れると、事業領域フィルタの意味が壊れる。
--      施工管理は情報共有ツールではない（柴さんの判断 / 2026-09-04）。
--   ⚠️★**業種特化にも入れない。** あの値の description は「軸2を入れる日に
--      解体して消す」。畳む予定の値に新しく4行足さない。
INSERT INTO public.ow_business_domains (name, slug, display_order, description) VALUES
  ('プロジェクト管理', 'project-management', 7,
   '工程・タスク・現場の進行を管理する。⚠ 情報共有そのものを主目的にするもの（Slack / Box など）は「コラボレーション」に入れる');

-- 並び順を明示列挙で整える。⚠️ 一括 UPDATE にせず slug を全部書く
UPDATE public.ow_business_domains AS d
   SET display_order = v.ord
  FROM (VALUES
    ('ai', 1), ('infra', 2), ('devtools', 3), ('security', 4), ('crm', 5),
    ('collab', 6), ('project-management', 7), ('finance', 8), ('hr', 9),
    ('marketing', 10), ('hardware', 11), ('marketplace', 12), ('vertical', 13)
  ) AS v(slug, ord)
 WHERE d.slug = v.slug;

-- ── 2. A群 4社 ────────────────────────────────────────────────────────────
--
--   ⚠️ `is_approved = true` が必須。`check_listed_requires_approval`（CHECK）が
--      「listed なら承認済み」を要求する。既存の掲載79社も全件 true。
--   ⚠️★`published_at` を明示的に書く。migration からは `publishedAtPatch` を
--      通れないので、書かないと「いつ公開したか」を再構成できなくなる
--      （CLAUDE.md「migration で is_published を true にするときも published_at を埋める」）。
--   ⚠️ `target_industry_scope = 'vertical'` を**この INSERT で入れる。**
--      あとから UPDATE にすると、明細を先に入れられない（複合FK）。
--   ⚠️ `source = 'migration'`（既存の慣例。69社が同じ値）。
INSERT INTO public.ow_companies
  (name, slug, brand_name, url, description, industry_id,
   capital_type, capital_notes, branch_locations,
   is_published, listing_status, is_approved, published_at,
   target_industry_scope, source)
SELECT v.name, v.slug, v.brand_name, v.url, v.description,
       (SELECT id FROM public.ow_industries WHERE slug = 'it-software'),
       v.capital_type, v.capital_notes, v.branch_locations,
       true, 'listed', true, now(),
       'vertical', 'migration'
  FROM (VALUES
    ('株式会社アンドパッド', 'andpad', 'ANDPAD', 'https://andpad.co.jp/',
     '建築・建設業界向けのクラウド型建設プロジェクト管理サービス「ANDPAD」を開発・提供している。施工管理・工程管理・図面や写真の共有に加え、電子受発注、請求管理、入退場管理など、現場から経営までを一つのプラットフォームで扱う。',
     NULL::text, NULL::text, NULL::text[]),

    ('スパイダープラス株式会社', 'spiderplus', 'SPIDERPLUS', 'https://spiderplus.co.jp/',
     '建設現場向けの図面・現場管理サービス「SPIDERPLUS」を開発・提供している。ゼネコン、設備工事会社、専門工事会社などを顧客とし、紙の図面や検査記録のデジタル化を扱う。2021年に上場し、2022年に祖業である建設工事事業を譲渡して、建設業界に特化したVertical SaaSに事業を集中している。',
     /* ⚠️ capital_notes は capital_type が空だと**資本区分の行ごと画面に出ない**
           （CLAUDE.md「日系企業に capital_notes を入れるときは capital_type も併せて入れる」）。 */
     'japanese_independent', '東証グロース（証券コード4192）',
     ARRAY['札幌','仙台','名古屋','大阪','福岡']),

    ('株式会社フォトラクション', 'photoruction', 'Photoruction', 'https://www.photoruction.com/',
     '建設生産支援クラウド「Photoruction」を開発・提供している。工事写真・図面・工程などの施工管理業務を一元化するサービスで、2022年からは施工計画書の作成や検査準備を請け負う建設BPOも提供している。',
     NULL, NULL, NULL),

    ('株式会社ダンドリワーク', 'dandori-work', 'ダンドリワーク', 'https://dandori-work.co.jp/',
     '建築現場向けの施工管理アプリ「ダンドリワーク」を開発・提供している。図面・写真・工程の情報を一元管理し、工務店や現場の職人との情報共有を扱う。',
     NULL, NULL, NULL)
  ) AS v(name, slug, brand_name, url, description, capital_type, capital_notes, branch_locations);

-- A群の事業領域（主 = プロジェクト管理）
--   ⚠️ 業種が IT・ソフトウェアなので `requires_business_domain = true`。
--      主が1件ないと公開ゲートに引っかかる。
INSERT INTO public.ow_company_business_domains (company_id, domain_id, is_primary, display_order)
SELECT c.id,
       (SELECT id FROM public.ow_business_domains WHERE slug = 'project-management'),
       true, 1
  FROM public.ow_companies c
 WHERE c.slug IN ('andpad','spiderplus','photoruction','dandori-work');

-- A群の対象業界（主 = 建設）
--   ⚠️ 親の `target_industry_scope = 'vertical'` が先に入っていること（複合FK）。
INSERT INTO public.ow_company_target_industries (company_id, industry_id, is_primary, display_order)
SELECT c.id,
       (SELECT id FROM public.ow_industries WHERE slug = 'construction'),
       true, 1
  FROM public.ow_companies c
 WHERE c.slug IN ('andpad','spiderplus','photoruction','dandori-work');

-- ── 3. B群 6社（掲載しない）────────────────────────────────────────────────
--
--   ⚠️ `description` は入れない（掲載しないため）。社名・URL・業種のみ。
--   ⚠️ `is_published = false` / `listing_status = 'draft'` / `is_approved = false`。
--   ⚠️ `target_industry_scope` は **NULL（未確認）のまま**。ゼネコンの営業先を
--      この機能で扱う予定は今のところ無い。
--   ⚠️ 事業領域も付けない。建設は `requires_business_domain = false`。
INSERT INTO public.ow_companies
  (name, slug, url, industry_id, is_published, listing_status, is_approved, source)
SELECT v.name, v.slug, v.url,
       (SELECT id FROM public.ow_industries WHERE slug = 'construction'),
       false, 'draft', false, 'migration'
  FROM (VALUES
    ('鹿島建設株式会社',     'kajima',           'https://www.kajima.co.jp/'),
    ('株式会社大林組',       'obayashi',         'https://www.obayashi.co.jp/'),
    ('清水建設株式会社',     'shimizu',          'https://www.shimz.co.jp/'),
    ('大成建設株式会社',     'taisei',           'https://www.taisei.co.jp/'),
    ('株式会社竹中工務店',   'takenaka',         'https://www.takenaka.co.jp/'),
    ('高砂熱学工業株式会社', 'takasago-thermal', 'https://www.tte-net.com/')
  ) AS v(name, slug, url);

-- ── 4. 事後チェック（★「エラーが出なかった」を成功にしない）────────────────
DO $$
DECLARE
  v_listed int; v_draft int; v_targets int; v_domains int; v_pub int; v_dom_total int;
BEGIN
  -- 掲載中（検証用を除く）が 79 → 83 になる
  SELECT count(*) INTO v_listed FROM public.ow_companies
   WHERE listing_status = 'listed' AND coalesce(is_test,false) = false;
  IF v_listed <> 83 THEN
    RAISE EXCEPTION '掲載中が 83 社になっていない（% 社）', v_listed;
  END IF;

  -- B群6社は draft のまま
  SELECT count(*) INTO v_draft FROM public.ow_companies
   WHERE slug IN ('kajima','obayashi','shimizu','taisei','takenaka','takasago-thermal')
     AND listing_status = 'draft' AND is_published = false;
  IF v_draft <> 6 THEN
    RAISE EXCEPTION 'B群が draft/非公開になっていない（% 社）', v_draft;
  END IF;

  -- 対象業界「建設」に紐づく掲載企業が4社
  SELECT count(*) INTO v_targets
    FROM public.ow_company_target_industries t
    JOIN public.ow_industries i ON i.id = t.industry_id
    JOIN public.ow_companies c ON c.id = t.company_id
   WHERE i.slug = 'construction' AND c.listing_status = 'listed';
  IF v_targets <> 4 THEN
    RAISE EXCEPTION '対象業界「建設」の掲載企業が 4 社でない（% 社）', v_targets;
  END IF;

  -- 事業領域は 84 → 88 行（A群4社ぶんだけ増える）
  SELECT count(*) INTO v_dom_total FROM public.ow_company_business_domains;
  IF v_dom_total <> 88 THEN
    RAISE EXCEPTION '事業領域の紐づけが 88 行になっていない（% 行）', v_dom_total;
  END IF;

  -- A群4社に主の事業領域が1件ずつ（公開ゲートの条件）
  SELECT count(*) INTO v_domains FROM public.ow_company_business_domains l
    JOIN public.ow_companies c ON c.id = l.company_id
   WHERE c.slug IN ('andpad','spiderplus','photoruction','dandori-work') AND l.is_primary;
  IF v_domains <> 4 THEN
    RAISE EXCEPTION 'A群の主の事業領域が 4 件でない（% 件）', v_domains;
  END IF;

  -- published_at が4社とも入っている
  SELECT count(*) INTO v_pub FROM public.ow_companies
   WHERE slug IN ('andpad','spiderplus','photoruction','dandori-work')
     AND published_at IS NOT NULL;
  IF v_pub <> 4 THEN
    RAISE EXCEPTION 'A群の published_at が 4 社ぶん入っていない（% 社）', v_pub;
  END IF;

  RAISE NOTICE '事後チェック OK: 掲載 % 社 / 建設の対象業界 % 社 / 事業領域 % 行', v_listed, v_targets, v_dom_total;
END $$;

COMMIT;
