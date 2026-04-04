import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const { count, error } = await admin
    .from("ow_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ count: count || 0 });
}
