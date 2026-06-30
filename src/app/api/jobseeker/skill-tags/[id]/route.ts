import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/jobseeker/skill-tags/[id] — タグのカテゴリ等を更新
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { category?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if ("category" in body) {
    updates.category = (body.category as string | null) ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("ow_user_skill_tags")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", owUser.id)
    .select("id, label, category, sort_order")
    .single();

  if (error) {
    console.error("[PATCH /api/jobseeker/skill-tags/[id]]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/jobseeker/skill-tags/[id] — タグ削除
// RLS（ow_user_skill_tags_delete_own）が他人のタグへの操作を自動的に弾く
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await supabase
    .from("ow_user_skill_tags")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUser.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/skill-tags/[id]]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // sort_order のリインデックスは行わない（歯抜け許容、ν-9 並び替えと衝突するため）
  return new NextResponse(null, { status: 204 });
}
