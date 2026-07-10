import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertAdmin(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  return !!isAdmin;
}

// PATCH: is_approved を更新（承認 or 承認取消）
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (!await assertAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const admin = createAdminClient();

  const { data: report } = await admin
    .from("ow_salary_reports")
    .select("company_id")
    .eq("id", params.id)
    .single();
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await admin
    .from("ow_salary_reports")
    .update({ is_approved: body.is_approved })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath(`/companies/${report.company_id}`);
  return NextResponse.json({ ok: true });
}

// DELETE: 却下（物理削除）
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (!await assertAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: report } = await admin
    .from("ow_salary_reports")
    .select("company_id")
    .eq("id", params.id)
    .single();

  const { error } = await admin.from("ow_salary_reports").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (report) revalidatePath(`/companies/${report.company_id}`);
  return NextResponse.json({ ok: true });
}
