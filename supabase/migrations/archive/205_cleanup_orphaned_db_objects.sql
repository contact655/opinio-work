-- ================================================================
-- Migration 205: 孤立DBオブジェクトの削除
-- ================================================================
-- 対象1: キャリア軌跡（Phase 1, migrations 175/176/177）
--   フロント実装（/career-trajectories）は 2026-07 に削除済み。
--   ow_career_profiles / ow_career_follows / get_public_career_steps は
--   フロント・API から参照ゼロ確認済み。
--
--   ★ ow_experiences テーブル本体・他カラム・RLS ポリシーは残す。
--     salary_man / visibility_* カラムは /profile/edit のキャリア編集機能で
--     現役使用中（CareerHistoryEditor, experiences API, mypage, u/[id]）。
--
-- 対象2: キャリア相談（/career-consultation, migrations 029/108/110）
--   フロント実装は 2026-07 に削除済み。
--   consultation_cases / ow_consultations はフロント・API から参照ゼロ確認済み。
--
-- ★ 以下は絶対に触らない:
--   - ow_experiences テーブル（職歴表示で現役）
--   - ow_casual_meetings（企業カジュアル面談で現役）
--   - ow_mentor_reservations（話せる人/mentors で現役）
-- ================================================================


-- ================================================================
-- Part 1: キャリア軌跡 孤立オブジェクト
-- ================================================================

-- ow_career_follows は ow_career_profiles を FK 参照するため先に削除
-- フォロー機能（Phase 3 土台）はフロント未実装のまま削除
DROP TABLE IF EXISTS ow_career_follows CASCADE;

-- ow_career_profiles: 軌跡の公開エンベロープ
-- テーブル削除で trg_ow_career_profiles_updated_at トリガーも同時に削除される
DROP TABLE IF EXISTS ow_career_profiles CASCADE;

-- トリガー関数（テーブルと一緒に削除されないため個別に削除）
-- migration 175 で CREATE OR REPLACE された ow_career_profiles 専用関数
DROP FUNCTION IF EXISTS ow_career_profiles_set_updated_at() CASCADE;

-- SECURITY DEFINER 関数: get_public_career_steps(UUID)
-- migration 176/177 で作成。キャリア軌跡公開ページ（/career-trajectories）から呼ばれていた。
-- フロント削除済み・参照ゼロ確認済み（2026-07-08 grep で確認）
DROP FUNCTION IF EXISTS get_public_career_steps(UUID) CASCADE;


-- ================================================================
-- Part 2: キャリア相談 孤立テーブル
-- ================================================================

-- consultation_cases: 相談事例テーブル（migrations 029, 108 で作成）
-- /career-consultation フロント削除済み。scripts/seed-consultation-cases.ts
-- も参照ゼロ（.claude/settings.local.json の allow リストにのみ残留）。
-- types.ts の型定義は自動生成のため、テーブル削除後に regenerate で消える。
DROP TABLE IF EXISTS consultation_cases CASCADE;

-- ow_consultations: 相談申請テーブル（migration 110 で作成）
-- /career-consultation/apply の Server Action から書き込んでいたが、
-- フロント削除済み・API/フロントから参照ゼロ確認済み（2026-07-08 grep で確認）。
DROP TABLE IF EXISTS ow_consultations CASCADE;
