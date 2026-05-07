-- ============================================================
-- Phase ν-4 Sub-step 4A-5: biz UI 検証用テストデータ
-- 作成日: 2026-05-08
-- 目的: /biz/conversations 一覧・詳細ページ（4A-6, 4A-7）の動作確認
-- 削除: 末尾の「削除 SQL」セクション（コメントアウト状態）を参照
-- ============================================================
--
-- 投入対象:
--   企業A: テスト株式会社_001 (id: fde82347-f2ac-4e54-a2ab-f5c7c45acb79)
--   企業B: テスト株式会社_002 (id: 19d43f7b-7288-40d3-a9c0-8427bfe3a42e)
--   候補者: 柴 久人 (id: e826e0bd-f96b-42ec-acda-d8f482e1417d)
--
-- 使用する既存 HR（ow_company_admins 登録済み）:
--   Initial HR_A: テスト担当者_001 (user_id: 1c21269b-d06a-4ecf-97bd-663c0027e86a)
--   Initial HR_B: テスト担当者_002 (user_id: f8526fdb-fdbd-4202-bc02-4e978255d7fb)
--
-- 追加参加テスト用 HR（4A-7 lazy registration 検証のため participants には入れない）:
--   追加 HR_A: テスト担当者_005 (user_id: 8feca16e-ca2a-4a22-8a11-14af2aafa2b8)
--     → テスト株式会社_001 に 2 名目 member として追加
--   追加 HR_B: テスト担当者_006 (user_id: e2ef2e4e-6edc-4315-9dc4-87080b264a62)
--     → テスト株式会社_002 に 2 名目 member として追加
--
-- 投入後の想定状態:
--   ow_conversations        : 既存 2 件 + 新規 2 件 = 計 4 件
--   ow_conversation_participants: 既存 2 件 + 新規 4 件（各対話 candidate+hr）= 計 6 件
--   ow_conversation_messages: 0 件 → 新規 4 件（各対話 2 往復）
--   ow_company_admins       : 既存 1 名/社 + 2 名追加（_001, _002 各社に 2 名目）
-- ============================================================

BEGIN;

-- ============================================================
-- [1] 追加参加テスト用 HR を ow_company_admins に登録
--     (Sub-step 4A-7 の lazy registration シナリオ用)
--     ※ ON CONFLICT DO NOTHING で冪等性確保
-- ============================================================

INSERT INTO ow_company_admins (user_id, company_id, permission, is_active)
VALUES
  (
    '8feca16e-ca2a-4a22-8a11-14af2aafa2b8',  -- テスト担当者_005
    'fde82347-f2ac-4e54-a2ab-f5c7c45acb79',  -- テスト株式会社_001
    'member',
    true
  ),
  (
    'e2ef2e4e-6edc-4315-9dc4-87080b264a62',  -- テスト担当者_006
    '19d43f7b-7288-40d3-a9c0-8427bfe3a42e',  -- テスト株式会社_002
    'member',
    true
  )
ON CONFLICT (user_id, company_id) DO NOTHING;

-- ============================================================
-- [2] 対話 + 参加者 + メッセージを CTE で一括 INSERT
--     各 CTE の依存関係:
--       conv1/conv2  → p1_*/p2_*  → msg1_*/msg2_*  → update_*
-- ============================================================

WITH

  -- ---- 対話1: 柴 久人 × テスト株式会社_001 ----
  conv1 AS (
    INSERT INTO ow_conversations (kind, stage, status, company_id, candidate_user_id)
    VALUES (
      'company',
      'active',
      'active',
      'fde82347-f2ac-4e54-a2ab-f5c7c45acb79',  -- テスト株式会社_001
      'e826e0bd-f96b-42ec-acda-d8f482e1417d'   -- 柴 久人
    )
    RETURNING id
  ),

  p1_candidate AS (
    INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
    SELECT id, 'e826e0bd-f96b-42ec-acda-d8f482e1417d', 'candidate'
    FROM conv1
    RETURNING id, conversation_id
  ),

  p1_hr AS (
    INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
    SELECT id, '1c21269b-d06a-4ecf-97bd-663c0027e86a', 'company_admin'
    FROM conv1
    RETURNING id, conversation_id
  ),

  msg1_1 AS (
    -- 候補者からの最初のメッセージ
    INSERT INTO ow_conversation_messages (conversation_id, sender_participant_id, body, sent_at)
    SELECT
      p1_candidate.conversation_id,
      p1_candidate.id,
      'はじめまして。御社のプロダクト開発の取り組みに関心があり、ご連絡いたしました。カジュアルにお話を聞かせていただけますでしょうか。',
      NOW() - INTERVAL '2 days'
    FROM p1_candidate
    RETURNING id
  ),

  msg1_2 AS (
    -- HR からの返信
    INSERT INTO ow_conversation_messages (conversation_id, sender_participant_id, body, sent_at)
    SELECT
      p1_hr.conversation_id,
      p1_hr.id,
      'ご連絡いただきありがとうございます！ぜひお話しましょう。来週以降でご都合の良いお時間はありますか？',
      NOW() - INTERVAL '1 day'
    FROM p1_hr
    RETURNING id
  ),

  -- ---- 対話2: 柴 久人 × テスト株式会社_002 ----
  conv2 AS (
    INSERT INTO ow_conversations (kind, stage, status, company_id, candidate_user_id)
    VALUES (
      'company',
      'active',
      'active',
      '19d43f7b-7288-40d3-a9c0-8427bfe3a42e',  -- テスト株式会社_002
      'e826e0bd-f96b-42ec-acda-d8f482e1417d'   -- 柴 久人
    )
    RETURNING id
  ),

  p2_candidate AS (
    INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
    SELECT id, 'e826e0bd-f96b-42ec-acda-d8f482e1417d', 'candidate'
    FROM conv2
    RETURNING id, conversation_id
  ),

  p2_hr AS (
    INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
    SELECT id, 'f8526fdb-fdbd-4202-bc02-4e978255d7fb', 'company_admin'
    FROM conv2
    RETURNING id, conversation_id
  ),

  msg2_1 AS (
    -- 候補者からの最初のメッセージ
    INSERT INTO ow_conversation_messages (conversation_id, sender_participant_id, body, sent_at)
    SELECT
      p2_candidate.conversation_id,
      p2_candidate.id,
      '貴社のエンジニアリング文化に共感し、ご連絡いたしました。特に技術的な課題や組織の雰囲気についてお話を伺えればと思います。',
      NOW() - INTERVAL '3 days'
    FROM p2_candidate
    RETURNING id
  ),

  msg2_2 AS (
    -- HR からの返信
    INSERT INTO ow_conversation_messages (conversation_id, sender_participant_id, body, sent_at)
    SELECT
      p2_hr.conversation_id,
      p2_hr.id,
      'お声がけいただきありがとうございます。ぜひ弊社のエンジニアリングについてお話しできればと思います。まずはオンラインでいかがでしょうか。',
      NOW() - INTERVAL '2 days 12 hours'
    FROM p2_hr
    RETURNING id
  ),

  -- ---- last_message_at を更新 ----
  update_conv1 AS (
    UPDATE ow_conversations
    SET last_message_at = NOW() - INTERVAL '1 day'
    WHERE id = (SELECT id FROM conv1)
    RETURNING id
  ),

  update_conv2 AS (
    UPDATE ow_conversations
    SET last_message_at = NOW() - INTERVAL '2 days 12 hours'
    WHERE id = (SELECT id FROM conv2)
    RETURNING id
  )

-- 投入結果を確認用に返す
SELECT
  (SELECT id FROM conv1)        AS conv1_id,
  (SELECT id FROM conv2)        AS conv2_id,
  (SELECT id FROM p1_candidate) AS p1_candidate_participant_id,
  (SELECT id FROM p1_hr)        AS p1_hr_participant_id,
  (SELECT id FROM p2_candidate) AS p2_candidate_participant_id,
  (SELECT id FROM p2_hr)        AS p2_hr_participant_id;

COMMIT;


-- ============================================================
-- 削除 SQL（フェーズ終了時 / クリーンアップ時に使用）
-- Sub-step 4A-8 の引き継ぎ書で案内する
-- 実行する場合は BEGIN; ... COMMIT; で囲むこと
-- ============================================================

-- BEGIN;
--
-- -- [1] messages を先に削除（FK 依存）
-- DELETE FROM ow_conversation_messages
-- WHERE conversation_id IN (
--   SELECT id FROM ow_conversations
--   WHERE company_id IN (
--     'fde82347-f2ac-4e54-a2ab-f5c7c45acb79',  -- テスト株式会社_001
--     '19d43f7b-7288-40d3-a9c0-8427bfe3a42e'   -- テスト株式会社_002
--   )
--   AND candidate_user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d'
-- );
--
-- -- [2] participants を削除
-- DELETE FROM ow_conversation_participants
-- WHERE conversation_id IN (
--   SELECT id FROM ow_conversations
--   WHERE company_id IN (
--     'fde82347-f2ac-4e54-a2ab-f5c7c45acb79',
--     '19d43f7b-7288-40d3-a9c0-8427bfe3a42e'
--   )
--   AND candidate_user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d'
-- );
--
-- -- [3] conversations を削除
-- DELETE FROM ow_conversations
-- WHERE company_id IN (
--   'fde82347-f2ac-4e54-a2ab-f5c7c45acb79',
--   '19d43f7b-7288-40d3-a9c0-8427bfe3a42e'
-- )
-- AND candidate_user_id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d';
--
-- -- [4] 追加した 2 名目 HR を ow_company_admins から削除
-- DELETE FROM ow_company_admins
-- WHERE (user_id = '8feca16e-ca2a-4a22-8a11-14af2aafa2b8'
--        AND company_id = 'fde82347-f2ac-4e54-a2ab-f5c7c45acb79')
--    OR (user_id = 'e2ef2e4e-6edc-4315-9dc4-87080b264a62'
--        AND company_id = '19d43f7b-7288-40d3-a9c0-8427bfe3a42e');
--
-- COMMIT;
