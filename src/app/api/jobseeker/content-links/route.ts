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

// GET /api/jobseeker/content-links — 自分の発信コンテンツリンク一覧
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ links: [] });

  const { data, error } = await supabase
    .from("ow_user_content_links")
    .select("id, url, platform, title, description, thumbnail_url, sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[GET /api/jobseeker/content-links]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ links: data ?? [] });
}

// POST /api/jobseeker/content-links — 発信コンテンツリンク追加
export async function POST(req: Request) {
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
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "URLはhttps://で始まる必要があります" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "有効なURLを入力してください" }, { status: 400 });
  }

  /* ⚠️ 不正値を黙って "other" に倒さない（2026-08-07）。
     倒すと、クライアントの綴りが変わっても誰も気づかないまま
     全部 other になる。空・未指定だけ "other" を既定として使い、
     **入っていて不正なものは 400 で返す。** */
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
  const rawThumb = typeof body.thumbnail_url === "string" ? body.thumbnail_url.trim() : null;
  let thumbnail_url: string | null = null;
  if (rawThumb) {
    try {
      const p = new URL(rawThumb);
      if (p.protocol === "https:") thumbnail_url = rawThumb.slice(0, 2048);
    } catch { /* invalid URL — ignore */ }
  }

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // sort_order: MAX + 1
  const { data: maxRow } = await supabase
    .from("ow_user_content_links")
    .select("sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("ow_user_content_links")
    .insert({ user_id: owUserId, url, platform, title, description, thumbnail_url, sort_order: nextSortOrder })
    .select("id, url, platform, title, description, thumbnail_url, sort_order")
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/content-links]", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
