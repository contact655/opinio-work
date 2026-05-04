import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xtutnecqeamftygufxco.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: admins } = await supabase
  .from("ow_company_admins")
  .select("id, user_id, company_id, permission, is_active, invited_email, invited_at, accepted_at")
  .order("user_id")
  .order("company_id");
console.log("=== ow_company_admins (" + (admins?.length ?? 0) + "件) ===");
for (const a of admins ?? []) console.log(JSON.stringify(a));

const { data: roles } = await supabase
  .from("ow_user_roles")
  .select("user_id, role, tenant_id, created_at")
  .eq("role", "company");
console.log("\n=== ow_user_roles role=company (" + (roles?.length ?? 0) + "件) ===");
for (const r of roles ?? []) console.log(JSON.stringify(r));

const userIds = [...new Set((admins ?? []).filter(a => a.user_id).map(a => a.user_id))];
const { data: users } = await supabase.from("ow_users").select("id, name").in("id", userIds);
console.log("\n=== ow_users (admins 内の user_id → name) ===");
for (const u of users ?? []) console.log(JSON.stringify(u));

const companyIds = [...new Set((admins ?? []).filter(a => a.company_id).map(a => a.company_id))];
const { data: companies } = await supabase.from("ow_companies").select("id, name").in("id", companyIds);
console.log("\n=== ow_companies (admins 内の company_id → name) ===");
for (const c of companies ?? []) console.log(JSON.stringify(c));
