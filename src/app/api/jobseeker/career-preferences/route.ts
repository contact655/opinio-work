import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PUT /api/jobseeker/career-preferences — 求職者の希望条件を ow_profiles に保存
// 注意: ow_profiles.user_id = auth.users.id（onboarding の insert パターンに合わせる）
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

  // ow_profiles.user_id = auth.users.id（onboarding が user.id で insert するパターン）
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
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  } else {
    // レコードがない場合は新規作成（auth.users.id を user_id として使う）
    const { error } = await supabase
      .from("ow_profiles")
      .insert({ user_id: user.id, ...patch, onboarding_completed: false });

    if (error) {
      console.error("[PUT /api/jobseeker/career-preferences] insert", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
