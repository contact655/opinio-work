-- ============================================================================
-- 対象業界（軸2）の仕分け — フェーズ3
--
-- 掲載83社を horizontal / vertical / 未確認 に振り分ける。
-- ⚠️ 表示側は1行も触らない。**軸2はまだどこにも出ない。**
--
-- 判定の根拠は docs/target-industry-classification-20260904.md（全社の抜粋つき）。
--
-- ⚠️★**確信度「中」の7社と「判断できない」4社は入れない（NULL のまま）。**
--    horizontal は「調べた結果そうだった」という記録なので、推測で埋めない。
--    投入後の未確認は **11社**になる（79社ではなくなる）。
--
-- 作業前ダンプ:
--   .dumps/20260904-2132-ow_companies-ow_business_domains-ow_company_business_domains-ow_company_target_industries.sql
-- ============================================================================

BEGIN;

-- ── 0. 事前チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_scoped int; v_erp int; v_listed int;
BEGIN
  SELECT count(*) INTO v_scoped FROM public.ow_companies WHERE target_industry_scope IS NOT NULL;
  IF v_scoped <> 4 THEN
    RAISE EXCEPTION 'scope が入っている企業が 4 社（建設）でない（% 社）。適用済みの可能性', v_scoped;
  END IF;

  SELECT count(*) INTO v_erp FROM public.ow_business_domains WHERE slug = 'erp';
  IF v_erp <> 0 THEN RAISE EXCEPTION '事業領域 erp が既にある。中止'; END IF;

  SELECT count(*) INTO v_listed FROM public.ow_companies
   WHERE listing_status='listed' AND coalesce(is_test,false)=false;
  IF v_listed <> 83 THEN RAISE EXCEPTION '掲載中が 83 社でない（% 社）', v_listed; END IF;
END $$;

-- ── 1. 事業領域「基幹業務システム」を新設 ──────────────────────────────────
--
--   ⚠️ nCino を「経理・財務」に入れない。あの箱は DocuSign / コンカー / BlackLine /
--      Coupa / キリバ のような**自社の経理・財務部門向け**のツール群で、
--      銀行の融資基幹システムとは顧客も用途も違う。入れると箱の意味がぼやける
--      （施工管理をコラボレーションに入れないのと同じ理屈）。
--   ⚠️ 1社だけの薄い箱になるが、それでよい（建設も4社から始めた）。
--   ⚠️★**SAPジャパン・日本オラクル・株式会社ワークデイは付け替えない。**
--      3社とも複数製品を持ち、主をどれにするかは別の判断が要る（柴さん / 2026-09-04）。
--      報告は docs/target-industry-classification-20260904.md に残してある。
INSERT INTO public.ow_business_domains (name, slug, display_order, description) VALUES
  ('基幹業務システム', 'erp', 8,
   '企業や金融機関の基幹業務そのものを担うシステム（ERP・銀行の勘定系など）。⚠ 自社の経理・財務部門向けのツール（経費精算・決算自動化など）は「経理・財務」に入れる');

-- 並び順を明示列挙で整える。⚠️ 一括 UPDATE にせず slug を全部書く
UPDATE public.ow_business_domains AS d
   SET display_order = v.ord
  FROM (VALUES
    ('ai', 1), ('infra', 2), ('devtools', 3), ('security', 4), ('crm', 5),
    ('collab', 6), ('project-management', 7), ('erp', 8), ('finance', 9),
    ('hr', 10), ('marketing', 11), ('hardware', 12), ('marketplace', 13), ('vertical', 14)
  ) AS v(slug, ord)
 WHERE d.slug = v.slug;

-- ── 2.「業種特化」の解体条件を書き直す ─────────────────────────────────────
--
--   ⚠️★**今回は解体しない。** 解体すると `?industry=healthcare` が 0件になる。
--      `LEGACY_KEYS` が `healthcare → vertical` に読み替えており、その受け皿は
--      軸2の絞り込み。**受け皿ができる日まで待つ。**
UPDATE public.ow_business_domains
   SET description = '⚠️ 暫定値。**軸2（対象業界）の絞り込みを UI に出す日に解体して消す。**'
                     || 'それより先に解体すると `?industry=healthcare` が0件になる'
                     || '（LEGACY_KEYS が healthcare → vertical に読み替えており、受け皿が軸2の絞り込みだから）。'
                     || '⚠️ 2026-09-04 に Ubie（医療・ヘルスケア）と nCino（金融・保険）へ軸2を入れたので、'
                     || '**この2社は軸1と軸2を二重に持っている**。解体時に軸1側だけを外すこと'
 WHERE slug = 'vertical';

-- ── 3. 事業領域の付け替え（コラボレーション → プロジェクト管理）────────────
--   Asana と アトラシアン。⚠️ Notion / WalkMe は据え置き（柴さんの指示）。
UPDATE public.ow_company_business_domains l
   SET domain_id = (SELECT id FROM public.ow_business_domains WHERE slug = 'project-management')
  FROM public.ow_companies c
 WHERE c.id = l.company_id
   AND c.name IN ('Asana Japan株式会社','アトラシアン株式会社')
   AND l.domain_id = (SELECT id FROM public.ow_business_domains WHERE slug = 'collab');

-- ── 4. Ubie / nCino に軸1を足す（★業種特化は付けたまま残す）────────────────
--   ⚠️ 二重に持つ期間ができる。解体の日に軸1側（業種特化）だけを外す。
INSERT INTO public.ow_company_business_domains (company_id, domain_id, is_primary, display_order)
SELECT c.id, d.id, false, 2
  FROM public.ow_companies c
  CROSS JOIN LATERAL (
    SELECT id FROM public.ow_business_domains
     WHERE slug = CASE WHEN c.name = 'Ubie株式会社' THEN 'ai' ELSE 'erp' END
  ) d
 WHERE c.name IN ('Ubie株式会社','エヌシーノ合同会社');

-- 主を新しい方へ移す（部分UNIQUE があるので、先に旧主を降ろす）
UPDATE public.ow_company_business_domains l
   SET is_primary = false, display_order = 2
  FROM public.ow_companies c
 WHERE c.id = l.company_id
   AND c.name IN ('Ubie株式会社','エヌシーノ合同会社')
   AND l.domain_id = (SELECT id FROM public.ow_business_domains WHERE slug = 'vertical');

UPDATE public.ow_company_business_domains l
   SET is_primary = true, display_order = 1
  FROM public.ow_companies c
 WHERE c.id = l.company_id
   AND ((c.name = 'Ubie株式会社'
         AND l.domain_id = (SELECT id FROM public.ow_business_domains WHERE slug = 'ai'))
     OR (c.name = 'エヌシーノ合同会社'
         AND l.domain_id = (SELECT id FROM public.ow_business_domains WHERE slug = 'erp')));

-- ── 5. horizontal 63社（確信度「高」のみ）──────────────────────────────────
--
--   ⚠️★**確信度「中」の7社は入れない**（SAPジャパン / インテル / パランティア /
--      日本IBM / アップルジャパン / irodas / シンカ）。
--      horizontal は「業界を問わないと**調べた結果**」の記録で、推測で埋めない。
--   ⚠️ 対象を社名で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
UPDATE public.ow_companies
   SET target_industry_scope = 'horizontal'
 WHERE name IN (
  'Asana Japan株式会社','Box Japan株式会社','CrowdStrike株式会社','Databricks Japan株式会社',
  'Datadog Japan株式会社','DocuSign Japan株式会社','Dropbox Japan株式会社','HubSpot Japan株式会社',
  'Indeed Japan株式会社','Meta日本法人','MongoDB Japan合同会社','New Relic株式会社',
  'Notion Labs Japan合同会社','OpenAI Japan合同会社','Sansan株式会社','ServiceNow Japan合同会社',
  'Slack Japan株式会社','Snowflake Japan株式会社','Twilio Japan合同会社','Zendesk株式会社',
  'アカマイ・テクノロジーズ合同会社','アドビ株式会社','アトラシアン株式会社','アプティオ株式会社',
  'アマゾン ウェブ サービス ジャパン合同会社','アンソロピックジャパン合同会社','ヴイエムウェア株式会社',
  'ウォークミー株式会社','エヌビディア合同会社','エラスティック株式会社','オクタ・ジャパン株式会社',
  'キリバ株式会社','グーグル合同会社','クーパ・ソフトウェア株式会社','クラウドフレア・ジャパン株式会社',
  'クリックハウス株式会社','コンカー株式会社','コング・ジャパン株式会社','コンフルエント合同会社',
  'ザクトリー株式会社','シスコシステムズ合同会社','ゼットスケーラー株式会社','デル・テクノロジーズ株式会社',
  'ノービフォー株式会社','パロアルトネットワークス株式会社','フォーティネット株式会社',
  'ブラックライン株式会社','ブレイズ株式会社','ページャーデューティー株式会社','マルケト株式会社',
  'レノボ・ジャパン合同会社','伊藤忠テクノソリューションズ株式会社',
  '富士フイルムビジネスイノベーションジャパン株式会社','日本オラクル株式会社',
  '日本ヒューレット・パッカード合同会社','日本マイクロソフト株式会社',
  '株式会社PKSHA Technology','株式会社SmartHR','株式会社Translead',
  '株式会社セールスフォース・ジャパン','株式会社フライル','株式会社ワークデイ','株式会社日本HP'
 );

-- ── 6. vertical 5社（建設4社は投入済み）────────────────────────────────────
--   ⚠️ scope を先に書く。明細はそのあと（複合FK）。
UPDATE public.ow_companies
   SET target_industry_scope = 'vertical'
 WHERE name IN ('Ubie株式会社','エヌシーノ合同会社','ゲインサイト・ジャパン株式会社',
                '株式会社Opinio','ミラクル株式会社');

INSERT INTO public.ow_company_target_industries (company_id, industry_id, is_primary, display_order)
SELECT c.id, i.id, true, 1
  FROM public.ow_companies c
  CROSS JOIN LATERAL (
    SELECT id FROM public.ow_industries WHERE slug = CASE c.name
      WHEN 'Ubie株式会社'                 THEN 'healthcare'       -- 医療・ヘルスケア
      WHEN 'エヌシーノ合同会社'             THEN 'finance-insurance' -- 金融・保険
      WHEN 'ゲインサイト・ジャパン株式会社'  THEN 'it-software'      -- IT・ソフトウェア
      WHEN '株式会社Opinio'                THEN 'it-software'      -- IT・ソフトウェア
      WHEN 'ミラクル株式会社'               THEN 'retail-distribution' -- 小売・流通
    END
  ) i
 WHERE c.name IN ('Ubie株式会社','エヌシーノ合同会社','ゲインサイト・ジャパン株式会社',
                  '株式会社Opinio','ミラクル株式会社');

-- ── 7. 事後チェック ────────────────────────────────────────────────────────
DO $$
DECLARE
  v_h int; v_v int; v_null int; v_t int; v_pm int; v_collab int; v_erp int; v_bd int;
BEGIN
  SELECT count(*) INTO v_h FROM public.ow_companies
   WHERE listing_status='listed' AND coalesce(is_test,false)=false AND target_industry_scope='horizontal';
  IF v_h <> 63 THEN RAISE EXCEPTION 'horizontal が 63 社でない（% 社）', v_h; END IF;

  SELECT count(*) INTO v_v FROM public.ow_companies
   WHERE listing_status='listed' AND coalesce(is_test,false)=false AND target_industry_scope='vertical';
  IF v_v <> 9 THEN RAISE EXCEPTION 'vertical が 9 社でない（% 社）', v_v; END IF;

  SELECT count(*) INTO v_null FROM public.ow_companies
   WHERE listing_status='listed' AND coalesce(is_test,false)=false AND target_industry_scope IS NULL;
  IF v_null <> 11 THEN RAISE EXCEPTION '未確認が 11 社でない（% 社）', v_null; END IF;

  -- 明細は 4（建設）+ 5 = 9 行。主はちょうど9件
  SELECT count(*) INTO v_t FROM public.ow_company_target_industries;
  IF v_t <> 9 THEN RAISE EXCEPTION '対象業界の明細が 9 行でない（% 行）', v_t; END IF;
  IF (SELECT count(*) FROM public.ow_company_target_industries WHERE is_primary) <> 9 THEN
    RAISE EXCEPTION '主がちょうど9件でない';
  END IF;

  -- 事業領域: プロジェクト管理 6 / コラボレーション 6 / 基幹業務システム 1
  SELECT count(*) INTO v_pm FROM public.ow_company_business_domains l
    JOIN public.ow_business_domains d ON d.id=l.domain_id WHERE d.slug='project-management';
  IF v_pm <> 6 THEN RAISE EXCEPTION 'プロジェクト管理が 6 社でない（% 社）', v_pm; END IF;

  SELECT count(*) INTO v_collab FROM public.ow_company_business_domains l
    JOIN public.ow_business_domains d ON d.id=l.domain_id WHERE d.slug='collab';
  IF v_collab <> 6 THEN RAISE EXCEPTION 'コラボレーションが 6 社でない（% 社）', v_collab; END IF;

  SELECT count(*) INTO v_erp FROM public.ow_company_business_domains l
    JOIN public.ow_business_domains d ON d.id=l.domain_id WHERE d.slug='erp';
  IF v_erp <> 1 THEN RAISE EXCEPTION '基幹業務システムが 1 社でない（% 社）', v_erp; END IF;

  -- ⚠️「業種特化」は**残す**（解体しない）。2社のまま
  IF (SELECT count(*) FROM public.ow_company_business_domains l
        JOIN public.ow_business_domains d ON d.id=l.domain_id WHERE d.slug='vertical') <> 3 THEN
    RAISE EXCEPTION '業種特化の紐づけが 3 行（うち掲載2社＋検証用1社）でない';
  END IF;

  -- 紐づけ全体は 88 + 2（Ubie/nCino に足したぶん）= 90 行
  SELECT count(*) INTO v_bd FROM public.ow_company_business_domains;
  IF v_bd <> 90 THEN RAISE EXCEPTION '事業領域の紐づけが 90 行でない（% 行）', v_bd; END IF;

  RAISE NOTICE '事後チェック OK: horizontal % / vertical % / 未確認 % / 明細 % 行', v_h, v_v, v_null, v_t;
END $$;

COMMIT;
