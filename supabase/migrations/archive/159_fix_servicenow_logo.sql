-- ServiceNow のロゴを Wikimedia SVG（横長テキストロゴ）から削除してレターフォールバックに戻す
UPDATE ow_companies
SET logo_url = NULL
WHERE name = 'ServiceNow Japan合同会社';
