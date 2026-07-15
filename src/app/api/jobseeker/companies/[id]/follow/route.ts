import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function resolveOwUserId(supabase: ReturnType<typeof createClient>, authUid: string): Promise<string | null> {
  const { data } = await supabase.from("ow_users").select("id").eq("auth_id", authUid).maybeSingle();
  return data?.id ?? null;
}

// POST /api/jobseeker/companies/[id]/follow — フォロー
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("ow_company_follows")
    .insert({ follower_user_id: owUserId, company_id: params.id })
    .select("id");
  // 24805 = unique violation → already followed, treat as success
  if (error && error.code !== "23505") {
    console.error("[follow POST]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ followed: true }, { status: 200 });
}

// DELETE /api/jobseeker/companies/[id]/follow — フォロー解除
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("ow_company_follows")
    .delete()
    .eq("follower_user_id", owUserId)
    .eq("company_id", params.id);

  if (error) {
    console.error("[follow DELETE]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ followed: false }, { status: 200 });
}
