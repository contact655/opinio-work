-- =============================================================================
-- Phase ν-3 Step 1-5 テストデータ クリーンアップ
-- 2026-05-06 実施
-- =============================================================================
-- 対象: 柴 久人 ユーザーが Step 1-5 動作確認で作成したテストデータ
-- =============================================================================

BEGIN;

-- ow_conversation_participants を先に削除 (FK制約)
DELETE FROM ow_conversation_participants
WHERE conversation_id IN (
  SELECT id FROM ow_conversations
  WHERE created_at > '2026-05-05'
    AND candidate_user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d'
);

-- ow_conversations
DELETE FROM ow_conversations
WHERE created_at > '2026-05-05'
  AND candidate_user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d';

-- ow_job_applications
DELETE FROM ow_job_applications
WHERE created_at > '2026-05-05'
  AND user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d';

-- ow_casual_meetings
DELETE FROM ow_casual_meetings
WHERE created_at > '2026-05-05'
  AND user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d';

-- 確認 (全て 0 ならば COMMIT)
SELECT 'ow_job_applications' AS tbl, COUNT(*) FROM ow_job_applications
  WHERE created_at > '2026-05-05' AND user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d'
UNION ALL
SELECT 'ow_casual_meetings', COUNT(*) FROM ow_casual_meetings
  WHERE created_at > '2026-05-05' AND user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d'
UNION ALL
SELECT 'ow_conversations', COUNT(*) FROM ow_conversations
  WHERE created_at > '2026-05-05' AND candidate_user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d'
UNION ALL
SELECT 'ow_conversation_participants', COUNT(*) FROM ow_conversation_participants
  WHERE conversation_id IN (
    SELECT id FROM ow_conversations
    WHERE created_at > '2026-05-05'
      AND candidate_user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d'
  );

COMMIT;
