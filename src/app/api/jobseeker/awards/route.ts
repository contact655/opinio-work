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

// GET /api/jobseeker/awards
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ awards: [] });

  const { data, error } = await supabase
    .from("ow_user_awards")
    .select("id, title, issuer, awarded_at, description, sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[GET /api/jobseeker/awards]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ awards: data ?? [] });
}

// POST /api/jobseeker/awards
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

  const issuer      = typeof body.issuer      === "string" ? body.issuer.trim().slice(0, 100) || null : null;
  const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/;
  const awardedAt   = typeof body.awarded_at  === "string" && DATE_RE.test(body.awarded_at) ? body.awarded_at : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) || null : null;

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: maxRow } = await supabase
    .from("ow_user_awards")
    .select("sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("ow_user_awards")
    .insert({ user_id: owUserId, title, issuer, awarded_at: awardedAt, description, sort_order: nextSortOrder })
    .select("id, title, issuer, awarded_at, description, sort_order")
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/awards]", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
