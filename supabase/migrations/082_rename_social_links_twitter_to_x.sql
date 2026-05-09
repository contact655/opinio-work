-- ν-8 段階6-1 コミット E: JSONB social_links の "twitter" キーを "x" に rename
-- 対象: twitter キーを持つ行（事前調査時点: 1行、Account B のみ）
-- ロールバック: UPDATE ow_users SET social_links = (social_links - 'x') || jsonb_build_object('twitter', social_links->'x') WHERE social_links ? 'x';

BEGIN;

-- twitter キーを x キーに rename（値は保持）
UPDATE ow_users
SET social_links = (social_links - 'twitter') || jsonb_build_object('x', social_links->'twitter')
WHERE social_links ? 'twitter';

-- 確認: twitter キーが残っていないこと
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ow_users WHERE social_links ? 'twitter') THEN
    RAISE EXCEPTION 'Migration failed: twitter keys still exist after rename';
  END IF;
END
$$;

COMMIT;
