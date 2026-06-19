-- 個人特定につながる詳細説明を削除
-- アサヒビール株式会社の職歴エントリー（売上数値・固有顧客名を含む）
UPDATE ow_experiences
SET description = NULL
WHERE id = 'd26fd64b-9470-49de-9bec-82a5c685a701';
