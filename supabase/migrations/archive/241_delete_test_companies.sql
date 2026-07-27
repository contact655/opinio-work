-- Migration 241: テストデータ企業の削除（判断保留・後で実行）
--
-- 対象:
--   株式会社TEST（4039a638）: 求人0・スカウト0・応募0、admin 1名（s.hisato1020@gmail.com）
--   株式会社Third Box（81cae8d8）: 旧社名（2025/06 に株式会社Opinio に社名変更）
--     求人0・スカウト0・members0・feed_posts0
--     admin 2名（hshiba@opinio.co.jp, s.hisato1020@gmail.com）は M240 で Opinio に移行済み
--
-- ⚠️ M240 を適用してから実行すること
--    （Third Box の admin が Opinio に移行されていることを前提とする）

-- 株式会社TEST を削除
DELETE FROM ow_companies WHERE id = '4039a638-229d-421c-b8be-c2835bf0b9c7';

-- 株式会社Third Box を削除（旧社名、全実績0件）
DELETE FROM ow_companies WHERE id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d';
