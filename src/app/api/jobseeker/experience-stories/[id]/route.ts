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
  // section_id: body に含まれているときのみ更新(省略時は既存値を維持)。
  //   null      → 未分類への移動(section_id = NULL)
  //   "uuid"    → 指定セクションへ移動
  //   省略      → 変更なし
  // RLS WITH CHECK(migration 094)が「他人のセクション ID への改ざん」を DB レベルで防止。
  const hasSectionId = "section_id" in body;
  const sectionId = hasSectionId
    ? (body.section_id === null ? null : typeof body.section_id === "string" ? body.section_id : undefined)
    : undefined;
  // og_image_url / og_title: link type のみ実質使用。undefined は null として保存。
  const ogImageUrl = typeof body.og_image_url === "string" ? body.og_image_url : null;
  const ogTitle    = typeof body.og_title     === "string" ? body.og_title     : null;

  // RLS (ow_experience_stories_update_own + WITH CHECK) が ownership を保証
  const updatePayload: Record<string, unknown> = {
    type,
    title:        title || null,
    description:  description || null,
    image_url:    imageUrl || null,
    video_url:    videoUrl || null,
    link_url:     linkUrl || null,
    og_image_url: ogImageUrl,
    og_title:     ogTitle,
    period_start: periodStart,
    period_end:   periodEnd,
  };
  // null(未分類移動)も string(セクション指定)も !== undefined が true → 同じ分岐で処理
  if (hasSectionId && sectionId !== undefined) {
    updatePayload.section_id = sectionId;
  }

  const { data: updated, error } = await supabase
    .from("ow_experience_stories")
    .update(updatePayload)
    .eq("id", params.id)
    .select("id, experience_id, section_id, type, title, description, image_url, video_url, link_url, og_image_url, og_title, period_start, period_end, sort_order")
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

  // Fetch image_url before delete so we can clean up Storage (best-effort)
  const { data: story } = await supabase
    .from("ow_experience_stories")
    .select("image_url")
    .eq("id", params.id)
    .maybeSingle();

  const { error } = await supabase
    .from("ow_experience_stories")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/experience-stories/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort Storage cleanup: remove the uploaded image if it lives in ow-uploads
  // Failure here is non-blocking (DB row is already deleted)
  const imageUrl = story?.image_url as string | null | undefined;
  if (imageUrl) {
    const match = imageUrl.match(/\/object\/public\/ow-uploads\/(.+)$/);
    if (match) {
      await supabase.storage
        .from("ow-uploads")
        .remove([decodeURIComponent(match[1])])
        .catch((e: unknown) => {
          console.warn("[DELETE story] Storage cleanup failed:", e);
        });
    }
  }

  return new NextResponse(null, { status: 204 });
}
