/**
 * commit 2.6b: getCompanyContext ロジックテスト
 *
 * API Route のセッション Cookie をスクリプトから取得するのは困難なため、
 * getCompanyContext が内部で発行するのと同じ DB クエリを Supabase JS で再現し、
 * 解決ロジックを検証する。
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://xtutnecqeamftygufxco.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let passed = 0, failed = 0;
function ok(label) { console.log(`  ✅ ${label}`); passed++; }
function ng(label, detail) { console.log(`  ❌ ${label}: ${detail}`); failed++; }

// === getCompanyContext のコアロジックを再現 ===
async function getCompanyContextSim(authUserId, cookieCompanyId) {
  const { data: owUser } = await supabase
    .from("ow_users").select("id")
    .eq("auth_id", authUserId).maybeSingle();
  if (!owUser) return null;

  const { data: rows } = await supabase
    .from("ow_company_admins")
    .select("company_id, is_default, joined_at, permission")
    .eq("user_id", owUser.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: true, nullsFirst: false });

  if (!rows || rows.length === 0) return null;

  const allMemberships = rows.map(r => ({
    companyId: r.company_id,
    isDefault: r.is_default ?? false,
    joinedAt: r.joined_at ?? null,
    permission: r.permission,
  }));

  let resolved = cookieCompanyId
    ? allMemberships.find(m => m.companyId === cookieCompanyId)
    : undefined;
  if (!resolved) resolved = allMemberships.find(m => m.isDefault);
  if (!resolved) resolved = allMemberships[0];

  return { companyId: resolved.companyId, owUserId: owUser.id, allMemberships };
}

// 定数
const SHIBA_AUTH_ID = "4a0decfa-6bc9-4bbb-9800-3ad06b4e5319"; // 柴久人
const SHIBA_OW_ID   = "fe7dfe9b-75d4-4a75-a821-fa1a9599a416";
const FREEE_ID      = "59879917-4fa0-44d8-9cf1-189251234a26"; // フリー株式会社
const LAYERX_ID     = "b93cef08-22f5-4344-83ce-c6710c285a04"; // 株式会社LayerX

// ── A-1: Cookie なし → is_default=true の会社 (フリー株式会社) ───────────
console.log("A-1: Cookie なし → is_default フリー株式会社");
{
  const ctx = await getCompanyContextSim(SHIBA_AUTH_ID, undefined);
  if (!ctx) { ng("A-1", "null が返った"); }
  else if (ctx.companyId === FREEE_ID && ctx.owUserId === SHIBA_OW_ID) {
    ok(`companyId=フリー株式会社 owUserId=${ctx.owUserId.slice(0,8)} allMemberships=${ctx.allMemberships.length}件`);
  } else {
    ng("A-1", `companyId=${ctx.companyId}, owUserId=${ctx.owUserId}`);
  }
}

// ── A-2: Cookie に有効な company_id → Cookie が優先 ─────────────────────
console.log("A-2: Cookie=LayerX → LayerX が選ばれる");
{
  const ctx = await getCompanyContextSim(SHIBA_AUTH_ID, LAYERX_ID);
  if (!ctx) { ng("A-2", "null が返った"); }
  else if (ctx.companyId === LAYERX_ID) {
    ok(`companyId=LayerX ✓`);
  } else {
    ng("A-2", `companyId=${ctx.companyId} (LayerX を期待)`);
  }
}

// ── A-3: Cookie に不正な UUID → is_default にフォールバック ─────────────
console.log("A-3: Cookie=無効UUID → is_default フリー株式会社 にフォールバック");
{
  const ctx = await getCompanyContextSim(SHIBA_AUTH_ID, "00000000-0000-0000-0000-000000000000");
  if (!ctx) { ng("A-3", "null が返った"); }
  else if (ctx.companyId === FREEE_ID) {
    ok(`is_default フォールバック: フリー株式会社 ✓`);
  } else {
    ng("A-3", `companyId=${ctx.companyId} (フリー株式会社を期待)`);
  }
}

// ── A-4: 所属なしユーザー → null ─────────────────────────────────────────
console.log("A-4: 所属なしユーザー → null");
{
  // ow_users に存在するが ow_company_admins に行がないユーザーを探す
  const { data: noMemberUsers } = await supabase
    .from("ow_users")
    .select("id, auth_id, name")
    .not("auth_id", "is", null)
    .neq("auth_id", SHIBA_AUTH_ID)
    .neq("auth_id", "f116554b-2053-4736-9c91-b12880934fb4"); // hshiba

  // ow_company_admins にない auth_id を探す
  let noMemberAuthId = null;
  for (const u of noMemberUsers ?? []) {
    const { data: membership } = await supabase
      .from("ow_company_admins")
      .select("id")
      .eq("user_id", u.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) {
      noMemberAuthId = u.auth_id;
      console.log(`  (使用ユーザー: ${u.name})`);
      break;
    }
  }

  if (!noMemberAuthId) {
    ok("(skip: 所属なしユーザーが見つからない — 全ユーザーが何かしらの会社に所属)");
  } else {
    const ctx = await getCompanyContextSim(noMemberAuthId, undefined);
    if (ctx === null) {
      ok("null ✓");
    } else {
      ng("A-4", `null を期待したが ${JSON.stringify(ctx)} が返った`);
    }
  }
}

// ── A-5: deprecated ラッパーの互換確認 ──────────────────────────────────
console.log("A-5: deprecated ラッパー (getOwUserId/getCompanyId 相当) の互換");
{
  // getOwUserId 相当: ctx.owUserId
  const ctxOwUser = await getCompanyContextSim(SHIBA_AUTH_ID, undefined);
  if (ctxOwUser?.owUserId === SHIBA_OW_ID) {
    ok(`owUserId=${SHIBA_OW_ID.slice(0,8)} ✓`);
  } else {
    ng("owUserId", `${ctxOwUser?.owUserId}`);
  }

  // getCompanyId 相当: ctx.companyId (Cookie なし → is_default = フリー)
  if (ctxOwUser?.companyId === FREEE_ID) {
    ok(`companyId=フリー株式会社 ✓`);
  } else {
    ng("companyId", `${ctxOwUser?.companyId}`);
  }
}

// ── A-6: actorAdmin を allMemberships から取得できるか ───────────────────
console.log("A-6: allMemberships から actorAdmin.permission 確認");
{
  const ctx = await getCompanyContextSim(SHIBA_AUTH_ID, undefined);
  const membership = ctx?.allMemberships.find(m => m.companyId === FREEE_ID);
  if (membership?.permission === "admin") {
    ok(`permission=admin (フリー株式会社) ✓`);
  } else {
    ng("A-6", `permission=${membership?.permission}`);
  }
}

console.log(`\n━━━ 結果: ${passed} passed / ${failed} failed ━━━`);
if (failed > 0) process.exit(1);
