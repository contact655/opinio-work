-- 使われなくなった企業向け集計ビュー3つを削除する（2026-09-22）。
--
-- ■ なぜ消すか
--   ow_business_monthly_stats / ow_business_job_performance / ow_business_todo_counts は
--   /biz/analytics（当月カード・6か月グラフ・求人ごとの閲覧数と転換率・対応が必要な項目）の
--   ためのビューだったが、数えている表が実態と合っていなかった。
--     ・応募 … ow_applications を数えていた。アプリが応募を記録するのは ow_job_applications で、
--              ow_applications に書き込むコードは src に1つも無い
--     ・閲覧数 … ow_job_views を数えていた。書き込むコードが無い
--     ・スカウト … ビューの定義に 0 と直書き
--   つまり画面は常に0だった。2026-09-21 に /biz/analytics（853d7c32）からこれらの読み出しを
--   外し、2026-09-22 に読み出し関数（getMonthlyStats / getJobPerformance / getTodoCounts）も消した。
--
-- ■ 消す前に確かめたこと（2026-09-22）
--   ・src からの参照: 0件（コメントのみ）
--   ・DB 内の依存: 他のビュー・関数・ポリシーからの参照 0件（pg_depend / 関数本文 / ポリシー式）
--   ・定義は作業前ダンプに保存（.dumps/20260922-0109-ow_business_*.sql。コミットしない）
--   ・戻すときは baseline（20260727000000_baseline.sql）の CREATE VIEW を当て直せばよい
--
-- ⚠️ CASCADE は付けない。想定外の依存があれば、ここで止まってほしい。
-- ⚠️ 表（ow_applications / ow_job_views）は今回は消さない。別途判断する。

DO $$
DECLARE
  dependents int;
BEGIN
  SELECT count(*) INTO dependents
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class dv ON dv.oid = r.ev_class
    JOIN pg_class v  ON v.oid = d.refobjid
   WHERE v.relname IN ('ow_business_monthly_stats','ow_business_job_performance','ow_business_todo_counts')
     AND dv.relname NOT IN ('ow_business_monthly_stats','ow_business_job_performance','ow_business_todo_counts');
  IF dependents > 0 THEN
    RAISE EXCEPTION 'ow_business_* ビューに依存するビューが % 件ある。中止する', dependents;
  END IF;
END $$;

DROP VIEW IF EXISTS public.ow_business_monthly_stats;
DROP VIEW IF EXISTS public.ow_business_job_performance;
DROP VIEW IF EXISTS public.ow_business_todo_counts;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
     WHERE relnamespace = 'public'::regnamespace
       AND relname IN ('ow_business_monthly_stats','ow_business_job_performance','ow_business_todo_counts')
  ) THEN
    RAISE EXCEPTION 'ow_business_* ビューが残っている';
  END IF;
END $$;
