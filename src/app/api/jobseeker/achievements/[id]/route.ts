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

// PUT /api/jobseeker/achievements/[id]
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 1 || title.length > 100) {
    return NextResponse.json(
      { error: "INVALID_TITLE_LENGTH", message: "タイトルは1〜100字で入力してください。" },
      { status: 400 }
    );
  }

  const value       = typeof body.value       === "number" && Number.isInteger(body.value) ? body.value : null;
  const unit        = typeof body.unit        === "string" ? body.unit.trim().slice(0, 20) || null : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) || null : null;
  const periodStart = typeof body.period_start === "string" && body.period_start ? body.period_start : null;
  const periodEnd   = typeof body.period_end   === "string" && body.period_end   ? body.period_end   : null;

  const { data: updated, error } = await supabase
    .from("ow_user_achievements")
    .update({ title, value, unit, description, period_start: periodStart, period_end: periodEnd })
    .eq("id", params.id)
    .eq("user_id", owUserId)
    .select("id, title, value, unit, description, period_start, period_end, sort_order")
    .maybeSingle();

  if (error) {
    console.error("[PUT /api/jobseeker/achievements/[id]]");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

// DELETE /api/jobseeker/achievements/[id]
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
    .from("ow_user_achievements")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUserId);

  if (error) {
    console.error("[DELETE /api/jobseeker/achievements/[id]]");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
