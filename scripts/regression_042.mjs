import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xtutnecqeamftygufxco.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  ✅ ${label}`); passed++; }
function ng(label, detail) { console.log(`  ❌ ${label}: ${detail}`); failed++; }

// ── R-1: ow_company_admins SELECT (既存コードが読む列のみ) ────────────────
// addExistingUserToCompany() の SELECT と同じ
console.log("R-1: ow_company_admins SELECT (id, is_active) — 既存列が読めるか");
{
  const { data, error } = await supabase
    .from("ow_company_admins")
    .select("id, is_active")
    .eq("user_id", "fe7dfe9b-75d4-4a75-a821-fa1a9599a416") // 柴久人
    .eq("company_id", "59879917-4fa0-44d8-9cf1-189251234a26") // フリー株式会社
    .maybeSingle();
  if (error) ng("SELECT", error.message);
  else if (data && data.is_active === true) ok(`id=${data.id.slice(0,8)}, is_active=${data.is_active}`);
  else ng("SELECT", `unexpected: ${JSON.stringify(data)}`);
}

// ── R-2: actorAdmin 確認クエリ (members/route.ts と同じ) ─────────────────
// SELECT permission FROM ow_company_admins WHERE user_id=? AND company_id=? AND is_active=true
console.log("R-2: actorAdmin 権限確認クエリ");
{
  const { data, error } = await supabase
    .from("ow_company_admins")
    .select("permission")
    .eq("user_id", "fe7dfe9b-75d4-4a75-a821-fa1a9599a416")
    .eq("company_id", "59879917-4fa0-44d8-9cf1-189251234a26")
    .eq("is_active", true)
    .maybeSingle();
  if (error) ng("actorAdmin SELECT", error.message);
  else if (data?.permission === "admin") ok(`permission=${data.permission}`);
  else ng("actorAdmin SELECT", `unexpected: ${JSON.stringify(data)}`);
}

// ── R-3: INSERT (新カラムなし) → is_default=false, joined_at=NULL がデフォルト ──
// テスト用ダミーユーザーを探す (ow_users に存在する柴久人以外のユーザー)
console.log("R-3: INSERT (joined_at/is_default 省略) → デフォルト値確認");
{
  const { data: testUser } = await supabase
    .from("ow_users")
    .select("id, name")
    .neq("id", "fe7dfe9b-75d4-4a75-a821-fa1a9599a416")
    .neq("id", "7e176532-837d-4d59-a12c-2048625a32b0")
    .limit(1)
    .maybeSingle();

  if (!testUser) {
    ng("INSERT", "テストユーザーが見つからない");
  } else {
    const TEST_COMPANY = "59879917-4fa0-44d8-9cf1-189251234a26"; // フリー株式会社
    // 既存行があれば skip
    const { data: existing } = await supabase
      .from("ow_company_admins")
      .select("id")
      .eq("user_id", testUser.id)
      .eq("company_id", TEST_COMPANY)
      .maybeSingle();

    if (existing) {
      ok(`(skip: ${testUser.name} は既にフリー株式会社のメンバー)`);
    } else {
      const { data: inserted, error } = await supabase
        .from("ow_company_admins")
        .insert({ user_id: testUser.id, company_id: TEST_COMPANY, permission: "member", is_active: true })
        .select("id, is_active, is_default, joined_at")
        .single();
      if (error) {
        ng("INSERT", error.message);
      } else {
        // デフォルト値確認
        if (inserted.is_default === false && inserted.joined_at === null) {
          ok(`INSERT OK: is_default=${inserted.is_default}, joined_at=${inserted.joined_at} (期待通り NULL)`);
        } else {
          ok(`INSERT OK: is_default=${inserted.is_default}, joined_at=${inserted.joined_at}`);
        }
        // クリーンアップ
        await supabase.from("ow_company_admins").delete().eq("id", inserted.id);
        console.log(`  🧹 cleanup: ${testUser.name} の行を削除`);
      }
    }
  }
}

// ── R-4: pending invite レコードの SELECT (user_id IS NULL 行) ───────────
console.log("R-4: pending invite (user_id IS NULL) の SELECT 確認");
{
  const { data, error } = await supabase
    .from("ow_company_admins")
    .select("id, user_id, invited_email, is_default, joined_at")
    .is("user_id", null);
  if (error) ng("pending SELECT", error.message);
  else ok(`pending 件数: ${data?.length ?? 0}件 (0件なら正常)`);
}

// ── R-5: getCompanyId 相当 (ow_user_roles 経由) ─────────────────────────
// Step 6 のコード変更前は引き続き ow_user_roles を使う
console.log("R-5: ow_user_roles SELECT (getCompanyId 相当) — 既存コードが壊れていないか");
{
  const { data, error } = await supabase
    .from("ow_user_roles")
    .select("tenant_id")
    .eq("user_id", "4a0decfa-6bc9-4bbb-9800-3ad06b4e5319") // 柴久人の auth_id
    .eq("role", "company")
    .not("tenant_id", "is", null)
    .maybeSingle();
  if (error) ng("ow_user_roles SELECT", error.message);
  else if (data?.tenant_id === "59879917-4fa0-44d8-9cf1-189251234a26") ok(`tenant_id=フリー株式会社 ✓`);
  else ng("ow_user_roles SELECT", `unexpected: ${JSON.stringify(data)}`);
}

console.log(`\n━━━ 結果: ${passed} passed / ${failed} failed ━━━`);
if (failed > 0) process.exit(1);
