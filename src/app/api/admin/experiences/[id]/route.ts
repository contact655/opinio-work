import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // admin チェック
  const admin = createAdminClient();
  const { data: owUser } = await admin
    .from("ow_users")
    .select("is_admin")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { company_id } = body as { company_id: string | null };

  const { error } = await admin
    .from("ow_experiences")
    .update({ company_id: company_id ?? null })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
