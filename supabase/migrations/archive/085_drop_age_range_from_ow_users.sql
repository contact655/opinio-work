-- ν-8 段階6-2 コミット B-3: ow_users.age_range カラムを削除
-- 前提: birth_date カラム追加済み（migration 084）、コード側の age_range 参照全削除済み
-- ロールバック: ALTER TABLE ow_users ADD COLUMN age_range text;
-- （データは復元不可。削除前の値: e826e0bd = "30代前半"（Account B、birth_date 入力済み）

-- 念のため残存データを記録（LOG として残す）
DO $$
DECLARE
  remaining_count integer;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM ow_users
  WHERE age_range IS NOT NULL AND age_range != '非公開';

  RAISE NOTICE 'age_range non-null/non-hidden rows before DROP: %', remaining_count;
END
$$;

ALTER TABLE ow_users DROP COLUMN age_range;
