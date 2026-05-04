import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xtutnecqeamftygufxco.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// B. 件数確認
const { count: totalCount } = await supabase
  .from("ow_company_admins")
  .select("*", { count: "exact", head: true });
console.log("=== B. 件数確認 ===");
console.log(`COUNT(*): ${totalCount} (期待: 11)`);

// C. joined_at 値分布
const { data: allRows } = await supabase
  .from("ow_company_admins")
  .select("joined_at, is_active, user_id")
  .eq("is_active", true)
  .not("user_id", "is", null);

console.log("\n=== C. joined_at 値分布 ===");
const dateMap = {};
for (const r of allRows ?? []) {
  const d = r.joined_at ? r.joined_at.slice(0, 10) : "NULL";
  dateMap[d] = (dateMap[d] ?? 0) + 1;
}
for (const [date, cnt] of Object.entries(dateMap).sort()) {
  console.log(`  ${date}: ${cnt}件`);
}

// D. is_default 制約確認 (1ユーザー複数defaultがないか)
const { data: defaultRows } = await supabase
  .from("ow_company_admins")
  .select("user_id")
  .eq("is_default", true)
  .eq("is_active", true);

console.log("\n=== D. is_default 制約確認 ===");
const userDefaultCount = {};
for (const r of defaultRows ?? []) {
  userDefaultCount[r.user_id] = (userDefaultCount[r.user_id] ?? 0) + 1;
}
const violations = Object.entries(userDefaultCount).filter(([, cnt]) => cnt > 1);
if (violations.length === 0) {
  console.log("OK: 0行 (is_default=true を 2件以上持つユーザーなし)");
} else {
  console.log("⚠️ 違反:", violations);
}

// E. 柴さん・hshiba の全レコード詳細
const { data: admins } = await supabase
  .from("ow_company_admins")
  .select("user_id, company_id, permission, is_active, is_default, joined_at")
  .eq("is_active", true)
  .not("user_id", "is", null)
  .order("user_id")
  .order("joined_at");

const userIds = [...new Set((admins ?? []).map(a => a.user_id))];
const companyIds = [...new Set((admins ?? []).map(a => a.company_id))];
const { data: users } = await supabase.from("ow_users").select("id, name").in("id", userIds);
const { data: companies } = await supabase.from("ow_companies").select("id, name").in("id", companyIds);

const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u.name]));
const companyMap = Object.fromEntries((companies ?? []).map(c => [c.id, c.name]));

console.log("\n=== E. 柴さん・hshiba 各レコード ===");
console.log("user_name\t\tcompany_name\t\t\tperm\tis_default\tjoined_at");
console.log("─".repeat(100));
for (const a of admins ?? []) {
  const uname = (userMap[a.user_id] ?? "?").padEnd(12);
  const cname = (companyMap[a.company_id] ?? "?").padEnd(30);
  const def = a.is_default ? "✅ true " : "   false";
  const jat = a.joined_at ? a.joined_at.slice(0, 10) : "NULL";
  console.log(`${uname}\t${cname}\t${a.permission}\t${def}\t${jat}`);
}

// A. 新カラム存在確認 (joined_at, is_default があれば上のクエリが通っているはず)
console.log("\n=== A. 新カラム存在確認 ===");
const { data: sampleRow } = await supabase
  .from("ow_company_admins")
  .select("id, joined_at, is_default")
  .limit(1)
  .single();
if (sampleRow && "joined_at" in sampleRow && "is_default" in sampleRow) {
  console.log("OK: joined_at カラム存在, is_default カラム存在");
  console.log("  joined_at 型確認:", typeof sampleRow.joined_at, "値:", sampleRow.joined_at?.slice(0,10));
  console.log("  is_default 型確認:", typeof sampleRow.is_default, "値:", sampleRow.is_default);
} else {
  console.log("⚠️ カラムが見つからない:", sampleRow);
}
