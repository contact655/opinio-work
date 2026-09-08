import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // admin チェック（auth_is_admin RPC — ow_user_roles.role='admin' で判定）
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const body = await req.json();
  const { company_id } = body as { company_id: string | null };

  /* ⚠️★**付け替え前の company_id を控える**（2026-09-08）。この経路は所属先そのものを
        差し替えるので、**前の会社と後の会社の両方**の企業ページで社員一覧が変わる。
        後だけ落とすと、前の会社のページにその人が残り続ける。 */
  const beforeRow = await admin
    .from("ow_experiences").select("company_id").eq("id", params.id).maybeSingle();
  const beforeCompanyId = (beforeRow.data?.company_id as string | null) ?? null;

  const { error } = await admin
    .from("ow_experiences")
    .update({ company_id: company_id ?? null })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /* ⚠️ 企業ページの社員・OB/OG は `getCompanyEmployeesCached`（unstable_cache 300秒）
        越しに出るので、落とさないと最大300秒古いまま。自由入力（null）は対象外。 */
  const targets = [beforeCompanyId, company_id ?? null].filter(
    (v, i, a): v is string => !!v && a.indexOf(v) === i,
  );
  for (const cid of targets) await revalidateCompanyPages(cid);

  return NextResponse.json({ ok: true });
}
