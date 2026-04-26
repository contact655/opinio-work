-- 企業レベルのフィット感（全ユーザー共通・Opinioが記入）
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS company_pros jsonb,
  ADD COLUMN IF NOT EXISTS company_cons jsonb;

-- ダミーデータ投入（動作確認用）
UPDATE ow_companies
SET
  company_pros = '["Chatworkという知名度の高いプロダクトで中小企業への提案がしやすい", "上場済みで安定感があり副業・リモートも認められている", "大阪本社のため関西在住者にとって数少ない外資系でない選択肢"]',
  company_cons = '["Slack・Teamsとの競合が激しく差別化の説明に工夫が必要", "中小企業メインのためエンタープライズ営業経験が積みにくい", "チャットツール市場が成熟しつつあり新機能での差別化が難しい"]'
WHERE name = '株式会社kubell';
