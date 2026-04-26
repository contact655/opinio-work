# Migration Rollback SQL

This directory contains rollback SQL for each migration that introduced
significant schema or RLS changes. Use only in emergencies.

## Usage

```sql
-- Connect to Supabase via Studio SQL Editor or psql, then:
-- (Replace XXX with the migration number)
\i supabase/rollbacks/XXX_rollback.sql
```

## Available Rollbacks

| Migration | Rollback File | Reason | Safe to Run? |
|-----------|---------------|--------|--------------|
| 035 | 035_rollback.sql | RLS recursion fix + tenant_id backfill | ⚠️ tenant_id backfill cannot be rolled back (data preserved) |
| 036 | 036_rollback.sql | auth_is_admin row_security=off | ✅ Reverts to 035 state |
| 037 | 037_rollback.sql | ow_company_admins RLS recursion fix | ✅ Reverts to migration 031 state |

## Notes

- These rollbacks revert RLS policies and functions only.
- Data changes (e.g., tenant_id backfill in 035) are NOT reverted.
- After rolling back, the application code must also be reverted to the
  corresponding commit, otherwise runtime errors may occur.
