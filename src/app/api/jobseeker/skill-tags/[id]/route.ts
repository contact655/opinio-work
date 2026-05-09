import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// DELETE /api/jobseeker/skill-tags/[id] — タグ削除
// RLS（ow_user_skill_tags_delete_own）が他人のタグへの操作を自動的に弾く
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ow_user_skill_tags")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/skill-tags/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // sort_order のリインデックスは行わない（歯抜け許容、ν-9 並び替えと衝突するため）
  return new NextResponse(null, { status: 204 });
}
