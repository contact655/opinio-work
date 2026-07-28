-- ─────────────────────────────────────────────────────────────────────────────
-- layout-test 企業の完全削除（2026-07-28）
--
-- ⚠️ このファイルは意図的に「未適用」のまま保持するファイルです。
--    layout-test 企業が不要になったときに supabase db push で適用してください。
--
-- 削除対象: company_id = 'a0a0a0a0-0000-4000-8000-000000000001'
--
-- FK 制約と削除順序の整理:
--   CASCADE（ow_companies 削除時に自動削除される）:
--     ow_jobs, ow_company_tools, ow_salary_reports, ow_company_office_photos,
--     ow_company_posts, ow_activities, ow_casual_meetings, ow_company_admins,
--     ow_conversations, ow_company_genres, ow_company_members, その他多数
--
--   SET NULL（レコードは残るが FK が NULL になる → 明示削除推奨）:
--     ow_posts.ref_company_id → 系列フィード投稿が ref_company_id=NULL で残留
--     ow_experiences.company_id → 該当なし（テスト企業に社員なし）
--     ow_articles.company_id → 該当なし（テスト企業に記事なし）
--
--   NO ACTION / RESTRICT（先に削除しないとブロックされる）:
--     ow_saved_companies（delete_rule=a） → テスト企業への保存なし（スキップ可）
--     ow_scouts（delete_rule=a）         → テスト企業へのスカウトなし（スキップ可）
--     ow_placements（delete_rule=r）     → テスト企業の採用なし（スキップ可）
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  cid UUID := 'a0a0a0a0-0000-4000-8000-000000000001';
BEGIN

-- ── Step 1: SET NULL テーブルから明示削除（CASCADE では消えないレコード） ──

-- ow_posts: ref_company_id=cid のフィードポスト
-- （company_joined ポスト等が自動生成されていた場合に対応）
DELETE FROM ow_posts WHERE ref_company_id = cid;

-- ow_posts: ref_job_id が cid の求人を参照しているフィードポスト
-- （ow_jobs は CASCADE で消えるが、ow_posts.ref_job_id は SET NULL のため）
DELETE FROM ow_posts
WHERE ref_job_id IN (SELECT id FROM ow_jobs WHERE company_id = cid);

-- ── Step 2: NO ACTION / RESTRICT テーブルから明示削除（存在する場合） ──
-- テスト企業への保存・スカウト・採用は発生しないはずだが念のため

DELETE FROM ow_saved_companies WHERE company_id = cid;
DELETE FROM ow_scouts          WHERE company_id = cid;
-- ow_placements は company_id FK（RESTRICT）。テスト企業なので該当なし。
-- もし存在する場合は先に DELETE FROM ow_placements WHERE company_id = cid; を実行。

-- ── Step 3: ow_companies を削除（CASCADE が連鎖して子テーブルを一括削除） ──
DELETE FROM ow_companies WHERE id = cid;

-- 削除確認ログ
RAISE NOTICE 'layout-test company (%) deleted', cid;

END $$;
