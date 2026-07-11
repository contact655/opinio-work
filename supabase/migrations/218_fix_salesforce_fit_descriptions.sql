-- Salesforce の fit_positives / fit_negatives を「〜な人」形式に更新
UPDATE ow_companies
SET
  fit_positives = '["グローバルなキャリアパスを描きたい人","チームの仲間を大切にするOhana文化に共感できる人","体系的な研修・トレーニングでスキルを磨きたい人","成果に応じた高い報酬水準を求める人"]'::jsonb,
  fit_negatives = '["日系企業的なプロセス重視・年功序列を好む人","数値目標よりも業務の質やプロセスを重視したい人","英語を使う場面が少ない環境で働きたい人"]'::jsonb
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
