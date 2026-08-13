-- Sansan の branch_locations を6件に直す（前の migration の訂正）
--
-- ⚠️ 20260813061500_fill_company_profile_9_companies.sql で「京都」を落としたのは**誤り**。
--    公式の会社概要にサテライトオフィスとして掲載されている。
--    「archive/171 の出典不明の一括投入」と判断したが、値そのものは正しかった。
--
-- 旧値（20260813061500 適用後）: {大阪, 名古屋, 福岡}
-- さらにその前（archive/171）:   {大阪, 名古屋, 福岡, 京都}
--
-- 内訳:
--   支店3            関西支店（大阪） / 中部支店（名古屋） / 福岡支店（福岡）
--   サテライトオフィス3  Sansan Innovation Lab（京都市中京区）
--                      Sansan神山ラボ（徳島県神山町）
--                      Sansan長岡ラボ（新潟県長岡市）
--
-- 出典: https://jp.corp-sansan.com/company/info/
--
-- ── branch_locations に何を入れるか（2026-08-13 確立）──────────────────────
-- **常設オフィス（支店＋サテライトオフィス）をすべて挙げる。**
-- イベント施設・運営施設（Sansanピックルボールコート池袋など）は**含めない**。
UPDATE ow_companies SET
  branch_locations = ARRAY['大阪', '名古屋', '福岡', '京都', '徳島', '新潟']
WHERE id = '8b9f84b0-b4be-4191-8322-07c6a2e5e91a';
