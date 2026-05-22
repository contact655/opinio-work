import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ companies: [], jobs: [], mentors: [] });
  }

  const supabase = createClient();
  const pattern = `%${q}%`;

  const [
    { data: companies },
    { data: jobs },
    { data: mentors },
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
    supabase
      .from("ow_mentors")
      .select("id, name, current_role, current_company")
      .or(`name.ilike.${pattern},current_role.ilike.${pattern},current_company.ilike.${pattern}`)
      .eq("is_available", true)
      .limit(3),
  ]);

  return NextResponse.json({
    companies: companies ?? [],
    jobs: jobs ?? [],
    mentors: mentors ?? [],
  });
}
