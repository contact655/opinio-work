-- =============================================================
-- Phase ζ-2.5.4: 写真フォーマット動作確認用テストデータ
-- =============================================================
-- 投入対象: ow_company_office_photos
-- 目的: 0/1/3/6 枚パターンの PhotoGallery レイアウト確認
--
-- 【実行方法】
--   Supabase ダッシュボード > SQL Editor に貼り付けて手動実行
--   Claude Code からは実行しない (read-only MCP 運用)
--
-- 【対象企業】
--   テスト株式会社_001 (fde82347-f2ac-4e54-a2ab-f5c7c45acb79) → 1 枚
--   テスト株式会社_021 (f3d87ca8-7bc2-4945-b741-b696af2b632c) → 3 枚
--   テスト株式会社_027 (411dcda5-864f-4a79-b48b-f4b13e725cbe) → 6 枚
--
-- 【カラム構造 (MCP で確認済み 2026-05-04)】
--   id            UUID     NOT NULL  DEFAULT gen_random_uuid()
--   company_id    UUID     NOT NULL
--   category      TEXT     NOT NULL  CHECK IN ('work','meeting','welfare','event')
--   image_url     TEXT     NOT NULL
--   caption       TEXT     nullable
--   display_order INTEGER  NOT NULL  DEFAULT 0
--   created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
--
-- 【ロールバック】
--   このファイルの末尾に記載
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- INSERT
-- ─────────────────────────────────────────────────────────────

INSERT INTO ow_company_office_photos
  (company_id, category, image_url, caption, display_order)
VALUES

  -- ─── テスト株式会社_001 (1 枚) ───────────────────────────
  -- UUID: fde82347-f2ac-4e54-a2ab-f5c7c45acb79
  -- レイアウト確認: 横長 1 枚フル幅
  (
    'fde82347-f2ac-4e54-a2ab-f5c7c45acb79',
    'workspace',
    'https://picsum.photos/seed/test001-work-1/800/600',
    'メインオフィス執務エリア',
    1
  ),

  -- ─── テスト株式会社_021 (3 枚) ───────────────────────────
  -- UUID: f3d87ca8-7bc2-4945-b741-b696af2b632c
  -- レイアウト確認: 3 カラム均等
  (
    'f3d87ca8-7bc2-4945-b741-b696af2b632c',
    'workspace',
    'https://picsum.photos/seed/test021-work-1/800/600',
    '開放的な執務スペース',
    1
  ),
  (
    'f3d87ca8-7bc2-4945-b741-b696af2b632c',
    'meeting',
    'https://picsum.photos/seed/test021-meeting-1/800/600',
    'ガラス張りの会議室',
    2
  ),
  (
    'f3d87ca8-7bc2-4945-b741-b696af2b632c',
    'welfare',
    'https://picsum.photos/seed/test021-welfare-1/800/600',
    'リフレッシュスペース',
    3
  ),

  -- ─── テスト株式会社_027 (6 枚) ───────────────────────────
  -- UUID: 411dcda5-864f-4a79-b48b-f4b13e725cbe
  -- レイアウト確認: 2 段 × 3 カラム
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'workspace',
    'https://picsum.photos/seed/test027-work-1/800/600',
    'メインフロア執務エリア',
    1
  ),
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'workspace',
    'https://picsum.photos/seed/test027-work-2/800/600',
    'エントランスロビー',
    2
  ),
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'meeting',
    'https://picsum.photos/seed/test027-meeting-1/800/600',
    '大会議室',
    3
  ),
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'meeting',
    'https://picsum.photos/seed/test027-meeting-2/800/600',
    '小会議室・電話ブース',
    4
  ),
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'welfare',
    'https://picsum.photos/seed/test027-welfare-1/800/600',
    'カフェテリア・リフレッシュコーナー',
    5
  ),
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'event',
    'https://picsum.photos/seed/test027-event-1/800/600',
    '全社イベントスペース',
    6
  );


-- =============================================================
-- ロールバック用 SQL
-- =============================================================
-- 上記 INSERT を取り消す場合は以下を実行してください:
--
-- DELETE FROM ow_company_office_photos
-- WHERE company_id IN (
--   'fde82347-f2ac-4e54-a2ab-f5c7c45acb79',  -- テスト株式会社_001
--   'f3d87ca8-7bc2-4945-b741-b696af2b632c',  -- テスト株式会社_021
--   '411dcda5-864f-4a79-b48b-f4b13e725cbe'   -- テスト株式会社_027
-- );
--
-- 確認用 SELECT:
-- SELECT company_id, COUNT(*) FROM ow_company_office_photos
-- WHERE company_id IN (
--   'fde82347-f2ac-4e54-a2ab-f5c7c45acb79',
--   'f3d87ca8-7bc2-4945-b741-b696af2b632c',
--   '411dcda5-864f-4a79-b48b-f4b13e725cbe'
-- )
-- GROUP BY company_id ORDER BY company_id;
-- 期待結果: 3 行 (件数 1, 3, 6)
