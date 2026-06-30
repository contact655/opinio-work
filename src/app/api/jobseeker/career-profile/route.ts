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

// GET /api/jobseeker/career-profile — キャリアプロフィールを返す（なければ null）
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ careerProfile: null });

  const { data, error } = await supabase
    .from("ow_career_profiles")
    .select("user_id, is_published, headline, years_of_experience, gender, birth_year")
    .eq("user_id", owUserId)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/jobseeker/career-profile]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ careerProfile: data ?? null });
}

// PUT /api/jobseeker/career-profile — UPSERT（なければ作成）
export async function PUT(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const payload: Record<string, unknown> = {
    user_id: owUserId,
  };

  if (typeof body.is_published === "boolean") payload.is_published = body.is_published;
  if (typeof body.headline === "string") payload.headline = body.headline || null;
  if (typeof body.years_of_experience === "number") payload.years_of_experience = body.years_of_experience;
  if (body.years_of_experience === null) payload.years_of_experience = null;

  const { error } = await supabase
    .from("ow_career_profiles")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("[PUT /api/jobseeker/career-profile]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
