-- ═══════════════════════════════════════════════════════════════════════════
-- anon から INSERT / UPDATE / DELETE を剥奪する（閲覧計測の2テーブルを除く）
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- baseline の GRANT ALL により、anon に ow_* のほぼ全テーブルで
-- INSERT / UPDATE / DELETE が出ていた。
-- 実際に匿名で書けるのは RLS が許している2本だけなので**現時点で実害は無い**が、
-- 「権限としては出ている」状態で、RLS を1本足し間違えた瞬間に書けるようになる。
-- 深さ2の防御にするため、権限側でも閉じる。
--
-- ⚠️ SELECT には触らない。今回の対象は書き込みのみ。
-- ⚠️ 除外する2テーブル（匿名の閲覧計測。RLS で明示的に開いている）:
--      ow_page_views  … "anyone can insert page views" FOR INSERT WITH CHECK (true)
--      ow_job_views   … "anyone can log views"        FOR INSERT WITH CHECK (true)
--    どちらもアプリからの参照は 0 件で現在は未使用だが、設計意図としては残す。
-- ⚠️ 対象は public スキーマの ow_* のみ。テーブル名を直書きせず、
--    実際に権限が出ているものを動的に洗って剥がす（テーブルが増減しても追随する）。
--
-- ── アプリへの影響（事前確認済み）──────────────────────────────────────────
-- 匿名で書き込む機能は存在しない。
-- 問い合わせ系のテーブル（ow_contact_submissions / ow_career_agent_leads）は
-- アプリからの参照が 0 件で、フォーム自体が実装されていない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_keep text[] := ARRAY['ow_page_views','ow_job_views'];
  v_before int; v_after int; v_tables int; v_names text;
  r record;
BEGIN
  -- ── 事前チェック ──────────────────────────────────────────────────────────
  SELECT count(*) INTO v_before
    FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='anon'
     AND privilege_type IN ('INSERT','UPDATE','DELETE')
     AND table_name LIKE 'ow_%';
  IF v_before = 0 THEN RAISE EXCEPTION 'anon に書き込み権限が無い。既に適用済み？中止'; END IF;

  SELECT count(DISTINCT table_name) INTO v_tables
    FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='anon'
     AND privilege_type IN ('INSERT','UPDATE','DELETE')
     AND table_name LIKE 'ow_%' AND table_name <> ALL (v_keep);
  RAISE NOTICE '適用前: anon の書き込み権限 % 件（% テーブル分。除外2テーブルを含まず）', v_before, v_tables;

  -- 除外する2テーブルに権限があること（無ければ想定が違う）
  IF (SELECT count(DISTINCT table_name) FROM information_schema.role_table_grants
       WHERE table_schema='public' AND grantee='anon' AND privilege_type='INSERT'
         AND table_name = ANY (v_keep)) <> 2 THEN
    RAISE EXCEPTION '除外予定の2テーブルに anon の INSERT が無い。想定が違う。中止';
  END IF;

  -- ── 剥奪 ──────────────────────────────────────────────────────────────────
  FOR r IN
    SELECT DISTINCT table_name
      FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='anon'
       AND privilege_type IN ('INSERT','UPDATE','DELETE')
       AND table_name LIKE 'ow_%' AND table_name <> ALL (v_keep)
     ORDER BY table_name
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE public.%I FROM anon', r.table_name);
  END LOOP;

  -- ── 事後チェック ──────────────────────────────────────────────────────────
  SELECT count(*), string_agg(DISTINCT table_name, ', ' ORDER BY table_name) INTO v_after, v_names
    FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='anon'
     AND privilege_type IN ('INSERT','UPDATE','DELETE')
     AND table_name LIKE 'ow_%';

  -- 残ってよいのは除外2テーブルのぶんだけ
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='anon'
       AND privilege_type IN ('INSERT','UPDATE','DELETE')
       AND table_name LIKE 'ow_%' AND table_name <> ALL (v_keep)
  ) THEN
    RAISE EXCEPTION '剥がしきれていない（残り: %）。ロールバック', v_names;
  END IF;

  -- SELECT を巻き込んでいないこと
  IF (SELECT count(*) FROM information_schema.role_table_grants
       WHERE table_schema='public' AND grantee='anon' AND privilege_type='SELECT'
         AND table_name LIKE 'ow_%') < 80 THEN
    RAISE EXCEPTION 'anon の SELECT を巻き込んだ。ロールバック';
  END IF;

  -- authenticated / service_role を巻き込んでいないこと
  IF (SELECT count(DISTINCT table_name) FROM information_schema.role_table_grants
       WHERE table_schema='public' AND grantee='authenticated'
         AND privilege_type IN ('INSERT','UPDATE','DELETE') AND table_name LIKE 'ow_%') < 80 THEN
    RAISE EXCEPTION 'authenticated の書き込み権限を巻き込んだ。ロールバック';
  END IF;

  RAISE NOTICE '完了: % テーブルから剥奪。残る anon の書き込みは % 件（ow_page_views / ow_job_views のみ）',
    v_tables, v_after;
END $$;

COMMIT;
