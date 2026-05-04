import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xtutnecqeamftygufxco.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ow_users の auth_id を確認 (ow_user_roles との join に必要)
const { data: users } = await supabase
  .from("ow_users")
  .select("id, name, email, auth_id")
  .in("id", ["fe7dfe9b-75d4-4a75-a821-fa1a9599a416", "7e176532-837d-4d59-a12c-2048625a32b0"]);

console.log("=== ow_users (auth_id 確認) ===");
for (const u of users ?? []) console.log(JSON.stringify(u));

// ow_user_roles と照合
const authIds = (users ?? []).map(u => u.auth_id).filter(Boolean);
const { data: roles } = await supabase
  .from("ow_user_roles")
  .select("user_id, tenant_id, created_at")
  .eq("role", "company")
  .in("user_id", authIds);

console.log("\n=== ow_user_roles で auth_id が一致するもの ===");
for (const r of roles ?? []) {
  const user = users?.find(u => u.auth_id === r.user_id);
  console.log(JSON.stringify({ ...r, name: user?.name }));
}
