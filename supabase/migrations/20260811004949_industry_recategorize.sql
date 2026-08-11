-- industry（業種タグ）の値とカテゴリ名を見直す（2026-08-11）
--
-- 背景:
--   tagline を25字前後に短縮した結果、「何をする会社か」の一部を industry タグが
--   背負う設計になった。その状態で値が実態と合っていない企業があるのは実害がある。
--
-- ⚠️ 複数値化（text[] / 中間テーブル）は**採用していない**。
--    カードに2タグ並ぶと一覧の流し読みが重くなるうえ、
--    「SAP=FinTech」「ウーバー=コマース・EC」「シスコ=セキュリティ」は
--    値が1つしか持てないからではなく**単に間違っている**ため、まず値と名前を直す。
--
-- ⚠️ 分類軸は1本に統一していない。業務領域と技術領域の混在は求職者向けとして許容し、
--    目指すのは「名前が実態と合っていて、相互に重ならないこと」。
--
-- ⚠️ `industry_id` / `saas_category_id` / `ow_company_genres` は触らない（別途判断）。
--
-- ── カテゴリ 11種 → 13種 ────────────────────────────────────────────────
--   改名  FinTech      → 経理・財務     （8社中 金融機関向けは nCino のみだった）
--   改名  コマース・EC  → マーケットプレイス（ウーバーが EC ではなかった。両社とも正確になる）
--   新設  開発者ツール                    （Twilio・Kong）
--   新設  金融                            （nCino）
--   存置  ヘルスケア                      （1社だが、カードのラベルとしては具体的で有用）
--   ※ ヘルスケアと金融はフィルタ側で「業種特化」グループに束ねる（INDUSTRY_GROUPS）
--
-- ⚠️ **`src/lib/search/industryGroups.ts` と必ずセットで変更すること。**
--    フィルタ選択肢は DB の distinct ではなくそこにハードコードされており、
--    片方だけ変えると「値はあるのに選択肢に無い」状態になる。
--
-- ⚠️ アサヒビール・海光電業は**対象外**。そもそも IT/SaaS 企業ではなく、
--    掲載方針の話なので値の付け替えでは解決しない。いずれも非公開なので影響なし。
--    （結果として「コマース・EC」「電設資材・卸売業」の値が残るが、非公開のため
--      フィルタにも一覧にも出ない）

BEGIN;

-- 事前チェック: 想定どおりの分布であること
DO $$
DECLARE
  v_fintech bigint; v_ec bigint;
BEGIN
  SELECT count(*) INTO v_fintech FROM public.ow_companies WHERE industry = 'FinTech';
  SELECT count(*) INTO v_ec      FROM public.ow_companies WHERE industry = 'コマース・EC';
  IF v_fintech <> 8 THEN RAISE EXCEPTION '想定外: FinTech が % 社（8社のはず）', v_fintech; END IF;
  IF v_ec <> 3 THEN RAISE EXCEPTION '想定外: コマース・EC が % 社（3社のはず）', v_ec; END IF;
END $$;

-- ── 更新 ────────────────────────────────────────────────────────────────────

-- ミラクル株式会社
--   旧: コマース・EC
--   新: マーケットプレイス
UPDATE public.ow_companies SET industry = 'マーケットプレイス', updated_at = now() WHERE id = '355ce5c6-0412-4512-8864-1d477c97c917';

-- コンカー株式会社
--   旧: FinTech
--   新: 経理・財務
UPDATE public.ow_companies SET industry = '経理・財務', updated_at = now() WHERE id = '91523b3b-15e4-4f6b-8c9b-a90b67552b9e';

-- コング・ジャパン株式会社
--   旧: クラウドインフラ
--   新: 開発者ツール
UPDATE public.ow_companies SET industry = '開発者ツール', updated_at = now() WHERE id = 'e459ac79-5dad-499d-bb65-b758d4281123';

-- SAPジャパン株式会社
--   旧: FinTech
--   新: 経理・財務
UPDATE public.ow_companies SET industry = '経理・財務', updated_at = now() WHERE id = 'bcea5e4e-94ee-4019-8ce3-237a7edf79a7';

-- HP
--   旧: ハードウェア・半導体
--   新: クラウドインフラ
UPDATE public.ow_companies SET industry = 'クラウドインフラ', updated_at = now() WHERE id = '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6';

-- Twilio Japan合同会社
--   旧: マーケティング
--   新: 開発者ツール
UPDATE public.ow_companies SET industry = '開発者ツール', updated_at = now() WHERE id = '88defb4b-b18c-437b-8b7d-d41a43232af4';

-- クーパ・ソフトウェア株式会社
--   旧: FinTech
--   新: 経理・財務
UPDATE public.ow_companies SET industry = '経理・財務', updated_at = now() WHERE id = '1027a327-18c0-4191-b27b-a28bf5781126';

-- ServiceNow Japan合同会社
--   旧: コラボレーション
--   新: クラウドインフラ
UPDATE public.ow_companies SET industry = 'クラウドインフラ', updated_at = now() WHERE id = '4df6e844-74d6-4f50-98f9-08468a12f1dc';

-- ブラックライン株式会社
--   旧: FinTech
--   新: 経理・財務
UPDATE public.ow_companies SET industry = '経理・財務', updated_at = now() WHERE id = '53ea9a54-feef-413b-8a7c-e31e4def2e11';

-- DocuSign Japan株式会社
--   旧: FinTech
--   新: 経理・財務
UPDATE public.ow_companies SET industry = '経理・財務', updated_at = now() WHERE id = 'da8cfab5-f5c2-4648-b866-895be46a1494';

-- アプティオ株式会社
--   旧: FinTech
--   新: 経理・財務
UPDATE public.ow_companies SET industry = '経理・財務', updated_at = now() WHERE id = '08e4aff6-a12c-4963-ad43-960ac9e39967';

-- シスコシステムズ合同会社
--   旧: セキュリティ
--   新: クラウドインフラ
UPDATE public.ow_companies SET industry = 'クラウドインフラ', updated_at = now() WHERE id = '27988ac1-fd93-445d-a9fd-6dad74c92686';

-- エヌシーノ合同会社
--   旧: FinTech
--   新: 金融
UPDATE public.ow_companies SET industry = '金融', updated_at = now() WHERE id = 'b8aa0e3d-828c-4bbe-b588-88450aab5739';

-- ウーバー・ジャパン株式会社
--   旧: コマース・EC
--   新: マーケットプレイス
UPDATE public.ow_companies SET industry = 'マーケットプレイス', updated_at = now() WHERE id = '943620b5-0fa2-48b4-a072-d47f900ba9f0';

-- キリバ株式会社
--   旧: FinTech
--   新: 経理・財務
UPDATE public.ow_companies SET industry = '経理・財務', updated_at = now() WHERE id = 'a1a7036b-a5c4-4328-b5db-96ac1d5e29df';

-- 富士フイルムビジネスイノベーションジャパン株式会社（非公開）
--   旧: ITサービス
--   新: コラボレーション
UPDATE public.ow_companies SET industry = 'コラボレーション', updated_at = now() WHERE id = 'b8b7a2d4-20a8-4fe1-8651-61a6503f762e';

-- Smartcamp（非公開）
--   旧: マーケティング・セールス支援
--   新: マーケティング
UPDATE public.ow_companies SET industry = 'マーケティング', updated_at = now() WHERE id = 'd079cdfe-f8f1-49db-b871-117651136362';

-- CTC（非公開）
--   旧: SIer・ITサービス
--   新: クラウドインフラ
UPDATE public.ow_companies SET industry = 'クラウドインフラ', updated_at = now() WHERE id = '138ff010-8671-414a-ab06-752d61f50dd7';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_old bigint;
  v_vertical bigint;
  r record;
BEGIN
  -- 旧カテゴリ名が公開企業に残っていないこと
  SELECT count(*) INTO v_old FROM public.ow_companies
   WHERE is_published = true AND industry IN ('FinTech', 'コマース・EC');
  IF v_old > 0 THEN
    RAISE EXCEPTION '事後チェック失敗: 旧カテゴリ名が公開企業に % 件残っている', v_old;
  END IF;

  -- 業種特化グループ（ヘルスケア + 金融）が2社であること
  SELECT count(*) INTO v_vertical FROM public.ow_companies
   WHERE is_published = true AND industry IN ('ヘルスケア', '金融');
  IF v_vertical <> 2 THEN
    RAISE EXCEPTION '事後チェック失敗: 業種特化が % 社（2社のはず）', v_vertical;
  END IF;

  -- ⚠️ 公開企業の値が、industryGroups.ts の13ラベルに全て含まれること
  FOR r IN
    SELECT industry, count(*) AS n FROM public.ow_companies
     WHERE is_published = true
       AND industry NOT IN ('AI・データ','クラウドインフラ','開発者ツール','セキュリティ',
                            'CRM・営業支援','コラボレーション','経理・財務','HR・人材',
                            'マーケティング','ハードウェア・半導体','マーケットプレイス',
                            'ヘルスケア','金融')
     GROUP BY industry
  LOOP
    RAISE EXCEPTION '事後チェック失敗: 選択肢に無い値が公開企業に残っている: % (%社)', r.industry, r.n;
  END LOOP;
END $$;

COMMIT;
