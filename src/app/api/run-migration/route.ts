import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "public" } }
  );

  const results: string[] = [];

  // 1. Create ow_post_hire_reports table
  const { error: e1 } = await supabase.from("ow_post_hire_reports").select("id").limit(0);
  if (e1) {
    results.push("ow_post_hire_reports: needs creation - " + e1.message);
  } else {
    results.push("ow_post_hire_reports: already exists");
  }

  // 2. Check recruiter columns on ow_companies
  const { error: e2 } = await supabase.from("ow_companies").select("recruiter_name").limit(1);
  if (e2) {
    results.push("recruiter_name column: needs creation - " + e2.message);
  } else {
    results.push("recruiter_name column: already exists");
  }

  // 3. Check mentor columns
  const { data: mentors, error: e3 } = await supabase.from("mentors").select("success_count, total_sessions").limit(1);
  if (e3) {
    results.push("mentor columns: needs creation - " + e3.message);
  } else {
    results.push("mentor columns: already exist, data=" + JSON.stringify(mentors?.[0]));
  }

  const needsMigration = !!e1 || !!e2 || !!e3;

  return NextResponse.json({
    results,
    needsMigration,
    instruction: needsMigration
      ? "Please run supabase/migrations/013_post_hire_reports.sql in Supabase SQL Editor"
      : "All migrations applied",
  });
}
