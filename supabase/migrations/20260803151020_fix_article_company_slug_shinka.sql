-- ═══════════════════════════════════════════════════════════════════════════
-- 記事の company_slug の綴り違いを修正する（thinca → shinka）
--
-- ow_articles.company_slug は FK ではなく自由記述のテキスト列で、
-- 記事末尾の企業CTAのリンク（/companies/{company_slug}）を組み立てるのに使われる。
--
-- 記事 thinca-omnichannel-product-story は company_slug='thinca' だったが、
-- 株式会社シンカの実際の slug は 'shinka'。そのため /companies/thinca が 404 になっていた。
-- 企業は掲載中（is_published=true）なので、綴りを直せば正しいページに繋がる。
--
-- ⚠️ 掲載を終えた企業（LayerX / freee / Archi Village）の記事も同様に 404 だが、
--    そちらは綴りではなく企業レコード自体が無いため、この migration の対象外。
--    企業が実在し公開中のときだけ CTA を出すようコード側で対応する。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_company_id uuid;
  v_updated int;
BEGIN
  -- ── ① 修正先の企業が実在し公開中であること ──────────────────────────────
  SELECT id INTO v_company_id
    FROM ow_companies
   WHERE slug = 'shinka' AND is_published = true;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'slug=shinka の公開企業が見つからない。中止';
  END IF;

  -- ── ② 対象記事が想定どおり1件であること ─────────────────────────────────
  IF (SELECT count(*) FROM ow_articles WHERE company_slug = 'thinca') <> 1 THEN
    RAISE EXCEPTION 'company_slug=thinca の記事が % 件（想定1件）。中止',
      (SELECT count(*) FROM ow_articles WHERE company_slug = 'thinca');
  END IF;

  -- ── ③ 修正 ──────────────────────────────────────────────────────────────
  --    FK 側（company_id）は既に正しい企業を指しているので触らない。
  UPDATE ow_articles
     SET company_slug = 'shinka'
   WHERE company_slug = 'thinca';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- ── ④ 事後チェック ──────────────────────────────────────────────────────
  IF v_updated <> 1 THEN
    RAISE EXCEPTION '更新件数が % 件（想定1件）。ロールバック', v_updated;
  END IF;
  IF EXISTS (SELECT 1 FROM ow_articles WHERE company_slug = 'thinca') THEN
    RAISE EXCEPTION 'thinca が残っている。ロールバック';
  END IF;
  -- FK と slug が同じ企業を指していること
  IF EXISTS (
    SELECT 1 FROM ow_articles a
     WHERE a.company_slug = 'shinka'
       AND a.company_id IS NOT NULL
       AND a.company_id <> v_company_id
  ) THEN
    RAISE EXCEPTION 'company_id と company_slug が別の企業を指している。ロールバック';
  END IF;

  RAISE NOTICE '完了: company_slug thinca → shinka（% 件）', v_updated;
END $$;

COMMIT;
