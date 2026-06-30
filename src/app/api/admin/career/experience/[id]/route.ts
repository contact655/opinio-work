import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const {
    salaryMan,
    roleTitle,
    companyAnonymized,
    visibilityCompany,
    visibilitySalary,
    visibilityReason,
    description,
    joinReason,
    learnings,
    turningPoint,
    exitReason,
  } = body;

  const admin = createAdminClient();

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  function s(v: unknown, max: number) { return typeof v === "string" ? v.slice(0, max) : v; }

  if (salaryMan !== undefined) {
    const n = Number(salaryMan);
    if (!Number.isInteger(n) || n < 0 || n > 100_000_000) {
      return NextResponse.json({ error: "Invalid salaryMan value" }, { status: 400 });
    }
    update.salary_man = n;
  }
  if (roleTitle          !== undefined) update.role_title         = s(roleTitle, 100);
  if (companyAnonymized  !== undefined) update.company_anonymized = s(companyAnonymized, 200);
  if (visibilityCompany  !== undefined) {
    if (!["real", "masked", "hidden"].includes(visibilityCompany)) {
      return NextResponse.json({ error: "Invalid visibilityCompany value" }, { status: 400 });
    }
    update.visibility_company = visibilityCompany;
  }
  if (visibilitySalary !== undefined) {
    if (typeof visibilitySalary !== "boolean") {
      return NextResponse.json({ error: "Invalid visibilitySalary value" }, { status: 400 });
    }
    update.visibility_salary = visibilitySalary;
  }
  if (visibilityReason !== undefined) {
    if (typeof visibilityReason !== "boolean") {
      return NextResponse.json({ error: "Invalid visibilityReason value" }, { status: 400 });
    }
    update.visibility_reason = visibilityReason;
  }
  if (description        !== undefined) update.description        = s(description, 5000);
  if (joinReason         !== undefined) update.join_reason        = s(joinReason, 5000);
  if (learnings          !== undefined) update.learnings          = s(learnings, 5000);
  if (turningPoint       !== undefined) update.turning_point      = s(turningPoint, 5000);
  if (exitReason         !== undefined) update.exit_reason        = s(exitReason, 5000);

  const { error } = await admin
    .from("ow_experiences")
    .update(update)
    .eq("id", params.id);

  if (error) {
    console.error("experience update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
