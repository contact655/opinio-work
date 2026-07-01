import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function resolveOwUserId(
  supabase: ReturnType<typeof createClient>,
  authUid: string
): Promise<string | null> {
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUid)
    .maybeSingle();
  return data?.id ?? null;
}

// PUT /api/jobseeker/media-appearances/[id]
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 1 || title.length > 200) {
    return NextResponse.json(
      { error: "INVALID_TITLE_LENGTH", message: "タイトルは1〜200字で入力してください。" },
      { status: 400 }
    );
  }

  const mediaName   = typeof body.media_name   === "string" ? body.media_name.trim().slice(0, 100) || null : null;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const appearedAtRaw = typeof body.appeared_at === "string" ? body.appeared_at : null;
  const appearedAt = appearedAtRaw && DATE_RE.test(appearedAtRaw) ? appearedAtRaw : null;
  const description = typeof body.description  === "string" ? body.description.trim().slice(0, 1000) || null : null;

  const url = typeof body.url === "string" ? body.url.trim().slice(0, 2048) || null : null;
  if (url && !/^https:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "INVALID_URL_FORMAT", message: "URL は https:// で始めてください。" },
      { status: 400 }
    );
  }
  const thumbnailUrl = typeof body.thumbnail_url === "string" ? body.thumbnail_url.trim() || null : null;
  if (thumbnailUrl && !/^https:\/\//i.test(thumbnailUrl)) {
    return NextResponse.json(
      { error: "INVALID_URL_FORMAT", message: "サムネ URL は https:// で始めてください。" },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from("ow_user_media_appearances")
    .update({ title, media_name: mediaName, url, thumbnail_url: thumbnailUrl, appeared_at: appearedAt, description })
    .eq("id", params.id)
    .eq("user_id", owUserId)
    .select("id, title, media_name, url, thumbnail_url, appeared_at, description, sort_order")
    .single();

  if (error) {
    console.error("[PUT /api/jobseeker/media-appearances/[id]]", error.code);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/jobseeker/media-appearances/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ow_user_media_appearances")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUserId);

  if (error) {
    console.error("[DELETE /api/jobseeker/media-appearances/[id]]", error.code);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
