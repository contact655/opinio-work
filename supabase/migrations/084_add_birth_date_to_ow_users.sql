-- ν-8 段階6-2 コミット B-1: ow_users に birth_date カラムを追加
-- 前提: age_range が既に存在（B-3 で削除）
-- ロールバック: ALTER TABLE ow_users DROP COLUMN birth_date;

ALTER TABLE ow_users
ADD COLUMN birth_date date NULL;

COMMENT ON COLUMN ow_users.birth_date IS
  '生年月日。NULL の場合は年齢非公開扱い。サーバ側で年齢計算に使用、公開ページには直接渡さない（プライバシー保護）。';
