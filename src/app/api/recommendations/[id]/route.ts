import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function resolveOwUserId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  return data?.id ?? null;
}

// DELETE /api/recommendations/[id] — オーナーが削除
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const owUserId = await resolveOwUserId(supabase);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ow_user_recommendations")
    .delete()
    .eq("id", params.id)
    .eq("target_user_id", owUserId);

  if (error) return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/recommendations/[id] — is_visible トグル（オーナーのみ）
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const owUserId = await resolveOwUserId(supabase);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { is_visible } = body;
  if (typeof is_visible !== "boolean") {
    return NextResponse.json({ error: "is_visible must be boolean" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ow_user_recommendations")
    .update({ is_visible })
    .eq("id", params.id)
    .eq("target_user_id", owUserId);

  if (error) return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
