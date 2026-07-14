-- Migration 238: 株式会社medimo の企業・求人データを全削除
-- 対象: company_id = a6b3aef3-6c56-4c95-99f5-08be757b12d7

DELETE FROM ow_jobs WHERE company_id = 'a6b3aef3-6c56-4c95-99f5-08be757b12d7';
DELETE FROM ow_companies WHERE id = 'a6b3aef3-6c56-4c95-99f5-08be757b12d7';
