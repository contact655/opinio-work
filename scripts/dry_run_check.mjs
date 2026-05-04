import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xtutnecqeamftygufxco.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Step C の事前確認: ow_user_roles から joined_at をセットできる行
// (実際の UPDATE の WHERE 条件と同等の SELECT)
const { data: admins } = await supabase
  .from("ow_company_admins")
  .select("id, user_id, company_id, is_active")
  .eq("is_active", true)
  .not("user_id", "is", null);

const { data: roles } = await supabase
  .from("ow_user_roles")
  .select("user_id, tenant_id, created_at")
  .eq("role", "company");

const { data: owUsers } = await supabase
  .from("ow_users")
  .select("id, name, auth_id");

const { data: companies } = await supabase
  .from("ow_companies")
  .select("id, name");

// ow_user_roles.user_id(auth_id) → ow_users.auth_id の逆引き
const authToOwUser = Object.fromEntries((owUsers ?? []).map(u => [u.auth_id, u]));
const owUserMap = Object.fromEntries((owUsers ?? []).map(u => [u.id, u]));
const companyMap = Object.fromEntries((companies ?? []).map(c => [c.id, c]));

console.log("=== Step C 対象 SELECT (2件期待) ===");
const matches = [];
for (const ca of admins ?? []) {
  const owUser = owUserMap[ca.user_id];
  if (!owUser) continue;
  const role = (roles ?? []).find(r =>
    r.user_id === owUser.auth_id && r.tenant_id === ca.company_id
  );
  if (role) {
    matches.push({
      "ca.id": ca.id,
      "user_name": owUser.name,
      "company_name": companyMap[ca.company_id]?.name,
      "will_set_joined_at": role.created_at,
    });
  }
}
console.log(`件数: ${matches.length}件`);
for (const m of matches) console.log(JSON.stringify(m));

// Step D 対象: Step C で埋まらない行 (joined_at → created_at)
console.log("\n=== Step D 対象 (created_at で埋まる行) ===");
const stepDRows = (admins ?? []).filter(ca => {
  const owUser = owUserMap[ca.user_id];
  if (!owUser) return false;
  const role = (roles ?? []).find(r =>
    r.user_id === owUser.auth_id && r.tenant_id === ca.company_id
  );
  return !role;
});
console.log(`件数: ${stepDRows.length}件`);
for (const ca of stepDRows) {
  console.log(JSON.stringify({
    "ca.id": ca.id.slice(0, 8),
    "user_name": owUserMap[ca.user_id]?.name,
    "company_name": companyMap[ca.company_id]?.name,
  }));
}
