import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PUT /api/jobseeker/experience-story-sections/[id]
// セクション名を更新。ownership は DB の RLS(ow_story_sections_update_own)が保証。
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (!name) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELD", message: "name は必須です。" },
      { status: 400 }
    );
  }
  if (name.length > 50) {
    return NextResponse.json(
      { error: "INVALID_LENGTH", message: "name は 50 文字以内にしてください。" },
      { status: 400 }
    );
  }

  // RLS(ow_story_sections_update_own)が ownership を保証する
  const { data: updated, error } = await supabase
    .from("ow_story_sections")
    .update({ name })
    .eq("id", params.id)
    .select("id, experience_id, name, sort_order, created_at")
    .single();

  if (error) {
    console.error("[PUT /api/jobseeker/experience-story-sections/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/jobseeker/experience-story-sections/[id]
// セクション削除。配下の stories は ON DELETE SET NULL により section_id=NULL(未分類)へ移動。
// ownership は DB の RLS(ow_story_sections_delete_own)が保証。
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ow_story_sections")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/experience-story-sections/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 204 No Content: stories の section_id は DB 側で ON DELETE SET NULL により自動的に NULL になる
  return new NextResponse(null, { status: 204 });
}
