import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PUT /api/jobseeker/career-preferences — 求職者の希望条件を ow_profiles に保存
export async function PUT(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = [
    "job_type",
    "experience_years",
    "desired_work_style",
    "desired_salary_min",
    "desired_salary_max",
    "transfer_timing",
    "desired_phase",
    "worry",
  ];

  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  // ow_profiles は user_id で照合（auth.users.id ではなく ow_users.id を介する必要がある）
  // onboarding では user_id = auth.users.id で insert している場合と
  // ow_users.id を使う場合がある → 両方試みる（upsert）
  const { data: existing } = await supabase
    .from("ow_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("ow_profiles")
      .update(patch)
      .eq("user_id", user.id);

    if (error) {
      console.error("[PUT /api/jobseeker/career-preferences] update", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // ow_users.id を介するケース
    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!owUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: owExisting } = await supabase
      .from("ow_profiles")
      .select("id")
      .eq("user_id", owUser.id)
      .maybeSingle();

    if (owExisting) {
      await supabase
        .from("ow_profiles")
        .update(patch)
        .eq("user_id", owUser.id);
    } else {
      await supabase
        .from("ow_profiles")
        .insert({ user_id: owUser.id, ...patch, onboarding_completed: false });
    }
  }

  return NextResponse.json({ success: true });
}
