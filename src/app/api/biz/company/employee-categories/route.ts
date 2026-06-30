/**
 * /api/biz/company/employee-categories
 *
 * POST — カテゴリを 1 件追加
 *   body: { roleId: string; displayOrder: number }
 *   → INSERT INTO ow_company_employee_categories
 *
 * PUT  — カテゴリ順序を一括更新
 *   body: { orderedIds: string[] }  ← ow_company_employee_categories.id の配列
 *   → UPDATE display_order = index 順
 *
 * 認証: createClient (サーバー側 cookie) + getCompanyContext で企業帰属確認
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";

// ─── POST: カテゴリ追加 ───────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { roleId?: string; customName?: string; parentRoleId?: string; displayOrder?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { roleId, customName, parentRoleId, displayOrder } = body;
  if (!roleId && !customName) {
    return NextResponse.json({ error: "roleId または customName が必要です" }, { status: 400 });
  }

  const admin = createAdminClient();
  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(admin, user.id, cookieCompanyId);
  if (!ctx) {
    return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  }
  const { companyId } = ctx;

  try { requireAdmin(ctx.allMemberships, companyId); } catch { return permissionDeniedResponse(); }

  const { data, error } = await admin
    .from("ow_company_employee_categories")
    .insert({
      company_id: companyId,
      role_id: roleId ?? null,
      custom_name: customName ?? null,
      parent_role_id: parentRoleId ?? null,
      display_order: displayOrder ?? 0,
    })
    .select("id, role_id, display_order, custom_name, parent_role_id")
    .single();

  if (error) {
    // 重複 (UNIQUE 制約違反) は 409 で返す
    if (error.code === "23505") {
      return NextResponse.json({ error: "すでに追加済みのカテゴリです" }, { status: 409 });
    }
    console.error("[employee-categories POST]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

// ─── PUT: 表示順一括更新 ──��───────────────────────────────────────────────────

export async function PUT(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { orderedIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orderedIds } = body;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds must be a non-empty array" }, { status: 400 });
  }

  const admin = createAdminClient();
  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(admin, user.id, cookieCompanyId);
  if (!ctx) {
    return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  }
  const { companyId } = ctx;

  try { requireAdmin(ctx.allMemberships, companyId); } catch { return permissionDeniedResponse(); }

  // 各 ID の display_order を index 値に更新
  // 並列実行で高速化、ただし企業帰属確認のため company_id も条件に含める
  const updates = orderedIds.map((id, index) =>
    admin
      .from("ow_company_employee_categories")
      .update({ display_order: index })
      .eq("id", id)
      .eq("company_id", companyId) // 他社データを更新できないようにガード
  );

  const results = await Promise.all(updates);
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    console.error("[employee-categories PUT] partial failure:", failed[0].error?.message);
    return NextResponse.json(
      { error: `${failed.length} 件の更新に失敗しました` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
