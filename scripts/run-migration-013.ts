import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const sql = fs.readFileSync("supabase/migrations/013_post_hire_reports.sql", "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    console.log("Running:", stmt.substring(0, 80) + "...");
    try {
      const { error } = await supabase.rpc("exec_sql", { sql: stmt + ";" });
      if (error) {
        console.log("  RPC error (may need manual execution):", error.message.substring(0, 100));
      } else {
        console.log("  OK");
      }
    } catch (e: any) {
      console.log("  Catch:", e.message?.substring(0, 100));
    }
  }

  // Verify table exists
  const { data, error } = await supabase.from("ow_post_hire_reports").select("id").limit(1);
  if (error) {
    console.log("\n❌ Table ow_post_hire_reports does not exist yet. Please run the SQL manually in Supabase SQL Editor.");
  } else {
    console.log("\n✅ Table ow_post_hire_reports exists!");
  }

  // Verify mentor columns
  const { data: mentors, error: mErr } = await supabase.from("mentors").select("name, success_count, total_sessions").limit(1);
  if (mErr) {
    console.log("❌ Mentor columns not added:", mErr.message.substring(0, 100));
  } else {
    console.log("✅ Mentor columns exist:", JSON.stringify(mentors?.[0]));
  }

  // Verify company columns
  const { data: co, error: cErr } = await supabase.from("ow_companies").select("recruiter_name").limit(1);
  if (cErr) {
    console.log("❌ Recruiter columns not added:", cErr.message.substring(0, 100));
  } else {
    console.log("✅ Recruiter columns exist");
  }
}

run().catch(console.error);
