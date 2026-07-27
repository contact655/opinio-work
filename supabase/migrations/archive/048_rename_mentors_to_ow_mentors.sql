-- migration 048: RENAME mentors → ow_mentors
-- 目的: 命名規則の統一（ow_ プレフィックス）
-- 背景: migration 008 で作成した mentors テーブルのみ ow_ プレフィックスがなかった
--       PostgreSQL の RENAME は FK・RLS ポリシー・インデックスを自動追従する
--       例外: CONSTRAINT 名は別途 RENAME が必要（mentors_pkey → ow_mentors_pkey）
--
-- FK 影響:
--   ow_mentor_reservations.mentor_id REFERENCES mentors(id)
--   → RENAME 後は自動的に REFERENCES ow_mentors(id) として動作
--
-- Rollback:
--   ALTER TABLE ow_mentors RENAME CONSTRAINT ow_mentors_pkey TO mentors_pkey;
--   ALTER TABLE ow_mentors RENAME TO mentors;

ALTER TABLE mentors RENAME TO ow_mentors;
ALTER TABLE ow_mentors RENAME CONSTRAINT mentors_pkey TO ow_mentors_pkey;
