import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "3", 10), 50);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_mentors")
    .select("id, name, avatar_initial, avatar_color, photo_url, current_company, current_role, current_career, previous_career, question_tags, roles, catchphrase, success_count, is_available")
    .eq("is_available", true)
    .order("display_order", { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ mentors: [] });

  const mentors = (data ?? []).map((row: any) => {
    const name = row.name ?? "";
    const hex = row.avatar_color as string | null;
    const gradient = hex
      ? `linear-gradient(135deg, ${hex}99, ${hex})`
      : "linear-gradient(135deg, #002366, #3B5FD9)";

    // career path: "前職 → 現職" 形式
    const parts: string[] = [];
    if (row.previous_career) parts.push(row.previous_career);
    if (row.current_career) parts.push(row.current_career);
    const path = parts.join(" → ");

    return {
      id: row.id,
      name,
      initial: row.avatar_initial ?? name.charAt(0),
      gradient,
      currentCompany: row.current_company ?? "",
      currentRole: row.current_role ?? "",
      path: path || row.current_role || "",
      tags: (row.question_tags as string[] | null)?.slice(0, 3) ?? [],
      roles: (row.roles as string[] | null) ?? [],
      catchphrase: (row.catchphrase as string | null) ?? null,
      photoUrl: (row.photo_url as string | null) ?? null,
      successCount: row.success_count ?? 0,
      isAvailable: row.is_available ?? true,
    };
  });

  return NextResponse.json({ mentors });
}
