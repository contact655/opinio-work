-- Migration 215: avg_salary の単位なし値を修正
-- Archi Village と medimo が "600" / "650" と数値のみで登録されていたため "XXX万円〜" に統一

UPDATE ow_companies SET avg_salary = '600万円〜' WHERE name = '株式会社Archi Village' AND avg_salary = '600';
UPDATE ow_companies SET avg_salary = '650万円〜' WHERE name = '株式会社medimo'        AND avg_salary = '650';
