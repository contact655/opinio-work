-- Mark existing test accounts as is_test=true.
-- Targets: @seed.internal domain (90 accounts) + contact+NN@opinio.co.jp pattern (15 accounts)
-- Total: 105 accounts (verified 2026-07-27)
UPDATE ow_users
SET is_test = true
WHERE email ILIKE '%@seed.internal'
   OR email ILIKE 'contact+%@opinio.co.jp';
