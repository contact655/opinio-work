import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// auth_id → ow_users.id（他の jobseeker ルートと同じパターン）
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

// GET /api/jobseeker/experience-stories
// ?experience_id=xxx でフィルタ可。なければ自分の全 experiences の stories を返す。
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ stories: [] });

  const url = new URL(request.url);
  const experienceId = url.searchParams.get("experience_id");

  // experience_id 経由で ownership を確認しながら取得
  let query = supabase
    .from("ow_experience_stories")
    .select("id, experience_id, section_id, type, title, description, image_url, video_url, link_url, og_image_url, og_title, period_start, period_end, sort_order, created_at, ow_experiences!inner(user_id)")
    .eq("ow_experiences.user_id", owUserId)
    .order("sort_order", { ascending: true });

  if (experienceId) {
    query = query.eq("experience_id", experienceId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[GET /api/jobseeker/experience-stories]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ow_experiences の join フィールドを除去して返す
  const stories = (data ?? []).map(({ ow_experiences: _drop, ...rest }) => rest);
  return NextResponse.json({ stories });
}

// POST /api/jobseeker/experience-stories
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

  // experience_id 必須
  const experienceId = typeof body.experience_id === "string" ? body.experience_id : null;
  if (!experienceId) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELD", message: "experience_id は必須です。" },
      { status: 400 }
    );
  }

  // type 必須
  const VALID_TYPES = ["image", "card", "video", "link"] as const;
  const type = typeof body.type === "string" && (VALID_TYPES as readonly string[]).includes(body.type)
    ? body.type
    : null;
  if (!type) {
    return NextResponse.json(
      { error: "INVALID_TYPE", message: "type は image / card / video / link のいずれかです。" },
      { status: 400 }
    );
  }

  // type 別の必須フィールドチェック
  const imageUrl    = typeof body.image_url  === "string" ? body.image_url.trim()  : null;
  const videoUrl    = typeof body.video_url  === "string" ? body.video_url.trim()  : null;
  const linkUrl     = typeof body.link_url   === "string" ? body.link_url.trim()   : null;
  const title       = typeof body.title      === "string" ? body.title.trim()       : null;
  const description = typeof body.description === "string" ? body.description.trim() : null;

  if (type === "image" && !imageUrl) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELD", message: "image タイプには image_url が必要です。" },
      { status: 400 }
    );
  }
  if (type === "video") {
    let validYoutube = false;
    try {
      const parsed = new URL(videoUrl ?? "");
      validYoutube = parsed.hostname === "www.youtube.com" || parsed.hostname === "youtube.com" || parsed.hostname === "youtu.be";
    } catch { /* invalid URL */ }
    if (!videoUrl || !validYoutube) {
      return NextResponse.json(
        { error: "INVALID_URL_FORMAT", message: "video タイプには YouTube URL が必要です。" },
        { status: 400 }
      );
    }
  }
  if (type === "link" && !linkUrl) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELD", message: "link タイプには link_url が必要です。" },
      { status: 400 }
    );
  }
  if (type === "card" && !title && !description) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELD", message: "card タイプには title または description が必要です。" },
      { status: 400 }
    );
  }

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ownership 確認: experience_id が自分のものか
  const { data: ownExp } = await supabase
    .from("ow_experiences")
    .select("id")
    .eq("id", experienceId)
    .eq("user_id", owUserId)
    .maybeSingle();
  if (!ownExp) {
    return NextResponse.json(
      { error: "EXPERIENCE_NOT_FOUND", message: "指定した experience_id が見つかりません。" },
      { status: 404 }
    );
  }

  // sort_order: MAX + 1
  const { data: maxRow } = await supabase
    .from("ow_experience_stories")
    .select("sort_order")
    .eq("experience_id", experienceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const periodStart = typeof body.period_start === "string" && body.period_start ? body.period_start : null;
  const periodEnd   = typeof body.period_end   === "string" && body.period_end   ? body.period_end   : null;
  // section_id: 任意。null = 未分類エリアに表示。
  // WITH CHECK(RLS)が「自分の experience に属するセクション ID のみ」を保証するため、
  // API 層での追加検証は不要。
  const sectionId = typeof body.section_id === "string" ? body.section_id : null;
  // og_image_url / og_title: link type のみ実質使用。https:// URLのみ許可。
  let ogImageUrl: string | null = null;
  if (typeof body.og_image_url === "string" && body.og_image_url) {
    try { if (new URL(body.og_image_url).protocol === "https:") ogImageUrl = body.og_image_url.slice(0, 2048); } catch { /* ignore */ }
  }
  const ogTitle    = typeof body.og_title     === "string" ? body.og_title     : null;

  const { data: inserted, error: insertError } = await supabase
    .from("ow_experience_stories")
    .insert({
      experience_id: experienceId,
      section_id:   sectionId || null,
      type,
      title:        title || null,
      description:  description || null,
      image_url:    imageUrl || null,
      video_url:    videoUrl || null,
      link_url:     linkUrl || null,
      og_image_url: ogImageUrl || null,
      og_title:     ogTitle || null,
      period_start: periodStart,
      period_end:   periodEnd,
      sort_order:   nextSortOrder,
    })
    .select("id, experience_id, section_id, type, title, description, image_url, video_url, link_url, og_image_url, og_title, period_start, period_end, sort_order")
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/experience-stories]", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
