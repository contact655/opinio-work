-- ═══════════════════════════════════════════════════════════════════════════
-- ロゴ差し替え 第1バッチ（5社）の logo_url を .jpg → .png に直す（2026-08-28）
--
-- ── 何をしたか ──────────────────────────────────────────────────────────────
-- 今回まで手つかずだった6社のうち、**上から5社**を差し替えた
-- （ザクトリー / Kong / New Relic / ゲインサイト / シンカ）。
-- 実ファイルは `scripts/upload-logos-20260828d.mjs` で
-- `companies/logos/{id}/logo.png` の**固定名 + upsert**で上げてある（`1cddb4ca` の形）。
--
-- ⚠️★**この migration が触るのは2社だけ。** 残り3社（Kong / New Relic / シンカ）は
--    `logo_url` が元から `.../logo.png` を指しており、**同じキーを上書きしたので
--    DB は触らなくても反映される**（応答は `cache-control: no-cache`）。
--
-- | 会社 | 差し替え前 | 後 | DB |
-- |---|---|---|---|
-- | ザクトリー | 1366x855 比1.6 **★ロゴではなく「手とAIのイメージ写真」** | 256x256 透過 | **.jpg → .png** |
-- | ゲインサイト | 1200x675 比1.78（青地の OGP） | 180x180 青地 | **.jpg → .png** |
-- | Kong | 1682x936 比1.8 | 181x181 黄緑地 | 変更なし |
-- | New Relic | 2400x1352 比1.78 | 180x180 透過 | 変更なし |
-- | シンカ | 1200x630 比1.9 | 256x256 白地 | 変更なし |
--
-- ── ★拡張子が変わるので、旧 `.jpg` が孤児として2件残る ─────────────────────
-- CLAUDE.md の既知の例外（「拡張子が変わる差し替えだけは1件残る。稀なので許容」）。
-- ⚠️ **ここで消さない。** Storage の削除は退避とセットで別途行うこと
--    （Supabase の日次バックアップに Storage は含まれない）。
--
-- ── ★保留2社（PKSHA Technology / フライル）には触らない ────────────────────
-- 候補が 32x32 / 36x36 しか取れず、**現行の letter フォールバックのほうが良い可能性**が
-- あるため判断を保留（柴さん・2026-08-28）。**`logo_url` は NULL のまま。**
--
-- ── 一巡済み8社には触らない ────────────────────────────────────────────────
-- MongoDB / クアルコム / ブレイズ / Translead / オクタ / コンカー / シスコ / ワークデイ。
-- 3経路を当たり切った記録があり、Wikimedia は第三者の描き直しが混ざるため不採用の判断済み。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-2351-ow_companies.sql（スキーマ+データ / 88行）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_jpg int; v_png int;
BEGIN
  -- ★対象2社がまだ .jpg を指していること
  SELECT count(*) INTO v_jpg FROM public.ow_companies
   WHERE id IN ('1241f8a5-b645-4aa2-9fa1-bbfc573f1774',   -- ザクトリー
                '4fecbf31-498c-40b0-a04e-3a6cb978433f')   -- ゲインサイト
     AND logo_url LIKE '%/logo.jpg';
  IF v_jpg <> 2 THEN RAISE EXCEPTION '.jpg を指す対象が % 社（2 のはず）。前提が違う。中止', v_jpg; END IF;

  -- ★DB を触らない3社が既に .png を指していること（触らずに反映される根拠）
  SELECT count(*) INTO v_png FROM public.ow_companies
   WHERE id IN ('e459ac79-5dad-499d-bb65-b758d4281123',   -- Kong
                '0d4734e0-0717-475e-a6d1-806aa2cd45ff',   -- New Relic
                '28b826eb-fb86-4124-aa08-c489cad662f1')   -- シンカ
     AND logo_url LIKE '%/logo.png';
  IF v_png <> 3 THEN RAISE EXCEPTION '.png を指す対象が % 社（3 のはず）。中止', v_png; END IF;

  RAISE NOTICE '適用前: .jpg % 社 / .png % 社', v_jpg, v_png;
END $$;

/* ⚠️ 対象は id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
      さらに現在値（`LIKE '%/logo.jpg'`）まで確認してから書き換える。 */
UPDATE public.ow_companies
   SET logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/1241f8a5-b645-4aa2-9fa1-bbfc573f1774/logo.png'
 WHERE id = '1241f8a5-b645-4aa2-9fa1-bbfc573f1774' AND logo_url LIKE '%/logo.jpg';

UPDATE public.ow_companies
   SET logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/4fecbf31-498c-40b0-a04e-3a6cb978433f/logo.png'
 WHERE id = '4fecbf31-498c-40b0-a04e-3a6cb978433f' AND logo_url LIKE '%/logo.jpg';

DO $$
DECLARE v_left int; v_five int; v_null int; v_total int;
BEGIN
  SELECT count(*) INTO v_left FROM public.ow_companies
   WHERE id IN ('1241f8a5-b645-4aa2-9fa1-bbfc573f1774','4fecbf31-498c-40b0-a04e-3a6cb978433f')
     AND logo_url LIKE '%/logo.jpg';
  IF v_left <> 0 THEN RAISE EXCEPTION '.jpg が % 社残っている。中止', v_left; END IF;

  -- ★第1バッチ5社が全員 logo.png を指していること
  SELECT count(*) INTO v_five FROM public.ow_companies
   WHERE id IN ('1241f8a5-b645-4aa2-9fa1-bbfc573f1774','e459ac79-5dad-499d-bb65-b758d4281123',
                '0d4734e0-0717-475e-a6d1-806aa2cd45ff','4fecbf31-498c-40b0-a04e-3a6cb978433f',
                '28b826eb-fb86-4124-aa08-c489cad662f1')
     AND logo_url LIKE '%/logo.png';
  IF v_five <> 5 THEN RAISE EXCEPTION '5社中 % 社しか logo.png を指していない。中止', v_five; END IF;

  -- ★保留2社の logo_url を触っていないこと
  SELECT count(*) INTO v_null FROM public.ow_companies
   WHERE name IN ('株式会社PKSHA Technology','株式会社フライル') AND logo_url IS NULL;
  IF v_null <> 2 THEN RAISE EXCEPTION '保留2社の logo_url が NULL でない。中止'; END IF;

  SELECT count(*) INTO v_total FROM public.ow_companies;
  IF v_total <> 88 THEN RAISE EXCEPTION 'ow_companies が % 行（88 のはず）。中止', v_total; END IF;

  RAISE NOTICE '完了: .jpg 残り % / 5社とも logo.png % / 保留2社 NULL % / 全 % 行',
    v_left, v_five, v_null, v_total;
END $$;

COMMIT;
