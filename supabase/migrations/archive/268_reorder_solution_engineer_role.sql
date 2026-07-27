-- Migration 268: ソリューションエンジニア・プリセールス をカスタマーサクセスの直後に移動
--
-- 変更前 display_order:
--   0: ソリューションエンジニア・プリセールス
--   7: カスタマーサクセス
--   8: 事業開発
--   9: 経営・CxO
--  10: コーポレート
--  11: 専門職
--
-- 変更後:
--   7: カスタマーサクセス（変更なし）
--   8: ソリューションエンジニア・プリセールス（0 → 8）
--   9: 事業開発（8 → 9）
--  10: 経営・CxO（9 → 10）
--  11: コーポレート（10 → 11）
--  12: 専門職（11 → 12）

-- まず競合を避けるため、移動対象ロールを一時的に大きい値に
UPDATE public.ow_roles SET display_order = 99 WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';

-- 下位ロールを1ずつ繰り上げ
UPDATE public.ow_roles SET display_order = 12 WHERE id = '1a641f61-bd5e-477f-8680-8a09c68711b9'; -- 専門職 11→12
UPDATE public.ow_roles SET display_order = 11 WHERE id = '23e79605-332b-485d-98c2-d162a491a409'; -- コーポレート 10→11
UPDATE public.ow_roles SET display_order = 10 WHERE id = '166bebdf-0c26-40df-9713-5f3b958cc96f'; -- 経営・CxO 9→10
UPDATE public.ow_roles SET display_order = 9  WHERE id = 'b49b9bc8-488b-47a5-80b0-9eba4869e910'; -- 事業開発 8→9

-- ソリューションエンジニアをカスタマーサクセス（7）の直後に
UPDATE public.ow_roles SET display_order = 8  WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';
