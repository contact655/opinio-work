import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

// DELETE /api/mypage/ambassador-self-remove
// Body: { member_id: string }
// 本人が自分の面談対応者登録を解除する
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { member_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { member_id } = body;
  if (!member_id) return NextResponse.json({ error: "member_id required" }, { status: 400 });

  const adminSupabase = createAdminClient();

  // ow_users.id を取得
  const { data: owUser } = await adminSupabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  /* ⚠️ 削除する前に company_id を取る。消したあとでは分からず、
        キャッシュを捨てられない（最大60秒、消したのに出続ける）。 */
  const { data: target, error: findErr } = await adminSupabase
    .from("ow_company_members")
    .select("company_id")
    .eq("id", member_id)
    .eq("user_id", owUser.id)
    .maybeSingle();
  if (findErr) {
    console.error("[ambassador self-remove] find:", findErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 本人のレコードのみ削除できる
  const { error } = await adminSupabase
    .from("ow_company_members")
    .delete()
    .eq("id", member_id)
    .eq("user_id", owUser.id);

  if (error) {
    console.error("[ambassador self-remove]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  revalidateCompanyAmbassadors(target.company_id as string);
  return NextResponse.json({ ok: true });
}
