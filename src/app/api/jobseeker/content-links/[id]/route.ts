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

// PUT /api/jobseeker/content-links/[id] — 発信コンテンツリンク更新
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: { url?: unknown; platform?: unknown; title?: unknown; description?: unknown; thumbnail_url?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || url.length > 2048) {
    return NextResponse.json({ error: "INVALID_URL", message: "URLを入力してください（2048字以内）" }, { status: 400 });
  }
  // Protocol validation
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "INVALID_URL", message: "https:// URLを入力してください" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "INVALID_URL", message: "有効なURLを入力してください" }, { status: 400 });
  }

  /* ⚠️ POST 側（../route.ts）と同じ扱い。不正値は 400。黙って "other" に倒さない */
  const VALID_PLATFORMS = ["youtube", "note", "zenn", "speakerdeck", "podcast", "github", "other"] as const;
  let platform = "other";
  if (body.platform !== undefined && body.platform !== null && body.platform !== "") {
    if (typeof body.platform !== "string" || !(VALID_PLATFORMS as readonly string[]).includes(body.platform)) {
      return NextResponse.json(
        { error: "INVALID_PLATFORM", message: `platform は次のいずれかです: ${VALID_PLATFORMS.join(" / ")}` },
        { status: 400 }
      );
    }
    platform = body.platform;
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : null;
  let thumbnail_url: string | null = null;
  if (typeof body.thumbnail_url === "string" && body.thumbnail_url) {
    try { if (new URL(body.thumbnail_url).protocol === "https:") thumbnail_url = body.thumbnail_url.trim().slice(0, 2048); } catch { /* ignore */ }
  }

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: updated, error } = await supabase
    .from("ow_user_content_links")
    .update({ url, platform, title, description, thumbnail_url })
    .eq("id", params.id)
    .eq("user_id", owUserId)
    .select("id, url, platform, title, description, thumbnail_url, sort_order")
    .maybeSingle();

  if (error) {
    console.error("[PUT /api/jobseeker/content-links/[id]]");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await supabase
    .from("ow_user_content_links")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUserId);

  if (error) {
    console.error("[DELETE /api/jobseeker/content-links/[id]]");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
