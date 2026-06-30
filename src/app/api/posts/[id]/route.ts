import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/posts/[id] — 投稿削除（オーナーのみ）
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // RLS が自動でオーナー確認するが、念のため確認
  const { error } = await supabase
    .from("ow_posts")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUser.id);

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
