-- Migration 273: 不正な3階層目の部門レコードを論理削除
--
-- 事象: DepartmentsEditor の depth 判定バグ（depth < 2）により
--       2層目ノードに「+ サブ」が表示され、3層目が作成可能だった。
-- 対象: 営業 > インサイドセールス > テスト（id: 64ba665f-514b-4517-bffd-c59bff6d34cd）
--
-- 修正済み:
--   - DepartmentsEditor.tsx: depth < 2 → depth < 1
--   - /api/biz/departments POST: parent の parent_id が非NULLなら400

UPDATE ow_company_departments
SET deleted_at = NOW()
WHERE id IN (
  -- 3階層目（parent が子、grandparent が存在する）レコードを全件取得
  SELECT child.id
  FROM ow_company_departments child
  JOIN ow_company_departments parent ON child.parent_id = parent.id
  JOIN ow_company_departments grandparent ON parent.parent_id = grandparent.id
  WHERE child.deleted_at IS NULL
)
AND deleted_at IS NULL;
