import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xtutnecqeamftygufxco.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = `
ALTER TABLE public.ow_company_admins
  ADD COLUMN IF NOT EXISTS joined_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_company_per_user
  ON public.ow_company_admins (user_id)
  WHERE is_default = true AND is_active = true AND user_id IS NOT NULL;

UPDATE public.ow_company_admins ca
SET joined_at = ur.created_at
FROM ow_user_roles ur
JOIN ow_users ou ON ou.auth_id = ur.user_id
WHERE ur.role = 'company'
  AND ur.tenant_id = ca.company_id
  AND ou.id = ca.user_id
  AND ca.user_id IS NOT NULL
  AND ca.is_active = true;

UPDATE public.ow_company_admins
SET joined_at = created_at
WHERE joined_at IS NULL
  AND user_id IS NOT NULL
  AND is_active = true;

WITH oldest AS (
  SELECT DISTINCT ON (user_id) id
  FROM public.ow_company_admins
  WHERE is_active = true AND user_id IS NOT NULL
  ORDER BY user_id, joined_at ASC
)
UPDATE public.ow_company_admins ca
SET is_default = true
FROM oldest
WHERE ca.id = oldest.id;
`;

const { error } = await supabase.rpc("exec_sql", { sql });
if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}
console.log("OK");
