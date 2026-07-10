import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_companies")
    .select("id, name, industry, phase, employee_count, logo_gradient, logo_letter, logo_url, accepting_casual_meetings, remote_work_status, avg_salary")
    .eq("is_published", true)
    .order("name", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[swipe-list] Supabase error:", error);
    return NextResponse.json([], { status: 200 });
  }
  console.log("[swipe-list] returned", (data ?? []).length, "companies");
  return NextResponse.json(data ?? []);
}
