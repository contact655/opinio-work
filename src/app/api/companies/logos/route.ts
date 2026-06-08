import { createPublicClient } from "@/lib/supabase/public";
import { NextResponse } from "next/server";

export const revalidate = 300; // 5分キャッシュ

/**
 * GET /api/companies/logos
 * ロゴウォール用全企業一覧（軽量）
 * - id, name, logo_url, logo_letter, logo_gradient のみ返す
 * - is_published = true の企業のみ
 */
export async function GET() {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("ow_companies")
    .select("id, name, logo_url, logo_letter, logo_gradient")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ companies: [] });

  const companies = (data ?? [])
    .filter((row) => row.id && row.name)  // 空要素を除去
    .map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      logoUrl: (row.logo_url as string | null) ?? null,
      letter: (row.logo_letter as string | null) ?? ((row.name as string)?.charAt(0) ?? "?"),
      gradient: (row.logo_gradient as string | null) ?? "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
    }));

  return NextResponse.json({ companies });
}
