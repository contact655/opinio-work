-- Migration 138: Fix Archi Village remote_work_status (full_remote → office)
UPDATE ow_companies
SET remote_work_status = 'office'
WHERE id = 'f1481f96-94c8-4515-a52e-a853ede66080';
