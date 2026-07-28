/**
 * テスト残存行を削除するスクリプト
 * 対象: company_id=1c5fc5fe-2354-4b5c-9481-6c4aca59a308, period_start=2026-06-01
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

const TEST_COMPANY_ID = "1c5fc5fe-2354-4b5c-9481-6c4aca59a308";

// 削除前確認
const { data: before } = await admin
  .from("ow_scout_quotas")
  .select("company_id, period_start, bonus_credits, monthly_limit")
  .eq("company_id", TEST_COMPANY_ID);

if (!before || before.length === 0) {
  console.log("削除対象行は既に存在しません。テーブルはクリーンです。");
  process.exit(0);
}

console.log("削除する行:");
console.table(before);

const { error } = await admin
  .from("ow_scout_quotas")
  .delete()
  .eq("company_id", TEST_COMPANY_ID);

if (error) {
  console.error("DELETE 失敗:", error.message);
  process.exit(1);
}

// 削除後確認
const { data: after } = await admin
  .from("ow_scout_quotas")
  .select("company_id")
  .eq("company_id", TEST_COMPANY_ID);

if (!after || after.length === 0) {
  console.log("✓ 削除完了。テーブルに残存なし。");
} else {
  console.error("⚠️  削除後もレコードが残っています:", after);
  process.exit(1);
}
