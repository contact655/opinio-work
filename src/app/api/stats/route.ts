import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// 60秒キャッシュ（ISR的挙動）
export const revalidate = 60;

export async function GET() {
  try {
    const admin = createAdminClient();

    const [companiesRes, jobsRes, mentorsRes] = await Promise.all([
      admin
        .from("ow_companies")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true),
      admin
        .from("ow_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["published", "active"]),
      admin
        .from("ow_mentors")
        .select("id", { count: "exact", head: true })
        .eq("is_available", true),
    ]);

    return NextResponse.json(
      {
        companies: companiesRes.count ?? 0,
        jobs: jobsRes.count ?? 0,
        mentors: mentorsRes.count ?? 0,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    // フォールバック
    return NextResponse.json({ companies: 13, jobs: 0, mentors: 13 });
  }
}
