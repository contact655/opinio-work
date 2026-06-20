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
    turningPoint,
    exitReason,
  } = body;

  const admin = createAdminClient();

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (salaryMan          !== undefined) update.salary_man         = salaryMan;
  if (roleTitle          !== undefined) update.role_title         = roleTitle;
  if (companyAnonymized  !== undefined) update.company_anonymized = companyAnonymized;
  if (visibilityCompany  !== undefined) update.visibility_company = visibilityCompany;
  if (visibilitySalary   !== undefined) update.visibility_salary  = visibilitySalary;
  if (visibilityReason   !== undefined) update.visibility_reason  = visibilityReason;
  if (description        !== undefined) update.description        = description;
  if (joinReason         !== undefined) update.join_reason        = joinReason;
  if (turningPoint       !== undefined) update.turning_point      = turningPoint;
  if (exitReason         !== undefined) update.exit_reason        = exitReason;

  const { error } = await admin
    .from("ow_experiences")
    .update(update)
    .eq("id", params.id);

  if (error) {
    console.error("experience update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
