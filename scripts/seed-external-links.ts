/**
 * scripts/seed-external-links.ts
 *
 * ow_company_external_links テーブルへのサンプルデータ投入
 *
 * 対象: テスト株式会社_001〜030 (各社 3-5 件、計 90-150 件)
 * 既存データ: 保持 (新規 INSERT のみ、DELETE/UPDATE なし)
 *
 * 実行方法:
 *   ドライラン (件数確認のみ):
 *     npx tsx scripts/seed-external-links.ts --dry-run
 *
 *   本番投入 (--confirm 必須):
 *     npx tsx scripts/seed-external-links.ts --confirm
 */

import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";

// .env.local を手動パース (dotenv 非依存、既存スクリプトと同パターン)
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx > 0) {
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    if (key) process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ 環境変数が設定されていません");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", !!SUPABASE_URL);
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", !!SUPABASE_SERVICE_ROLE_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── CLI フラグ解析 ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isConfirmed = args.includes("--confirm");

if (!isDryRun && !isConfirmed) {
  console.log("");
  console.log("⚠️  このスクリプトは本番 DB にサンプルデータを投入します");
  console.log("");
  console.log("投入内容:");
  console.log("  - テスト株式会社_001〜030 に各社 3〜5 件、計 90〜150 件");
  console.log("  - 既存の ow_company_external_links データは保持 (新規 INSERT のみ)");
  console.log("");
  console.log("ドライラン (投入件数のみ確認):  npx tsx scripts/seed-external-links.ts --dry-run");
  console.log("本番投入 (実際に INSERT する):  npx tsx scripts/seed-external-links.ts --confirm");
  console.log("");
  process.exit(0);
}

// ─── サンプルデータ定義 ──────────────────────────────────────────────────────

const TITLE_TEMPLATES = [
  "{company} CEO インタビュー: 創業背景と未来のビジョン",
  "{company} シリーズ A 資金調達のお知らせ",
  "{company} のエンジニアリング組織が語る、技術選定の哲学",
  "【取材】{company} はなぜこの市場で勝負するのか",
  "{company} カルチャー紹介: 私たちが大事にしている 5 つの価値観",
  "{company} 2026 Q1 振り返り: チームで達成した 3 つのこと",
  "{company} デザイナーチームが語る、プロダクトデザインの裏側",
  "{company} 新オフィス公開: 働き方の選択肢を広げる空間",
  "【ポッドキャスト】{company} の創業者と語る、キャリアと選択",
  "{company} エンジニア募集説明会のアーカイブ",
  "{company} プロダクトマネージャーが語る、優先順位のつけ方",
  "{company} 社内勉強会レポート: チームで成長するための仕組み",
  "{company} 新機能リリース: ユーザーの声を形にした 3 ヶ月",
  "【連載第1回】{company} が見ている市場の未来",
  "{company} セールスチームの働き方をご紹介します",
];

const DESCRIPTION_TEMPLATES = [
  "創業者が語る、事業の起点と現在地。",
  "プロダクトと組織の両輪を支える考え方を共有します。",
  "未経験から活躍するメンバーの実体験を紹介。",
  "現場のエンジニアが感じる、この会社の魅力。",
  "創業 5 年で 100 名規模に成長した組織の歩み。",
  "顧客課題から始まるプロダクト開発の現場をお伝えします。",
  "リモートワーク下での協働を支える仕組みとは。",
];

const SOURCES_BY_TYPE: Record<string, string[]> = {
  article: ["note", "PR TIMES", "Forbes JAPAN", "PIVOT", "ITmedia", "ログミー Biz", "Wantedly"],
  video:   ["YouTube", "PIVOT"],
  audio:   ["Voicy", "Spotify Podcast"],
  social:  ["X (Twitter)", "LinkedIn"],
  event:   ["connpass", "TECH PLAY"],
  other:   ["自社ブログ"],
};

// Unsplash 公開画像 URL (オフィス・ビジネス・チーム系、cache-busting なし)
const THUMBNAIL_URLS = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1573164713619-24c711fe7878?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1531538606174-0f90ff5dce83?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop",
];

// type 重み付き配列 (article 60%, video 20%, social 10%, event 5%, audio 5%)
const TYPES_WITH_WEIGHT: string[] = [
  ...Array(60).fill("article"),
  ...Array(20).fill("video"),
  ...Array(10).fill("social"),
  ...Array(5).fill("event"),
  ...Array(5).fill("audio"),
];

// created_by_role 重み付き配列 (company 70%, editor 30%)
const ROLES_WITH_WEIGHT: string[] = [
  ...Array(70).fill("company"),
  ...Array(30).fill("editor"),
];

// ─── ユーティリティ ──────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomDate(): string {
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const random = oneYearAgo + Math.random() * (now - oneYearAgo);
  return new Date(random).toISOString();
}

// ─── メイン処理 ──────────────────────────────────────────────────────────────

async function main() {
  console.log("─".repeat(50));
  if (isDryRun) {
    console.log("🔍 ドライランモード (DB への書き込みなし)");
  } else {
    console.log("🚀 本番投入モード");
  }
  console.log("─".repeat(50));
  console.log("");

  // ① 既存件数確認
  const { count: existingCount } = await supabase
    .from("ow_company_external_links")
    .select("*", { count: "exact", head: true });

  console.log(`既存件数 (ow_company_external_links): ${existingCount ?? 0} 件`);

  // ② テスト株式会社を取得
  const { data: testCompanies, error: companiesErr } = await supabase
    .from("ow_companies")
    .select("id, name")
    .like("name", "テスト株式会社_%")
    .order("name");

  if (companiesErr || !testCompanies) {
    console.error("❌ 企業取得失敗:", companiesErr);
    process.exit(1);
  }

  console.log(`対象企業: ${testCompanies.length} 社`);
  console.log("");

  // ③ レコード生成
  const records: {
    company_id: string;
    url: string;
    type: string;
    title: string;
    description: string | null;
    thumbnail_url: string;
    source_name: string;
    published_at: string;
    created_by_role: string;
    created_by_user_id: null;
    is_published: boolean;
    sort_order: number;
  }[] = [];

  for (const company of testCompanies) {
    const numLinks = 3 + Math.floor(Math.random() * 3); // 3〜5 件
    const slug = company.name
      .replace("テスト株式会社_", "test-")
      .toLowerCase();

    for (let i = 0; i < numLinks; i++) {
      const type = pickRandom(TYPES_WITH_WEIGHT);
      const role = pickRandom(ROLES_WITH_WEIGHT);
      const titleTpl = pickRandom(TITLE_TEMPLATES);
      const sourceName = pickRandom(SOURCES_BY_TYPE[type] ?? ["その他"]);
      const withDesc = Math.random() > 0.4; // 60% の確率で説明あり

      records.push({
        company_id: company.id,
        url: `https://example.com/test-companies/${slug}/posts/${i + 1}`,
        type,
        title: titleTpl.replace(/\{company\}/g, company.name),
        description: withDesc ? pickRandom(DESCRIPTION_TEMPLATES) : null,
        thumbnail_url: pickRandom(THUMBNAIL_URLS),
        source_name: sourceName,
        published_at: pickRandomDate(),
        created_by_role: role,
        created_by_user_id: null, // auth.users 参照、サンプルなので null
        is_published: true,
        sort_order: 0,
      });
    }
  }

  // ④ 内訳集計
  const byRole: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const r of records) {
    byRole[r.created_by_role] = (byRole[r.created_by_role] ?? 0) + 1;
    byType[r.type] = (byType[r.type] ?? 0) + 1;
  }

  console.log(`投入予定: ${records.length} 件`);
  console.log("");
  console.log("内訳 (created_by_role):");
  for (const [k, v] of Object.entries(byRole)) {
    const pct = ((v / records.length) * 100).toFixed(0);
    console.log(`  ${k}: ${v} 件 (${pct}%)`);
  }
  console.log("内訳 (type):");
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    const pct = ((v / records.length) * 100).toFixed(0);
    console.log(`  ${k}: ${v} 件 (${pct}%)`);
  }
  console.log("");

  // ⑤ ドライランならここで終了
  if (isDryRun) {
    console.log("✅ ドライラン完了 (実際には投入していません)");
    console.log("   本番投入する場合: npx tsx scripts/seed-external-links.ts --confirm");
    return;
  }

  // ⑥ 本番投入: 5 秒カウントダウン
  console.log("⚠️  5 秒後に INSERT を実行します。停止する場合は Ctrl+C");
  for (let i = 5; i >= 1; i--) {
    process.stdout.write(`   ${i}... `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("");
  console.log("");

  // ⑦ バッチ INSERT (50 件ずつ分割してタイムアウト回避)
  const BATCH_SIZE = 50;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("ow_company_external_links")
      .insert(batch)
      .select("id");

    if (error) {
      console.error(`\n❌ バッチ ${Math.floor(i / BATCH_SIZE) + 1} 投入失敗:`, error);
      console.error(`   投入済み: ${inserted} 件`);
      process.exit(1);
    }
    inserted += data?.length ?? 0;
    process.stdout.write(`   batch ${Math.floor(i / BATCH_SIZE) + 1}: ${data?.length ?? 0} 件投入済み\n`);
  }

  console.log("");
  console.log(`✅ 投入完了: ${inserted} 件`);

  // ⑧ 投入後の件数確認
  const { count: finalCount } = await supabase
    .from("ow_company_external_links")
    .select("*", { count: "exact", head: true });

  console.log(`投入後の総件数: ${finalCount ?? 0} 件`);
}

main().catch((err) => {
  console.error("❌ 予期しないエラー:", err);
  process.exit(1);
});
