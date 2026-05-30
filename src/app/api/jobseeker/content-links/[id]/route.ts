import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PUT /api/jobseeker/content-links/[id] — 発信コンテンツリンク更新
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { url?: unknown; platform?: unknown; title?: unknown; description?: unknown; thumbnail_url?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || url.length > 2048) {
    return NextResponse.json({ error: "INVALID_URL", message: "URLを入力してください（2048字以内）" }, { status: 400 });
  }

  const VALID_PLATFORMS = ["youtube", "note", "zenn", "speakerdeck", "podcast", "github", "other"] as const;
  const platform = typeof body.platform === "string" && (VALID_PLATFORMS as readonly string[]).includes(body.platform)
    ? body.platform : "other";

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : null;
  const thumbnail_url = typeof body.thumbnail_url === "string" ? body.thumbnail_url.trim() : null;

  // RLS が他人のレコード更新を自動的に弾く
  const { data: updated, error } = await supabase
    .from("ow_user_content_links")
    .update({ url, platform, title, description, thumbnail_url })
    .eq("id", params.id)
    .select("id, url, platform, title, description, thumbnail_url, sort_order")
    .single();

  if (error) {
    console.error("[PUT /api/jobseeker/content-links/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/jobseeker/content-links/[id] — 発信コンテンツリンク削除
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ow_user_content_links")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/content-links/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
