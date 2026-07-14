-- Migration 240: 株式会社Opinio の biz admin を現行メールに修正
--
-- 状況:
--   株式会社Opinio (cf44d740) は is_published=true だが、
--   唯一の admin が hshiba+01@third-box.jp (is_active=false) = 旧メール・無効
--   hshiba@opinio.co.jp (fe7dfe9b) が紐づいていないため biz ポータルを使えない
--
-- 対応:
--   1. hshiba@opinio.co.jp を株式会社Opinio の admin として追加
--   2. s.hisato1020@gmail.com を株式会社Opinio の admin として追加（副管理者）
--   旧 admin（hshiba+01@third-box.jp）は触らない（is_active=false のまま維持）

-- 1. hshiba@opinio.co.jp → 株式会社Opinio の admin に追加
INSERT INTO ow_company_admins (user_id, company_id, permission, is_active)
VALUES (
  'fe7dfe9b-75d4-4a75-a821-fa1a9599a416',  -- hshiba@opinio.co.jp
  'cf44d740-b835-454d-91a3-f1e2eddc7251',  -- 株式会社Opinio
  'admin',
  true
)
ON CONFLICT (user_id, company_id) DO UPDATE SET permission = 'admin', is_active = true;

-- 2. s.hisato1020@gmail.com → 株式会社Opinio の admin に追加
INSERT INTO ow_company_admins (user_id, company_id, permission, is_active)
VALUES (
  'e826e0bd-f96b-42ec-acda-d8f482e1417d',  -- s.hisato1020@gmail.com
  'cf44d740-b835-454d-91a3-f1e2eddc7251',  -- 株式会社Opinio
  'admin',
  true
)
ON CONFLICT (user_id, company_id) DO UPDATE SET permission = 'admin', is_active = true;
