/**
 * /api/biz/company/employee-categories/[id]
 *
 * DELETE — カテゴリを 1 件削除
 *   params: id = ow_company_employee_categories.id
 *   → DELETE FROM ow_company_employee_categories WHERE id = ? AND company_id = ?
 *
 * 認証: createClient + getCompanyContext で企業帰属確認
 * セキュリティ: company_id を WHERE 条件に含めることで他社データの削除を防止
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) {
    return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  }
  const { companyId } = ctx;

  // company_id を条件に含めて他社データの削除を防止
  const { error, count } = await supabase
    .from("ow_company_employee_categories")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) {
    console.error("[employee-categories DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    // 対象なし = 他社カテゴリか既に削除済み
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
