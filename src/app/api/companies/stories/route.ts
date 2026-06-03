import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 300;

export async function GET() {
  const supabase = createClient();

  const { data: stories } = await supabase
    .from("ow_company_posts")
    .select("id, company_id, title, body, category, cover_image_url, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(6);

  // Get company names for the stories
  const companyIds = Array.from(new Set((stories ?? []).map((s) => s.company_id)));
  const companyMap: Record<string, { name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null }> = {};

  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("ow_companies")
      .select("id, name, logo_letter, logo_gradient, logo_url")
      .in("id", companyIds);
    for (const c of companies ?? []) {
      companyMap[c.id] = {
        name: c.name,
        logo_letter: c.logo_letter,
        logo_gradient: c.logo_gradient,
        logo_url: c.logo_url,
      };
    }
  }

  const result = (stories ?? []).map((s) => ({
    id: s.id,
    companyId: s.company_id,
    companyName: companyMap[s.company_id]?.name ?? "企業",
    companyLogoLetter: companyMap[s.company_id]?.logo_letter ?? null,
    companyLogoGradient: companyMap[s.company_id]?.logo_gradient ?? null,
    companyLogoUrl: companyMap[s.company_id]?.logo_url ?? null,
    title: s.title,
    body: s.body,
    category: s.category,
    coverImageUrl: s.cover_image_url,
    publishedAt: s.published_at,
  }));

  return NextResponse.json({ stories: result });
}
