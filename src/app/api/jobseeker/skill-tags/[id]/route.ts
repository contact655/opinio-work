import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

// PATCH /api/jobseeker/skill-tags/[id] — タグのカテゴリ等を更新
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  return NextResponse.json({ error: "No fields to update" }, { status: 400 });
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
