-- ============================================================
-- Phase ζ-2.5.6 テストデータ投入 SQL
-- 作成日: 2026-05-05
-- 対象: テスト株式会社_027 (411dcda5-864f-4a79-b48b-f4b13e725cbe)
-- 用途: 写真カルーセル UI の本番動作確認
-- 関連: scripts/seed-photos-for-zeta-2-5-4.sql(雛形)
-- ============================================================
--
-- 【カルーセル動作確認ポイント】
--   デスクトップ(3 枚表示): 矢印を 3 回押せる、インジケーター 4 つ
--   タブレット(2 枚表示) : 矢印を 4 回押せる、インジケーター 5 つ
--   モバイル(1 枚表示)  : 矢印を 5 回押せる、インジケーター 6 つ
--   caption overflow   : display_order 5, 6 が長文(ellipsis 動作確認)
--
-- 【実行方法】
--   Supabase ダッシュボード > SQL Editor に貼り付けて手動実行
--
-- 【CHECK 制約(migration 038 確定)】
--   category IN ('workspace', 'meeting', 'welfare', 'event')
-- ============================================================


-- ============================================================
-- Step 1: 投入前確認(0 件であることを確認)
-- ============================================================
SELECT COUNT(*) AS before_count
FROM ow_company_office_photos
WHERE company_id = '411dcda5-864f-4a79-b48b-f4b13e725cbe';


-- ============================================================
-- Step 2: INSERT(本体)
-- ============================================================
INSERT INTO ow_company_office_photos
  (company_id, image_url, caption, category, display_order)
VALUES
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'https://picsum.photos/seed/zeta-256-1/800/600',
    '自然光が差し込むオープンワークスペース',
    'workspace',
    1
  ),
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'https://picsum.photos/seed/zeta-256-2/800/600',
    '集中して作業できる個人ブース',
    'workspace',
    2
  ),
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'https://picsum.photos/seed/zeta-256-3/800/600',
    'チームでの議論が生まれる共有スペース',
    'workspace',
    3
  ),
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'https://picsum.photos/seed/zeta-256-4/800/600',
    '月例の全社ミーティング',
    'meeting',
    4
  ),
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'https://picsum.photos/seed/zeta-256-5/800/600',
    'リフレッシュできるカフェスペース、ランチや雑談の場として活用',
    'welfare',
    5
  ),
  (
    '411dcda5-864f-4a79-b48b-f4b13e725cbe',
    'https://picsum.photos/seed/zeta-256-6/800/600',
    '四半期ごとのキックオフイベント、全社員で目標を共有する大切な機会',
    'event',
    6
  );


-- ============================================================
-- Step 3: 投入後確認(6 件 + display_order 順に並ぶこと)
-- ============================================================
SELECT id, caption, category, display_order, image_url
FROM ow_company_office_photos
WHERE company_id = '411dcda5-864f-4a79-b48b-f4b13e725cbe'
ORDER BY display_order;


-- ============================================================
-- ロールバック用(動作確認完了後にコメント解除して実行)
-- ============================================================
-- DELETE FROM ow_company_office_photos
-- WHERE company_id = '411dcda5-864f-4a79-b48b-f4b13e725cbe';
--
-- -- 削除後確認(0 件であること)
-- SELECT COUNT(*) AS after_count
-- FROM ow_company_office_photos
-- WHERE company_id = '411dcda5-864f-4a79-b48b-f4b13e725cbe';
