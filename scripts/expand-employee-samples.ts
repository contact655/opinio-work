/**
 * expand-employee-samples.ts
 *
 * ow_users + ow_experiences に 120 名のサンプル現役社員を追加。
 * 既存 60 名 (現役社員_001〜_060) は変更しない。
 * 新規 120 名 = 現役社員_061〜_180 (各社 4 名 × 30 社)
 *
 * ⚠️  安全装置:
 *   - --confirm フラグなしでは実行しない（説明のみ）
 *   - --dry-run で投入プランのみ表示
 *   - 既存データ (60 名) は一切変更しない (INSERT のみ)
 *
 * 使い方:
 *   npx tsx scripts/expand-employee-samples.ts            # 説明のみ
 *   npx tsx scripts/expand-employee-samples.ts --dry-run  # ドライラン
 *   npx tsx scripts/expand-employee-samples.ts --confirm  # 本番投入
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
  console.log(" expand-employee-samples.ts");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("  ow_users + ow_experiences に 120 名のサンプル現役社員を追加します。");
  console.log("");
  console.log("  対象: テスト株式会社_001〜_030");
  console.log("  追加: 各社 4 名 × 30 社 = 120 名 (現役社員_061〜_180)");
  console.log("  既存 60 名 (現役社員_001〜_060) は変更しない");
  console.log("");
  console.log("  テンプレート:");
  console.log("    SaaS          (10 社: _001〜_010)");
  console.log("    VerticalSaaS  (10 社: _011〜_020)");
  console.log("    Startup       (10 社: _021〜_030)");
  console.log("");
  console.log("  コマンド:");
  console.log("    ドライラン: npx tsx scripts/expand-employee-samples.ts --dry-run");
  console.log("    本番投入:   npx tsx scripts/expand-employee-samples.ts --confirm");
  console.log("");
  process.exit(0);
}

// ─── 構成定義（各テンプレート × 5 パターン → 追加 4 名のカテゴリ）────────────

// ow_roles.name そのまま使用（スペース含む "SDR / BDR" 等に注意）
const TEMPLATES = {
  saas: {
    range: [1, 10] as [number, number],
    additions: {
      A: ["インサイドセールス", "フィールドセールス", "カスタマーサクセス", "プロダクトマネージャー"],
      B: ["バックエンド", "インサイドセールス", "プロダクトマネージャー", "SDR / BDR"],
      C: ["バックエンド", "フロントエンド", "フィールドセールス", "カスタマーサクセス"],
      D: ["バックエンド", "インサイドセールス", "カスタマーサクセス", "プロダクトマネージャー"],
      E: ["インサイドセールス", "フィールドセールス", "カスタマーサクセス", "プロダクトマネージャー"],
    } as Record<string, string[]>,
  },
  verticalSaas: {
    range: [11, 20] as [number, number],
    additions: {
      A: ["インサイドセールス", "フィールドセールス", "カスタマーサクセス", "CPO"],
      B: ["バックエンド", "フルスタック", "マーケティング", "コーポレート"],
      C: ["バックエンド", "カスタマーサクセス", "コーポレート", "CFO"],
      D: ["バックエンド", "フルスタック", "カスタマーサクセス", "CPO"],
      E: ["フィールドセールス", "カスタマーサクセス", "コーポレート", "CPO"],
    } as Record<string, string[]>,
  },
  startup: {
    range: [21, 30] as [number, number],
    additions: {
      A: ["インサイドセールス", "カスタマーサクセス", "CEO", "CTO"],
      B: ["フルスタック", "エンタープライズ営業", "マーケティング", "CEO"],
      C: ["フルスタック", "カスタマーサクセス", "マーケティング", "CTO"],
      D: ["フルスタック", "マーケティング", "CEO", "COO"],
      E: ["エンタープライズ営業", "カスタマーサクセス", "CEO", "CTO"],
    } as Record<string, string[]>,
  },
};

const PATTERNS = ["A", "B", "C", "D", "E"] as const;

function getPattern(companyNumber: number): string {
  return PATTERNS[(companyNumber - 1) % 5];
}

// アバター色バリエーション（既存と差別化するため別系統）
const AVATAR_COLORS = [
  "#3B82F6", "#8B5CF6", "#EF4444", "#F59E0B", "#10B981",
  "#EC4899", "#6366F1", "#14B8A6", "#F97316", "#A855F7",
  "#0EA5E9", "#D946EF", "#84CC16", "#FB923C", "#38BDF8",
];

// ─── メイン処理 ───────────────────────────────────────────────────────────────

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(isDryRun ? " 🔍 ドライランモード（実際には投入しない）" : " 🚀 本番投入モード");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // ── テスト企業 30 社取得 ──────────────────────────────────────────────────
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
  console.log(`対象企業: ${companies.length} 社`);

  // ── ow_roles 取得（name → id マップ）────────────────────────────────────
  const { data: roles, error: rolesErr } = await supabase
    .from("ow_roles")
    .select("id, name");

  if (rolesErr || !roles) {
    console.error("ow_roles 取得失敗:", rolesErr?.message);
    process.exit(1);
  }
  const roleIdByName = new Map(roles.map((r) => [r.name as string, r.id as string]));

  // ── 投入プラン作成 ────────────────────────────────────────────────────────
  type Addition = { roleName: string; roleId: string };
  type Plan = {
    companyId: string;
    companyName: string;
    companyNumber: number;
    template: string;
    pattern: string;
    additions: Addition[];
  };

  const plans: Plan[] = [];
  for (const company of companies) {
    const match = (company.name as string).match(/_(\d+)$/);
    if (!match) continue;
    const companyNumber = parseInt(match[1], 10);

    let templateKey: keyof typeof TEMPLATES;
    if (companyNumber <= 10)      templateKey = "saas";
    else if (companyNumber <= 20) templateKey = "verticalSaas";
    else                          templateKey = "startup";

    const pattern = getPattern(companyNumber);
    const additionRoleNames = TEMPLATES[templateKey].additions[pattern];

    const additions: Addition[] = additionRoleNames.map((roleName) => {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) throw new Error(`⚠️  role が見つかりません: "${roleName}"`);
      return { roleName, roleId };
    });

    plans.push({
      companyId: company.id as string,
      companyName: company.name as string,
      companyNumber,
      template: templateKey,
      pattern,
      additions,
    });
  }

  // ── 投入プラン表示 ────────────────────────────────────────────────────────
  console.log("\n===== 投入プラン =====");
  for (const plan of plans) {
    const roles = plan.additions.map((a) => a.roleName).join(", ");
    console.log(`  ${plan.companyName} [${plan.template}/${plan.pattern}]: + ${roles}`);
  }

  const totalNew = plans.length * 4;
  console.log(`\n  合計: ${plans.length} 社 × 4 名 = ${totalNew} 名`);
  console.log(`  新規 ow_users:      ${totalNew} 件`);
  console.log(`  新規 ow_experiences: ${totalNew} 件`);
  console.log(`  連番: 現役社員_061 〜 現役社員_${String(60 + totalNew).padStart(3, "0")}`);

  if (isDryRun) {
    console.log("\n✅ ドライラン完了（実際には投入していません）");
    console.log("\n本番投入: npx tsx scripts/expand-employee-samples.ts --confirm");
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
  let employeeNumber = 61;
  let userSuccess = 0;
  let expSuccess = 0;
  let userFail = 0;
  let expFail = 0;

  for (const plan of plans) {
    for (const addition of plan.additions) {
      const paddedNum = String(employeeNumber).padStart(3, "0");
      const userName = `現役社員_${paddedNum}`;
      const email = `sample_employee_${paddedNum}@test.opinio.jp`;
      const avatarColor = AVATAR_COLORS[(employeeNumber - 1) % AVATAR_COLORS.length];

      // 1. ow_users INSERT
      const { data: user, error: userErr } = await supabase
        .from("ow_users")
        .insert({
          name: userName,
          email: email,
          avatar_color: avatarColor,
          is_mentor: false,
          visibility: "public",
        })
        .select("id")
        .single();

      if (userErr || !user) {
        console.error(`  ✗ ${userName} (ow_users) 失敗: ${userErr?.message}`);
        userFail++;
        employeeNumber++;
        continue;
      }
      userSuccess++;

      // 2. ow_experiences INSERT
      const { error: expErr } = await supabase
        .from("ow_experiences")
        .insert({
          user_id: user.id as string,
          company_id: plan.companyId,
          role_category_id: addition.roleId,
          role_title: addition.roleName,
          started_at: "2023-04-01",   // サンプル固定日付
          is_current: true,
          display_order: 0,
        });

      if (expErr) {
        console.error(`  ✗ ${userName} (ow_experiences) 失敗: ${expErr.message}`);
        expFail++;
      } else {
        expSuccess++;
      }

      employeeNumber++;
    }
  }

  // ── 最終集計 ─────────────────────────────────────────────────────────────
  console.log("===== 結果 =====");
  console.log(`  ow_users:      ${userSuccess} 成功 / ${userFail} 失敗`);
  console.log(`  ow_experiences: ${expSuccess} 成功 / ${expFail} 失敗`);

  // 投入後確認
  const { count } = await supabase
    .from("ow_experiences")
    .select("*", { count: "exact", head: true })
    .eq("is_current", true);
  console.log(`\n  現役社員 総数（投入後）: ${count} 名`);

  console.log("\n🎉 サンプル社員拡充完了");
}

main().catch((err) => {
  console.error("予期しないエラー:", err);
  process.exit(1);
});
