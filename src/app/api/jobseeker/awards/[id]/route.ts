import { createClient } from "@/lib/supabase/server";
import { optionalText } from "@/lib/api/normalize";
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

// PUT /api/jobseeker/awards/[id]
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

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

  const issuer      = optionalText(body.issuer, 100);
  const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/;
  const awardedAt   = typeof body.awarded_at  === "string" && DATE_RE.test(body.awarded_at) ? body.awarded_at : null;
  const description = optionalText(body.description, 1000);

  const { data: updated, error } = await supabase
    .from("ow_user_awards")
    .update({ title, issuer, awarded_at: awardedAt, description })
    .eq("id", params.id)
    .eq("user_id", owUserId)
    .select("id, title, issuer, awarded_at, description, sort_order")
    .single();

  if (error) {
    console.error("[PUT /api/jobseeker/awards/[id]]", error.code);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/jobseeker/awards/[id]
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
    .from("ow_user_awards")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUserId);

  if (error) {
    console.error("[DELETE /api/jobseeker/awards/[id]]", error.code);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
