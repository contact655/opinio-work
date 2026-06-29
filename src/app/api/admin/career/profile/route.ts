import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // ── Auth: admin のみ ──
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { userId, headline, yearsOfExperience, gender, birthYear, isPublished } = body;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: "userId must be a valid UUID" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ow_career_profiles を UPSERT（user_id は UNIQUE）
  const { data, error } = await admin
    .from("ow_career_profiles")
    .upsert(
      {
        user_id: userId,
        headline: headline ?? null,
        years_of_experience: yearsOfExperience ?? null,
        gender: gender ?? null,
        birth_year: birthYear ?? null,
        is_published: isPublished ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("id")
    .single();

  if (error) {
    console.error("career profile upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
