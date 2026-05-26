import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/companies/preview
 * 求職者向けトップページ「注目企業」セクション用（6件）
 */
export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("ow_companies")
    .select(
      "id, name, industry, phase, logo_gradient, logo_letter, logo_url, accepting_casual_meetings, employee_count"
    )
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(9);

  if (error) return NextResponse.json({ companies: [] });

  const companies = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    industry: row.industry as string | null,
    phase: row.phase as string | null,
    gradient: (row.logo_gradient as string | null) ?? "linear-gradient(135deg, #002366, #3B5FD9)",
    letter: (row.logo_letter as string | null) ?? ((row.name as string)?.charAt(0) ?? "?"),
    logoUrl: row.logo_url as string | null,
    acceptingMeeting: row.accepting_casual_meetings as boolean,
    employeeCount: row.employee_count as number | null,
  }));

  return NextResponse.json({ companies });
}
