-- テスト用：テスト株式会社_023 に Sansan ロゴを設定
-- 本番では実行しない、開発確認用
UPDATE ow_companies
SET logo_url = '/logos/sansan.png'
WHERE name = 'テスト株式会社_023';
