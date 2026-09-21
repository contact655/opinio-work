import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone, mutateMany } from "@/lib/supabase/mutate";

/**
 * ★自社職種の「所属する部門」を丸ごと置き換える（2026-09-22）。
 *   PUT { departmentIds: string[] }  … 空配列で全部外す
 *
 * ⚠️★`ow_company_job_role_departments` は admin クライアントでしか読み書きできない
 *    （RLS 有効・ポリシー0本・GRANT 無し）。だから**ここで全部確かめる**:
 *      ① ログインしていて、この会社の管理者であること
 *      ② 職種がこの会社のもので、削除されていないこと
 *      ③ 部門がすべてこの会社のもので、削除されていないこと（他社の部門を付けさせない）
 * ⚠️ 順序は「確かめる → 消す → 入れる」。確かめる前に消さない。
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "部門・職種の編集は管理者だけができます" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const raw = body?.departmentIds;
  if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string")) {
    return NextResponse.json({ error: "departmentIds は文字列の配列で渡してください" }, { status: 400 });
  }
  const departmentIds = Array.from(new Set(raw as string[]));

  const db = createAdminClient();

  const { data: role, error: roleErr } = await db
    .from("ow_company_job_roles")
    .select("id")
    .eq("id", params.id)
    .eq("company_id", ctx.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (roleErr) {
    console.error("[PUT job-roles/departments] role", roleErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!role) return NextResponse.json({ error: "職種が見つかりません" }, { status: 404 });

  if (departmentIds.length > 0) {
    const { data: depts, error: deptErr } = await db
      .from("ow_company_departments")
      .select("id")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null)
      .in("id", departmentIds);
    if (deptErr) {
      console.error("[PUT job-roles/departments] departments", deptErr.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    if ((depts ?? []).length !== departmentIds.length) {
      return NextResponse.json({ error: "選べない部門が含まれています" }, { status: 400 });
    }
  }

  /* ⚠️ 0行でも正常（まだ1つも付いていない職種がある） */
  const del = await mutateAllowNone(
    db.from("ow_company_job_role_departments").delete().eq("job_role_id", params.id).eq("company_id", ctx.tenantId),
    "job-role departments 掃除",
    { returning: "department_id" },
  );
  if (!del.ok) return NextResponse.json({ error: del.error }, { status: del.status });

  if (departmentIds.length > 0) {
    const ins = await mutateMany(
      db.from("ow_company_job_role_departments").insert(
        departmentIds.map((department_id) => ({ company_id: ctx.tenantId, job_role_id: params.id, department_id })),
      ),
      "job-role departments 追加",
      { returning: "department_id" },
    );
    if (!ins.ok) return NextResponse.json({ error: ins.error }, { status: ins.status });
  }

  return NextResponse.json({ departmentIds });
}
