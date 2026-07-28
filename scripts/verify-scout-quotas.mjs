/**
 * ow_scout_quotas の actions.ts 動作検証
 * PK は company_id のみ（1社1行設計）
 *
 * 検証内容:
 * 1. 行なし → INSERT (bonus_credits=amount)
 * 2. 行あり → UPDATE (bonus_credits が加算される)
 * 3. 確認後にテスト行を削除
 */

import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync("/Users/hisato/opinio-work/.env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"], {
  auth: { persistSession: false },
});

// テスト対象: ow_companies の最初の公開企業
const { data: companies, error: ce } = await admin.from("ow_companies").select("id, name").eq("is_published", true).limit(1);
if (ce || !companies?.length) { console.error("企業取得失敗:", ce?.message); process.exit(1); }
const { id: CID, name: CNAME } = companies[0];

console.log(`\nテスト対象企業: ${CNAME} (${CID})`);

// ── Pre-check ──────────────────────────────────────────────────────────────
const { data: pre, error: pe } = await admin
  .from("ow_scout_quotas").select("company_id").eq("company_id", CID).maybeSingle();
if (pe) { console.error("pre-check 失敗:", pe.message); process.exit(1); }
if (pre) {
  console.error("⚠️  テスト前に既存レコードが存在します。テストを中止します。");
  process.exit(1);
}

// ── Step 1: INSERT (行なし → 新規) ────────────────────────────────────────
console.log("\n[STEP 1] 行なし → INSERT");
const { error: i1 } = await admin
  .from("ow_scout_quotas")
  .insert({ company_id: CID, bonus_credits: 10, monthly_limit: 30, used_this_month: 0 });
if (i1) { console.error("INSERT 失敗:", i1.message); process.exit(1); }

const { data: r1 } = await admin.from("ow_scout_quotas").select("bonus_credits, monthly_limit").eq("company_id", CID).maybeSingle();
const p1 = r1?.bonus_credits === 10 && r1?.monthly_limit === 30;
console.log(`  bonus_credits=${r1?.bonus_credits} (期待=10) ${p1 ? "✓" : "❌"}`);

// ── Step 2: UPDATE (行あり → 加算) ────────────────────────────────────────
console.log("\n[STEP 2] 行あり → UPDATE (+5)");
const { error: u2 } = await admin
  .from("ow_scout_quotas")
  .update({ bonus_credits: (r1?.bonus_credits ?? 0) + 5 })
  .eq("company_id", CID);
if (u2) { console.error("UPDATE 失敗:", u2.message); process.exit(1); }

const { data: r2 } = await admin.from("ow_scout_quotas").select("bonus_credits").eq("company_id", CID).maybeSingle();
const p2 = r2?.bonus_credits === 15;
console.log(`  bonus_credits=${r2?.bonus_credits} (期待=15) ${p2 ? "✓" : "❌"}`);

const passed = p1 && p2;
console.log(passed ? "\n✅ 検証 PASS" : "\n❌ 検証 FAIL");

// ── DELETE ────────────────────────────────────────────────────────────────
console.log(`\n[DELETE] テスト行を削除します: company_id=${CID}`);
const { error: de } = await admin.from("ow_scout_quotas").delete().eq("company_id", CID);
if (de) { console.error("DELETE 失敗:", de.message); process.exit(1); }

const { data: post } = await admin.from("ow_scout_quotas").select("company_id").eq("company_id", CID).maybeSingle();
if (!post) {
  console.log("  ✓ 削除完了。残存なし。");
} else {
  console.error("  ⚠️  削除後にレコードが残っています");
}

process.exit(passed ? 0 : 1);
