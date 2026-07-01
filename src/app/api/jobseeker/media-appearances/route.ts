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

// GET /api/jobseeker/media-appearances
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ mediaAppearances: [] });

  const { data, error } = await supabase
    .from("ow_user_media_appearances")
    .select("id, title, media_name, url, thumbnail_url, appeared_at, description, sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[GET /api/jobseeker/media-appearances]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ mediaAppearances: data ?? [] });
}

// POST /api/jobseeker/media-appearances
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const mediaName    = typeof body.media_name    === "string" ? body.media_name.trim().slice(0, 100) || null : null;
  const description  = typeof body.description   === "string" ? body.description.trim().slice(0, 1000) || null : null;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const appearedAtRaw = typeof body.appeared_at === "string" ? body.appeared_at : null;
  const appearedAt = appearedAtRaw && DATE_RE.test(appearedAtRaw) ? appearedAtRaw : null;

  // URL バリデーション: 指定された場合は https:// で始まること
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

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: maxRow } = await supabase
    .from("ow_user_media_appearances")
    .select("sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("ow_user_media_appearances")
    .insert({ user_id: owUserId, title, media_name: mediaName, url, thumbnail_url: thumbnailUrl, appeared_at: appearedAt, description, sort_order: nextSortOrder })
    .select("id, title, media_name, url, thumbnail_url, appeared_at, description, sort_order")
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/media-appearances]", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
