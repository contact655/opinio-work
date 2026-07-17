-- Migration 252: 木村雅樹 Salesforce 職歴 期間修正（IS→AE 役職変遷を正確な期間に分割）
-- 対象: email = 'k.masaki0526@gmail.com' / company_id = c3664ef1-5571-4645-b30f-1474e7961c17
-- 修正: AE と IS に同一期間(2021-11〜2025-07)が入っていたため横並び表示になっていた。
--       IS→AE の切り替えは 2025-01 が本人確認済み。期間のみ更新。
-- 変更しないもの: description / role_title / department / rank / display_order / 他ユーザー

DO $$
DECLARE
  v_user_id    UUID;
  v_company_id UUID := 'c3664ef1-5571-4645-b30f-1474e7961c17'; -- セールスフォース・ジャパン
BEGIN

-- ── user_id 取得（0件/2件以上でエラー） ─────────────────────────────────────
SELECT id INTO STRICT v_user_id
FROM ow_users
WHERE email = 'k.masaki0526@gmail.com';

-- ── AE レコード: 期間を 2025-01-01 〜 2025-07-31 に修正 ─────────────────────
-- role_category_id = 8db26a6b-... (アカウントエグゼクティブ) / display_order=2
UPDATE ow_experiences SET
  started_at = '2025-01-01',
  ended_at   = '2025-07-31'
WHERE user_id          = v_user_id
  AND company_id       = v_company_id
  AND role_category_id = '8db26a6b-e3c8-4b17-9a8a-5d306eb80b33'; -- アカウントエグゼクティブ

-- ── IS レコード: 期間を 2021-11-01 〜 2024-12-31 に修正 ─────────────────────
-- role_category_id = d1724303-... (インサイドセールス) / display_order=3
UPDATE ow_experiences SET
  started_at = '2021-11-01',
  ended_at   = '2024-12-31'
WHERE user_id          = v_user_id
  AND company_id       = v_company_id
  AND role_category_id = 'd1724303-7ca2-4cbe-a16b-f15d5a2476b8'; -- インサイドセールス

END $$;

-- ── 確認クエリ（実行後に手動で照合） ─────────────────────────────────────────
-- SELECT display_order, role_title, started_at, ended_at, is_current
-- FROM ow_experiences
-- WHERE user_id = (SELECT id FROM ow_users WHERE email = 'k.masaki0526@gmail.com')
--   AND company_id = 'c3664ef1-5571-4645-b30f-1474e7961c17'
-- ORDER BY display_order;
-- 期待値:
--   display_order=2 / AE / 2025-01-01 〜 2025-07-31 / is_current=false
--   display_order=3 / IS / 2021-11-01 〜 2024-12-31 / is_current=false
