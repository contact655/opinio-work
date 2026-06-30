import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/isAdmin";
import { NextResponse } from "next/server";

/**
 * DELETE /api/admin/companies/[id]/admins/[user_id]
 *
 * 運営が不正な admin を強制 kick する。
 * Phase 2 Sprint 1 — 運営側 admin 監視画面用
 *
 * 認証: Opinio 運営（isAdmin()）のみ
 *
 * パスパラメータ:
 *   id      - ow_companies.id
 *   user_id - ow_users.id（ow_company_admins.user_id）
 *
 * 処理:
 *   1. isAdmin() チェック
 *   2. ow_company_admins から該当レコードを DELETE
 *   3. 削除件数を返す
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; user_id: string } }
) {
  // 1. 運営チェック
  const ok = await isAdmin();
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companyId = params.id;
  const userId = params.user_id;

  if (!companyId || !userId) {
    return NextResponse.json({ error: "company id and user_id are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 2. 対象レコードの存在確認
  const { data: existing, error: findError } = await admin
    .from("ow_company_admins")
    .select("id, permission")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (findError) {
    console.error("[DELETE /api/admin/companies/.../admins/...] find error:", findError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json(
      { error: "指定された admin が見つかりません" },
      { status: 404 }
    );
  }

  // 3. DELETE
  const { error: deleteError } = await admin
    .from("ow_company_admins")
    .delete()
    .eq("company_id", companyId)
    .eq("user_id", userId);

  if (deleteError) {
    console.error("[DELETE /api/admin/companies/.../admins/...] delete error:", deleteError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    kicked: {
      company_id: companyId,
      user_id: userId,
      permission: existing.permission,
    },
  });
}
