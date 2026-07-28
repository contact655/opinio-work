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

  function parseNum(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 99999999 ? Math.floor(n) : null;
  }

  const patch: {
    job_type?: string | null;
    experience_years?: string | null;
    desired_work_style?: string | null;
    desired_salary_min?: number | null;
    desired_salary_max?: number | null;
    transfer_timing?: string | null;
    desired_phase?: string[] | null;
    worry?: string | null;
    updated_at?: string | null;
  } = {};

  if ("job_type" in body) patch.job_type = typeof body.job_type === "string" ? body.job_type.slice(0, 200) : null;
  if ("experience_years" in body) {
    const n = parseNum(body.experience_years);
    patch.experience_years = n !== null ? String(n) : null;
  }
  if ("desired_work_style" in body) patch.desired_work_style = typeof body.desired_work_style === "string" ? body.desired_work_style.slice(0, 200) : null;
  if ("desired_salary_min" in body) patch.desired_salary_min = parseNum(body.desired_salary_min);
  if ("desired_salary_max" in body) patch.desired_salary_max = parseNum(body.desired_salary_max);
  if ("transfer_timing" in body) patch.transfer_timing = typeof body.transfer_timing === "string" ? body.transfer_timing.slice(0, 200) : null;
  if ("desired_phase" in body) patch.desired_phase = Array.isArray(body.desired_phase) ? (body.desired_phase as unknown[]).filter((v): v is string => typeof v === "string").slice(0, 20) : null;
  if ("worry" in body) patch.worry = typeof body.worry === "string" ? body.worry.slice(0, 200) : null;

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
