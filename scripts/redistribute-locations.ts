/**
 * redistribute-locations.ts
 *
 * ow_companies + ow_jobs の location を全国 8 都道府県に分散更新するスクリプト。
 *
 * ⚠️  安全装置:
 *   - --confirm フラグなしでは実行しない（説明表示のみ）
 *   - --dry-run で変更内容のみ表示（実際には更新しない）
 *   - 対象: テスト株式会社_001〜030 のみ（name LIKE 'テスト株式会社_%'）
 *   - DELETE 禁止、UPDATE のみ
 *
 * 使い方:
 *   npx tsx scripts/redistribute-locations.ts              # 説明表示のみ
 *   npx tsx scripts/redistribute-locations.ts --dry-run    # ドライラン
 *   npx tsx scripts/redistribute-locations.ts --confirm    # 本番投入（要確認）
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// ─── 環境変数読み込み ──────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const text = readFileSync(".env.local", "utf-8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env.local が無い場合は process.env にフォールバック
  }
  return { ...env, ...process.env } as Record<string, string>;
}

const env = loadEnv();
const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("⚠️  環境変数が設定されていません: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── 引数解析 ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isConfirm = args.includes("--confirm");

if (!isConfirm && !isDryRun) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" redistribute-locations.ts");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("  ow_companies と ow_jobs の location を全国 8 都道府県に分散更新します。");
  console.log("");
  console.log("  対象: テスト株式会社_001〜030 (name LIKE 'テスト株式会社_%')");
  console.log("  操作: UPDATE のみ（DELETE は行わない）");
  console.log("");
  console.log("  分布:");
  console.log("    東京都: 17 社（渋谷区/千代田区/港区/新宿区/中央区/品川区）");
  console.log("    大阪府:  4 社（大阪市中央区/大阪市北区）");
  console.log("    福岡県:  3 社（福岡市中央区/福岡市博多区）");
  console.log("    愛知県:  2 社（名古屋市中区/名古屋市西区）");
  console.log("    北海道:  1 社（札幌市中央区）");
  console.log("    京都府:  1 社（京都市中京区）");
  console.log("    沖縄県:  1 社（那覇市）");
  console.log("    神奈川県: 1 社（横浜市西区）");
  console.log("");
  console.log("  コマンド:");
  console.log("    ドライラン: npx tsx scripts/redistribute-locations.ts --dry-run");
  console.log("    本番投入:   npx tsx scripts/redistribute-locations.ts --confirm");
  console.log("");
  process.exit(0);
}

// ─── 分布定義 ─────────────────────────────────────────────────────────────────
// 合計: 30 社

const LOCATION_DISTRIBUTION: { location: string; count: number }[] = [
  { location: "東京都",  count: 17 },
  { location: "大阪府",  count: 4  },
  { location: "福岡県",  count: 3  },
  { location: "愛知県",  count: 2  },
  { location: "北海道",  count: 1  },
  { location: "京都府",  count: 1  },
  { location: "沖縄県",  count: 1  },
  { location: "神奈川県", count: 1 },
];

// 検算
const totalCount = LOCATION_DISTRIBUTION.reduce((sum, d) => sum + d.count, 0);
if (totalCount !== 30) {
  console.error(`⚠️  分布合計が 30 ではない: ${totalCount}`);
  process.exit(1);
}

// ─── メイン処理 ───────────────────────────────────────────────────────────────

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(isDryRun ? " 🔍 ドライランモード（実際には更新しない）" : " 🚀 本番投入モード");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // ── Step 1: テスト企業取得 ──────────────────────────────────────────────────

  const { data: companies, error: companiesErr } = await supabase
    .from("ow_companies")
    .select("id, name, location")
    .like("name", "テスト株式会社_%")
    .order("name");

  if (companiesErr || !companies) {
    console.error("企業取得失敗:", companiesErr);
    process.exit(1);
  }

  if (companies.length === 0) {
    console.error("⚠️  テスト企業が 0 件です。対象データが存在しません。");
    process.exit(1);
  }

  if (companies.length !== 30) {
    console.warn(`⚠️  企業数が 30 ではありません: ${companies.length} 社`);
    if (!isDryRun) {
      console.error("本番投入を中断します。30 社揃ってから実行してください。");
      process.exit(1);
    }
  }

  console.log(`対象企業: ${companies.length} 社`);
  console.log("");

  // ── Step 2: 住所割当 ──────────────────────────────────────────────────────

  const assignments: {
    companyId: string;
    companyName: string;
    oldLocation: string | null;
    newLocation: string;
  }[] = [];

  let companyIdx = 0;
  for (const dist of LOCATION_DISTRIBUTION) {
    for (let i = 0; i < dist.count; i++) {
      if (companyIdx >= companies.length) break;
      const company = companies[companyIdx];
      assignments.push({
        companyId: company.id as string,
        companyName: company.name as string,
        oldLocation: company.location as string | null,
        newLocation: dist.location,
      });
      companyIdx++;
    }
  }

  // ── Step 3: 割当プラン表示 ──────────────────────────────────────────────────

  console.log("===== 割当プラン =====");
  for (const a of assignments) {
    const changed = a.oldLocation !== a.newLocation ? " ← 変更あり" : " (変更なし)";
    console.log(`  ${a.companyName}: ${a.oldLocation ?? "(null)"} → ${a.newLocation}${changed}`);
  }
  console.log("");

  // 都道府県別集計
  const byPref: Record<string, number> = {};
  for (const a of assignments) {
    const m = a.newLocation.match(/^(北海道|東京都|大阪府|京都府|.+?[県])/);
    const pref = m?.[1] ?? "不明";
    byPref[pref] = (byPref[pref] ?? 0) + 1;
  }

  console.log("===== 都道府県別集計（新）=====");
  for (const [pref, count] of Object.entries(byPref)) {
    console.log(`  ${pref}: ${count} 社`);
  }
  console.log("");

  // ── ドライランはここで終了 ──────────────────────────────────────────────────

  if (isDryRun) {
    console.log("✅ ドライラン完了（実際には更新していません）");
    console.log("");
    console.log("本番投入する場合: npx tsx scripts/redistribute-locations.ts --confirm");
    return;
  }

  // ── Step 4: 本番投入（5 秒カウントダウン）────────────────────────────────────

  console.log("⚠️  5 秒後に更新を実行します。停止する場合は Ctrl+C");
  for (let i = 5; i >= 1; i--) {
    process.stdout.write(`  ${i}...\r`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("");
  console.log("");

  // 1. ow_companies 更新
  console.log("[1/2] ow_companies を更新中...");
  let companySuccess = 0;
  let companyFail = 0;
  for (const a of assignments) {
    const { error } = await supabase
      .from("ow_companies")
      .update({ location: a.newLocation })
      .eq("id", a.companyId);

    if (error) {
      console.error(`  ✗ ${a.companyName} 更新失敗:`, error.message);
      companyFail++;
    } else {
      companySuccess++;
    }
  }
  console.log(`  ✅ ${companySuccess} 社更新完了${companyFail > 0 ? `（${companyFail} 社失敗）` : ""}`);
  console.log("");

  // 2. ow_jobs 更新（各企業の求人を同じ住所に揃える）
  console.log("[2/2] ow_jobs を更新中...");
  let jobSuccess = 0;
  let jobFail = 0;
  for (const a of assignments) {
    const { error, count } = await supabase
      .from("ow_jobs")
      .update({ location: a.newLocation })
      .eq("company_id", a.companyId)
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error(`  ✗ ${a.companyName} の求人更新失敗:`, error.message);
      jobFail++;
    } else {
      jobSuccess += count ?? 0;
    }
  }
  console.log(`  ✅ ${jobSuccess} 件の求人更新完了${jobFail > 0 ? `（${jobFail} 社分失敗）` : ""}`);
  console.log("");

  // ── 最終確認クエリ ──────────────────────────────────────────────────────────

  console.log("===== 更新後の location 分布（確認）=====");
  const { data: afterData } = await supabase
    .from("ow_companies")
    .select("location")
    .like("name", "テスト株式会社_%");

  const afterDist: Record<string, number> = {};
  for (const row of afterData ?? []) {
    const m = (row.location as string | null)?.match(/^(北海道|東京都|大阪府|京都府|.+?[県])/);
    const pref = m?.[1] ?? "不明";
    afterDist[pref] = (afterDist[pref] ?? 0) + 1;
  }
  for (const [pref, count] of Object.entries(afterDist)) {
    console.log(`  ${pref}: ${count} 社`);
  }
  console.log("");

  console.log("🎉 全更新完了");
}

main().catch((err) => {
  console.error("予期しないエラー:", err);
  process.exit(1);
});
