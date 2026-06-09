import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// 60秒キャッシュ（ISR的挙動）
export const revalidate = 60;

export async function GET() {
  try {
    const admin = createAdminClient();

    const [companiesRes, jobsRes] = await Promise.all([
      admin
        .from("ow_companies")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true),
      admin
        .from("ow_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["published", "active"]),
    ]);

    return NextResponse.json(
      {
        companies: companiesRes.count ?? 0,
        jobs: jobsRes.count ?? 0,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    // フォールバック
    return NextResponse.json({ companies: 80, jobs: 31 });
  }
}
