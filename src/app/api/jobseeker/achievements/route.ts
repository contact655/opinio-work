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

// GET /api/jobseeker/achievements
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ achievements: [] });

  const { data, error } = await supabase
    .from("ow_user_achievements")
    .select("id, title, value, unit, description, period_start, period_end, sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[GET /api/jobseeker/achievements]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ achievements: data ?? [] });
}

// POST /api/jobseeker/achievements
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
  if (title.length < 1 || title.length > 100) {
    return NextResponse.json(
      { error: "INVALID_TITLE_LENGTH", message: "タイトルは1〜100字で入力してください。" },
      { status: 400 }
    );
  }

  const value = typeof body.value === "number" && Number.isInteger(body.value) ? body.value : null;
  const unit  = typeof body.unit  === "string" ? body.unit.trim().slice(0, 20) || null : null;
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const periodStart = typeof body.period_start === "string" && body.period_start ? body.period_start : null;
  const periodEnd   = typeof body.period_end   === "string" && body.period_end   ? body.period_end   : null;

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: maxRow } = await supabase
    .from("ow_user_achievements")
    .select("sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("ow_user_achievements")
    .insert({ user_id: owUserId, title, value, unit, description, period_start: periodStart, period_end: periodEnd, sort_order: nextSortOrder })
    .select("id, title, value, unit, description, period_start, period_end, sort_order")
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/achievements]", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
