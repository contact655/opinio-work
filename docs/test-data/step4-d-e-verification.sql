-- =============================================================
-- Step 4-4 動作確認用テストデータ
-- D 機能(B 画面アクセス時の last_read_at 更新) +
-- E 機能(A 画面の未読バッジ表示) 検証
-- =============================================================
-- 前提:
--   柴さん (s.hisato1020@gmail.com) ← 実際のログインアカウント
--     auth_id:     7f358b59-2269-41fa-9324-4298c3c82cd2
--     ow_users.id: e826e0bd-f96b-42ec-acda-d8f482e1417d
--     name:        柴 久人
--
--   (hshiba@opinio.co.jp は別アカウント / ow_users.id: fe7dfe9b-... → テストに使わない)
--
--   企業側代役: テストユーザー_01 (contact+user01@opinio.co.jp)
--     ow_users.id: 57b80795-80f0-4558-981f-014f755bf232
--
--   使用企業 (既存 ow_companies):
--     テスト株式会社_001: fde82347-f2ac-4e54-a2ab-f5c7c45acb79
--     テスト株式会社_002: 19d43f7b-7288-40d3-a9c0-8427bfe3a42e
--     テスト株式会社_003: e48685f4-07ce-49c2-9a6b-b8a0537ad783
--
-- CHECK 制約注意:
--   kind='company' の場合 stage='active' のみ許可
--   status は 'active' | 'archived' のみ許可
--
-- 冪等性: ON CONFLICT (id) DO NOTHING で重複実行安全
-- =============================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. 会話 (ow_conversations) — 3 件
-- ---------------------------------------------------------------

-- Conv A: 状態① last_read_at = NULL → 未読バッジあり(一度も既読なし)
INSERT INTO ow_conversations
  (id, kind, stage, status, company_id, candidate_user_id, last_message_at, created_at)
VALUES (
  '11111111-4444-4444-4444-000000000001',
  'company',
  'active',
  'active',
  'fde82347-f2ac-4e54-a2ab-f5c7c45acb79',  -- テスト株式会社_001
  'e826e0bd-f96b-42ec-acda-d8f482e1417d',  -- 柴さん
  '2026-05-06 10:00:00+00',
  '2026-05-06 09:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- Conv B: 状態② last_read_at < 最新メッセージ → 未読バッジあり(削除メッセージ含む)
INSERT INTO ow_conversations
  (id, kind, stage, status, company_id, candidate_user_id, last_message_at, created_at)
VALUES (
  '11111111-4444-4444-4444-000000000002',
  'company',
  'active',
  'active',
  '19d43f7b-7288-40d3-a9c0-8427bfe3a42e',  -- テスト株式会社_002
  'e826e0bd-f96b-42ec-acda-d8f482e1417d',  -- 柴さん
  '2026-05-06 12:00:00+00',
  '2026-05-05 09:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- Conv C: 状態③ last_read_at >= 最新メッセージ → 未読バッジなし(既読済み)
INSERT INTO ow_conversations
  (id, kind, stage, status, company_id, candidate_user_id, last_message_at, created_at)
VALUES (
  '11111111-4444-4444-4444-000000000003',
  'company',
  'active',
  'active',
  'e48685f4-07ce-49c2-9a6b-b8a0537ad783',  -- テスト株式会社_003
  'e826e0bd-f96b-42ec-acda-d8f482e1417d',  -- 柴さん
  '2026-05-06 00:00:00+00',
  '2026-05-06 00:00:00+00'
) ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------
-- 2. 参加者 (ow_conversation_participants) — 6 件
-- ---------------------------------------------------------------

-- === Conv A 参加者 ===

-- Conv A: 柴さん / last_read_at = NULL(状態①: 一度も既読なし)
INSERT INTO ow_conversation_participants
  (id, conversation_id, user_id, role, joined_at, last_read_at)
VALUES (
  '22222222-4444-4444-4444-000000000001',
  '11111111-4444-4444-4444-000000000001',
  'e826e0bd-f96b-42ec-acda-d8f482e1417d',
  'candidate',
  '2026-05-06 09:00:00+00',
  NULL  -- 一度も既読にしていない → E 機能: 全メッセージが未読扱い
) ON CONFLICT (id) DO NOTHING;

-- Conv A: テストユーザー_01(企業側)
INSERT INTO ow_conversation_participants
  (id, conversation_id, user_id, role, joined_at, last_read_at)
VALUES (
  '33333333-4444-4444-4444-000000000001',
  '11111111-4444-4444-4444-000000000001',
  '57b80795-80f0-4558-981f-014f755bf232',
  'company_admin',
  '2026-05-06 09:00:00+00',
  '2026-05-06 10:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- === Conv B 参加者 ===

-- Conv B: 柴さん / last_read_at = '2026-05-06 00:00:00+00'(状態②: 既読したが新着あり)
INSERT INTO ow_conversation_participants
  (id, conversation_id, user_id, role, joined_at, last_read_at)
VALUES (
  '22222222-4444-4444-4444-000000000002',
  '11111111-4444-4444-4444-000000000002',
  'e826e0bd-f96b-42ec-acda-d8f482e1417d',
  'candidate',
  '2026-05-05 09:00:00+00',
  '2026-05-06 00:00:00+00'  -- 最新メッセージ(12:00)より古い → 未読あり
) ON CONFLICT (id) DO NOTHING;

-- Conv B: テストユーザー_01(企業側)
INSERT INTO ow_conversation_participants
  (id, conversation_id, user_id, role, joined_at, last_read_at)
VALUES (
  '33333333-4444-4444-4444-000000000002',
  '11111111-4444-4444-4444-000000000002',
  '57b80795-80f0-4558-981f-014f755bf232',
  'company_admin',
  '2026-05-05 09:00:00+00',
  '2026-05-06 12:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- === Conv C 参加者 ===

-- Conv C: 柴さん / last_read_at = '2026-05-06 01:00:00+00'(状態③: 全メッセージ既読)
INSERT INTO ow_conversation_participants
  (id, conversation_id, user_id, role, joined_at, last_read_at)
VALUES (
  '22222222-4444-4444-4444-000000000003',
  '11111111-4444-4444-4444-000000000003',
  'e826e0bd-f96b-42ec-acda-d8f482e1417d',
  'candidate',
  '2026-05-06 00:00:00+00',
  '2026-05-06 01:00:00+00'  -- 唯一のメッセージ(00:00)より新しい → 未読なし
) ON CONFLICT (id) DO NOTHING;

-- Conv C: テストユーザー_01(企業側)
INSERT INTO ow_conversation_participants
  (id, conversation_id, user_id, role, joined_at, last_read_at)
VALUES (
  '33333333-4444-4444-4444-000000000003',
  '11111111-4444-4444-4444-000000000003',
  '57b80795-80f0-4558-981f-014f755bf232',
  'company_admin',
  '2026-05-06 00:00:00+00',
  '2026-05-06 01:00:00+00'
) ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------
-- 3. メッセージ (ow_conversation_messages) — 6 件
-- ---------------------------------------------------------------

-- === Conv A のメッセージ(2 件) ===

-- Conv A-1: 企業→柴さん / 未読対象(sender ≠ 柴さん participant, last_read_at=NULL)
INSERT INTO ow_conversation_messages
  (id, conversation_id, sender_participant_id, body, sent_at)
VALUES (
  '44444444-4444-4444-4444-000000000001',
  '11111111-4444-4444-4444-000000000001',
  '33333333-4444-4444-4444-000000000001',  -- テストユーザー_01 の participant_id
  'はじめまして。弊社の求人にご興味をお持ちいただきありがとうございます。ぜひお話しさせてください。',
  '2026-05-06 09:30:00+00'
) ON CONFLICT (id) DO NOTHING;

-- Conv A-2: 運営メッセージ / sender_participant_id = NULL → 未読対象(NULL ≠ 柴さんの participant_id)
INSERT INTO ow_conversation_messages
  (id, conversation_id, sender_participant_id, body, sent_at)
VALUES (
  '44444444-4444-4444-4444-000000000002',
  '11111111-4444-4444-4444-000000000001',
  NULL,  -- 運営メッセージ(sender_participant_id IS NULL)
  '【運営より】この対話はカジュアル面談のご案内です。お気軽にご参加ください。',
  '2026-05-06 10:00:00+00'
) ON CONFLICT (id) DO NOTHING;


-- === Conv B のメッセージ(3 件) ===

-- Conv B-1: 柴さん→企業 / 自分の送信 → 未読対象外(sender = 柴さんの participant_id)
INSERT INTO ow_conversation_messages
  (id, conversation_id, sender_participant_id, body, sent_at)
VALUES (
  '44444444-4444-4444-4444-000000000011',
  '11111111-4444-4444-4444-000000000002',
  '22222222-4444-4444-4444-000000000002',  -- 柴さんの participant_id
  'よろしくお願いします。御社のプロダクト開発に大変興味があります。',
  '2026-05-05 09:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- Conv B-2: 企業→柴さん / deleted_at IS NOT NULL → 未読判定から除外されることを確認
INSERT INTO ow_conversation_messages
  (id, conversation_id, sender_participant_id, body, sent_at, deleted_at)
VALUES (
  '44444444-4444-4444-4444-000000000012',
  '11111111-4444-4444-4444-000000000002',
  '33333333-4444-4444-4444-000000000002',  -- テストユーザー_01 の participant_id
  '（削除済みメッセージ — E 機能のバッジ判定対象外であることを確認）',
  '2026-05-06 10:00:00+00',
  '2026-05-06 10:05:00+00'  -- 削除済み: E 機能の .is("deleted_at", null) フィルターで除外
) ON CONFLICT (id) DO NOTHING;

-- Conv B-3: 企業→柴さん / sent_at(12:00) > last_read_at(00:00) → 未読対象
INSERT INTO ow_conversation_messages
  (id, conversation_id, sender_participant_id, body, sent_at)
VALUES (
  '44444444-4444-4444-4444-000000000013',
  '11111111-4444-4444-4444-000000000002',
  '33333333-4444-4444-4444-000000000002',  -- テストユーザー_01 の participant_id
  '面談の日程についてご相談させてください。来週以降のご都合はいかがでしょうか？',
  '2026-05-06 12:00:00+00'  -- last_read_at(00:00) より新しい → 未読
) ON CONFLICT (id) DO NOTHING;


-- === Conv C のメッセージ(1 件) ===

-- Conv C-1: 企業→柴さん / sent_at(00:00) < last_read_at(01:00) → 既読済み、未読対象外
INSERT INTO ow_conversation_messages
  (id, conversation_id, sender_participant_id, body, sent_at)
VALUES (
  '44444444-4444-4444-4444-000000000021',
  '11111111-4444-4444-4444-000000000003',
  '33333333-4444-4444-4444-000000000003',  -- テストユーザー_01 の participant_id
  'カジュアル面談のご案内をお送りします。お時間のある際にぜひご参加ください。',
  '2026-05-06 00:00:00+00'  -- last_read_at(01:00) より古い → 既読済み
) ON CONFLICT (id) DO NOTHING;

COMMIT;


-- =============================================================
-- クリーンアップ SQL (動作確認後、不要になったら実行)
-- =============================================================
-- 実行するかどうかは柴さんの判断で。残したい場合はそのままでOK。
--
-- BEGIN;
-- DELETE FROM ow_conversation_messages
--   WHERE id IN (
--     '44444444-4444-4444-4444-000000000001',
--     '44444444-4444-4444-4444-000000000002',
--     '44444444-4444-4444-4444-000000000011',
--     '44444444-4444-4444-4444-000000000012',
--     '44444444-4444-4444-4444-000000000013',
--     '44444444-4444-4444-4444-000000000021'
--   );
-- DELETE FROM ow_conversation_participants
--   WHERE id IN (
--     '22222222-4444-4444-4444-000000000001',
--     '22222222-4444-4444-4444-000000000002',
--     '22222222-4444-4444-4444-000000000003',
--     '33333333-4444-4444-4444-000000000001',
--     '33333333-4444-4444-4444-000000000002',
--     '33333333-4444-4444-4444-000000000003'
--   );
-- DELETE FROM ow_conversations
--   WHERE id IN (
--     '11111111-4444-4444-4444-000000000001',
--     '11111111-4444-4444-4444-000000000002',
--     '11111111-4444-4444-4444-000000000003'
--   );
-- COMMIT;
