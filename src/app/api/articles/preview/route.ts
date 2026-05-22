import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/articles/preview — 最新3件の公開記事を返す（ホームページのプレビュー用）
export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("ow_articles")
    .select(
      "slug, type, title, eyecatch_gradient, read_min, published_at, company_name_text, company_initial_text, company_gradient_text"
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(3);

  if (error) {
    console.error("[GET /api/articles/preview]", error.message);
    return NextResponse.json({ articles: [] });
  }

  const articles = (data ?? []).map((row) => ({
    slug: row.slug as string,
    type: row.type as string,
    title: row.title as string,
    eyecatch_gradient: (row.eyecatch_gradient as string | null) ?? "linear-gradient(135deg, #002366, #3B5FD9)",
    read_min: (row.read_min as number) ?? 5,
    date: row.published_at ? (row.published_at as string).slice(0, 10) : "",
    company_name: (row.company_name_text as string) ?? "",
    company_initial: (row.company_initial_text as string) ?? "",
    company_gradient: (row.company_gradient_text as string) ?? "linear-gradient(135deg, #002366, #3B5FD9)",
  }));

  return NextResponse.json({ articles });
}
