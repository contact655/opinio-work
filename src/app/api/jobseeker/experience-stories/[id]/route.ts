import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PUT /api/jobseeker/experience-stories/[id]
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

  const imageUrl    = typeof body.image_url    === "string" ? body.image_url.trim()    : null;
  const videoUrl    = typeof body.video_url    === "string" ? body.video_url.trim()    : null;
  const linkUrl     = typeof body.link_url     === "string" ? body.link_url.trim()     : null;
  const title       = typeof body.title        === "string" ? body.title.trim()        : null;
  const description = typeof body.description  === "string" ? body.description.trim()  : null;

  // type 別の必須フィールドチェック
  if (type === "image" && !imageUrl) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELD", message: "image タイプには image_url が必要です。" },
      { status: 400 }
    );
  }
  if (type === "video") {
    if (!videoUrl || !(/youtube\.com|youtu\.be/).test(videoUrl)) {
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

  const periodStart = typeof body.period_start === "string" && body.period_start ? body.period_start : null;
  const periodEnd   = typeof body.period_end   === "string" && body.period_end   ? body.period_end   : null;

  // RLS (update_own) が ownership チェックを担う
  const { data: updated, error } = await supabase
    .from("ow_experience_stories")
    .update({
      type,
      title:        title || null,
      description:  description || null,
      image_url:    imageUrl || null,
      video_url:    videoUrl || null,
      link_url:     linkUrl || null,
      period_start: periodStart,
      period_end:   periodEnd,
    })
    .eq("id", params.id)
    .select("id, experience_id, type, title, description, image_url, video_url, link_url, period_start, period_end, sort_order")
    .single();

  if (error) {
    console.error("[PUT /api/jobseeker/experience-stories/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/jobseeker/experience-stories/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ow_experience_stories")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/experience-stories/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
