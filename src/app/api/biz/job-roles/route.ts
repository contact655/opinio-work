import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/business/dashboard";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_company_job_roles")
    .select("id, name, standard_role_id, display_order")
    .eq("company_id", ctx.tenantId)
    .is("deleted_at", null)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobRoles: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, standard_role_id, display_order } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "職種名を入力してください" }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("ow_company_job_roles")
    .insert({
      company_id: ctx.tenantId,
      name: name.trim(),
      standard_role_id: standard_role_id ?? null,
      display_order: display_order ?? 0,
    })
    .select("id, name, standard_role_id, display_order")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同じ職種名がすでに存在します" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ jobRole: data });
}
