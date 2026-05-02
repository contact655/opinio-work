/**
 * seed-employee-categories.ts
 *
 * 各社の現役社員から role_category_id を自動集計し、
 * ow_company_employee_categories に投入する (案 Z = データ駆動)。
 *
 * ⚠️  安全装置:
 *   - --confirm フラグなしでは実行しない（説明のみ）
 *   - --dry-run で投入プランのみ表示（実際には投入しない）
 *   - ON CONFLICT DO NOTHING で冪等実行可能
 *
 * 使い方:
 *   npx tsx scripts/seed-employee-categories.ts            # 説明のみ
 *   npx tsx scripts/seed-employee-categories.ts --dry-run  # ドライラン
 *   npx tsx scripts/seed-employee-categories.ts --confirm  # 本番投入
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// ─── 環境変数 ─────────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const text = readFileSync(".env.local", "utf-8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* fallback to process.env */ }
  return { ...env, ...process.env } as Record<string, string>;
}

const env = loadEnv();
const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("⚠️  環境変数未設定: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── 引数解析 ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun  = args.includes("--dry-run");
const isConfirm = args.includes("--confirm");

if (!isConfirm && !isDryRun) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" seed-employee-categories.ts");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("  ow_company_employee_categories に各社のカテゴリ設定を投入します。");
  console.log("");
  console.log("  動作:");
  console.log("  - 各社の現役社員から role_category_id を集計（重複排除）");
  console.log("  - ow_roles.display_order を継承してソート");
  console.log("  - ON CONFLICT DO NOTHING で冪等実行可能（再実行安全）");
  console.log("  - 社員 0 名のカテゴリは生成しない");
  console.log("");
  console.log("  対象: テスト株式会社_001〜_030 (30 社、各 6 名)");
  console.log("  予想投入数: 約 150〜180 行");
  console.log("");
  console.log("  コマンド:");
  console.log("    ドライラン: npx tsx scripts/seed-employee-categories.ts --dry-run");
  console.log("    本番投入:   npx tsx scripts/seed-employee-categories.ts --confirm");
  console.log("");
  process.exit(0);
}

// ─── メイン処理 ───────────────────────────────────────────────────────────────

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(isDryRun ? " 🔍 ドライランモード（実際には投入しない）" : " 🚀 本番投入モード");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // ── テスト企業 30 社を取得 ────────────────────────────────────────────────
  const { data: companies, error: companiesErr } = await supabase
    .from("ow_companies")
    .select("id, name")
    .like("name", "テスト株式会社_%")
    .order("name");

  if (companiesErr || !companies) {
    console.error("企業取得失敗:", companiesErr?.message);
    process.exit(1);
  }
  if (companies.length !== 30) {
    console.error(`⚠️  企業数が 30 ではない: ${companies.length} 社`);
    if (!isDryRun) process.exit(1);
  }

  const companyIds = companies.map((c) => c.id as string);
  const companyNameById = new Map(companies.map((c) => [c.id as string, c.name as string]));

  // ── ow_roles を取得（id → { name, display_order } マップ）────────────────
  const { data: roles, error: rolesErr } = await supabase
    .from("ow_roles")
    .select("id, name, display_order, parent_id");

  if (rolesErr || !roles) {
    console.error("ow_roles 取得失敗:", rolesErr?.message);
    process.exit(1);
  }
  const roleById = new Map(roles.map((r) => [r.id as string, r]));

  // ── 現役社員を取得（テスト企業 30 社分）─────────────────────────────────
  const { data: experiences, error: expErr } = await supabase
    .from("ow_experiences")
    .select("company_id, role_category_id")
    .in("company_id", companyIds)
    .eq("is_current", true)
    .not("role_category_id", "is", null);

  if (expErr || !experiences) {
    console.error("現役社員取得失敗:", expErr?.message);
    process.exit(1);
  }
  console.log(`対象現役社員: ${experiences.length} 名`);

  // ── 企業ごとにカテゴリを集計（重複排除）─────────────────────────────────
  type CategoryEntry = { roleId: string; roleName: string; displayOrder: number };
  const planByCompany = new Map<string, { name: string; cats: CategoryEntry[] }>();

  for (const c of companies) {
    planByCompany.set(c.id as string, { name: c.name as string, cats: [] });
  }

  for (const exp of experiences) {
    const cid = exp.company_id as string;
    const rid = exp.role_category_id as string;
    const role = roleById.get(rid);
    if (!role) continue;

    const plan = planByCompany.get(cid)!;
    if (plan.cats.some((cat) => cat.roleId === rid)) continue; // 重複スキップ

    plan.cats.push({
      roleId: rid,
      roleName: role.name as string,
      displayOrder: (role.display_order as number) ?? 0,
    });
  }

  // display_order でソート
  for (const plan of planByCompany.values()) {
    plan.cats.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  // ── 投入プラン表示 ────────────────────────────────────────────────────────
  const plans = Array.from(planByCompany.entries())
    .map(([cid, v]) => ({ companyId: cid, ...v }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let totalRows = 0;
  const catCounts: number[] = [];

  console.log("\n===== 投入プラン =====");
  for (const plan of plans) {
    const catNames = plan.cats.map((c) => c.roleName).join(", ");
    console.log(`  ${plan.name}: ${plan.cats.length} カテゴリ → [${catNames}]`);
    totalRows += plan.cats.length;
    catCounts.push(plan.cats.length);
  }

  const minCats = Math.min(...catCounts);
  const maxCats = Math.max(...catCounts);
  const avgCats = (totalRows / plans.length).toFixed(1);

  console.log(`\n  合計: ${plans.length} 社 / ${totalRows} 行`);
  console.log(`  平均: ${avgCats} カテゴリ/社`);
  console.log(`  最小: ${minCats} カテゴリ`);
  console.log(`  最大: ${maxCats} カテゴリ`);

  if (isDryRun) {
    console.log("\n✅ ドライラン完了（実際には投入していません）");
    console.log("\n本番投入: npx tsx scripts/seed-employee-categories.ts --confirm");
    return;
  }

  // ── 5 秒カウントダウン ────────────────────────────────────────────────────
  console.log("\n⚠️  5 秒後に投入を実行します。停止する場合は Ctrl+C");
  for (let i = 5; i >= 1; i--) {
    process.stdout.write(`  ${i}...\r`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("\n");

  // ── 本番投入 ─────────────────────────────────────────────────────────────
  let insertCount = 0;
  let skipCount   = 0;
  let errorCount  = 0;

  for (const plan of plans) {
    for (const cat of plan.cats) {
      const { error } = await supabase
        .from("ow_company_employee_categories")
        .insert({
          company_id:    plan.companyId,
          role_id:       cat.roleId,
          display_order: cat.displayOrder,
        });

      if (error) {
        if (error.code === "23505") {
          skipCount++; // UNIQUE 制約違反 = 既に存在
        } else {
          console.error(`  ✗ ${plan.name} / ${cat.roleName}: ${error.message}`);
          errorCount++;
        }
      } else {
        insertCount++;
      }
    }
  }

  // ── 投入後確認 ────────────────────────────────────────────────────────────
  const { count: totalInserted } = await supabase
    .from("ow_company_employee_categories")
    .select("*", { count: "exact", head: true });

  console.log("===== 結果 =====");
  console.log(`  ✅ 投入: ${insertCount} 行`);
  console.log(`  ⏭️  スキップ（既存）: ${skipCount} 行`);
  console.log(`  ❌ エラー: ${errorCount} 行`);
  console.log(`  テーブル総行数（投入後）: ${totalInserted}`);
  console.log("\n🎉 社員カテゴリ投入完了");
}

main().catch((err) => {
  console.error("予期しないエラー:", err);
  process.exit(1);
});
