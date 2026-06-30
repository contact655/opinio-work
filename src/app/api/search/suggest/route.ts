import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);

  if (!q || q.length < 1) {
    return NextResponse.json({ companies: [], jobs: [] });
  }

  const supabase = createClient();
  // PostgREST injection 対策: .or() 文字列に埋め込む前にメタ文字を除去
  const safeQ = q.replace(/[(),%]/g, "");
  const pattern = `%${safeQ}%`;

  const [
    { data: companies },
    { data: jobs },
  ] = await Promise.all([
    supabase
      .from("ow_companies")
      .select("id, name, industry, logo_letter, logo_gradient")
      .ilike("name", pattern)
      .eq("is_published", true)
      .limit(4),
    supabase
      .from("ow_jobs")
      .select("id, title, job_category")
      .or(`title.ilike.${pattern},job_category.ilike.${pattern}`)
      .in("status", ["published", "active"])
      .limit(4),
  ]);

  return NextResponse.json({
    companies: companies ?? [],
    jobs: jobs ?? [],
  });
}
