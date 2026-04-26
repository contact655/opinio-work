-- 021: mentorsテーブルにcatchphraseカラムを追加
ALTER TABLE mentors ADD COLUMN IF NOT EXISTS catchphrase text;

-- 各メンターにcatchphraseを設定
UPDATE mentors SET catchphrase = 'SIerから外資SaaSへ。年収200万アップした転職の本音を話します。' WHERE name LIKE '田中%';
UPDATE mentors SET catchphrase = '営業からCSへの転身。実際どうだったか、正直に話します。' WHERE name LIKE '佐藤%';
UPDATE mentors SET catchphrase = '転職の本音を整理したい人へ。Recruit・Salesforce出身のCEOが話します。' WHERE name LIKE '柴%';
UPDATE mentors SET catchphrase = 'SIerからSaaSへ。技術を武器に年収を上げた道のりを話します。' WHERE name LIKE '加藤%';
UPDATE mentors SET catchphrase = 'BtoB未経験からSaaSマーケへ。インバウンドの実態を話します。' WHERE name LIKE '渡辺%';
UPDATE mentors SET catchphrase = 'IS未経験からSaaSへ。専門職じゃなくても転職できた話をします。' WHERE name LIKE '鈴木%';
