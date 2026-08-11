-- 出典の無い avg_salary を NULL に戻す（公開68社）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- 公開68社すべてに「700万円〜」「900万円〜」等が入っているが、**出典が1つも無い**。
-- 出所は2本の migration に完全に分かれ、どちらも URL を記載していない。
--
--   archive/157_foreign_it_companies_enrich.sql … 65社
--   archive/137_enrich_company_data.sql         …  3社
--     （セールスフォース・ジャパン / タイミー / シンカ）
--
-- ⚠️ 137 由来の3社も除外しない。157 と同じく出典が無く、
--    fit_positives（「グローバルキャリア」「Ohana文化」等）と一緒に
--    一括で書き込まれているだけで、性質は同じ。
--
-- ⚠️ 画面に直接は出ていないが、`/companies` の以下3つを裏で動かしていた。
--    ① 年収フィルタ（salaryMin）
--    ② 並び替え「年収が高い順」
--    ③ 並び替え「開示充実順」（avg_salary があると +2）
--    同じコミットで src/lib/search/companies.ts から3つとも外している。
--
-- ⚠️ 求人由来の計算値（ow_jobs の salary_min / salary_max の平均）は**残す**。
--    こちらは企業が求人に書いた実数で、出典がある。
--
-- ⚠️ DELETE はしない。列も残す。企業が /biz/company から自分で入れれば復活する。

BEGIN;

DO $$
DECLARE
  v_pub_filled int;
  v_all_filled int;
BEGIN
  SELECT count(*) INTO v_pub_filled FROM ow_companies WHERE is_published AND avg_salary IS NOT NULL;
  IF v_pub_filled <> 68 THEN
    RAISE EXCEPTION '公開かつ avg_salary ありが68社でない: %', v_pub_filled;
  END IF;

  SELECT count(*) INTO v_all_filled FROM ow_companies WHERE avg_salary IS NOT NULL;
  IF v_all_filled <> 68 THEN
    RAISE EXCEPTION '非公開にも avg_salary がある: 全体 %（想定は公開68社のみ）', v_all_filled;
  END IF;
END $$;

UPDATE ow_companies SET avg_salary = NULL WHERE is_published AND avg_salary IS NOT NULL;

DO $$
DECLARE
  v_left int;
BEGIN
  SELECT count(*) INTO v_left FROM ow_companies WHERE avg_salary IS NOT NULL;
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'avg_salary が % 社に残っている', v_left;
  END IF;
  RAISE NOTICE '公開68社の avg_salary を NULL に戻した。';
END $$;

COMMIT;
