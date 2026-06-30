import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// 60秒キャッシュ（ISR的挙動）
export const revalidate = 60;

export async function GET() {
  try {
    const supabase = createClient();

    const [companiesRes, jobsRes] = await Promise.all([
      supabase
        .from("ow_companies")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true),
      supabase
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
    return NextResponse.json({ companies: 0, jobs: 0 });
  }
}
