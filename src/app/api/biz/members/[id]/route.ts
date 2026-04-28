import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";

type Action = "permission" | "deactivate" | "reactivate" | "update_profile";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const adminRecordId = params.id; // ow_company_admins.id
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action: Action; value?: string; role_title?: string; department?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) {
    return NextResponse.json({ error: "Company context not found" }, { status: 403 });
  }
  const { owUserId: actorOwUserId, companyId, allMemberships } = ctx;

  // 対象の ow_company_admins row を取得
  const { data: target, error: fetchErr } = await supabase
    .from("ow_company_admins")
    .select("id, user_id, permission, is_active, company_id")
    .eq("id", adminRecordId)
    .maybeSingle();

  if (fetchErr || !target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // 同一企業かどうか確認
  if (target.company_id !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isSelf = target.user_id === actorOwUserId;

  // 最後の admin を数える共通ヘルパー
  async function countActiveAdmins(): Promise<number> {
    const { count } = await supabase
      .from("ow_company_admins")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId!)
      .eq("permission", "admin")
      .eq("is_active", true);
    return count ?? 0;
  }

  // ── action: permission ──────────────────────────────────────────
  if (body.action === "permission") {
    const newPermission = body.value;
    if (newPermission !== "admin" && newPermission !== "member") {
      return NextResponse.json({ error: "Invalid permission value" }, { status: 400 });
    }

    // ガード A: 自己降格防止
    if (isSelf && newPermission === "member") {
      return NextResponse.json(
        { error: "自分自身の権限を降格することはできません", code: "SELF_DEMOTION" },
        { status: 403 }
      );
    }

    // ガード B: 最後の admin 消去防止
    if (target.permission === "admin" && newPermission === "member") {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "最後の管理者は降格できません", code: "LAST_ADMIN" },
          { status: 400 }
        );
      }
    }

    const { error } = await supabase
      .from("ow_company_admins")
      .update({ permission: newPermission })
      .eq("id", adminRecordId);

    if (error) {
      console.error("[members PATCH permission]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // ── action: deactivate ─────────────────────────────────────────
  else if (body.action === "deactivate") {
    // ガード C: 自己無効化防止
    if (isSelf) {
      return NextResponse.json(
        { error: "自分自身を無効化することはできません", code: "SELF_DEACTIVATE" },
        { status: 403 }
      );
    }

    // ガード D: 最後の admin 消去防止
    if (target.permission === "admin" && target.is_active) {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "最後の管理者は無効化できません", code: "LAST_ADMIN" },
          { status: 400 }
        );
      }
    }

    const { error } = await supabase
      .from("ow_company_admins")
      .update({ is_active: false })
      .eq("id", adminRecordId);

    if (error) {
      console.error("[members PATCH deactivate]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // ── action: reactivate ─────────────────────────────────────────
  else if (body.action === "reactivate") {
    const { error } = await supabase
      .from("ow_company_admins")
      .update({ is_active: true })
      .eq("id", adminRecordId);

    if (error) {
      console.error("[members PATCH reactivate]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // ── action: update_profile ────────────────────────────────────────
  else if (body.action === "update_profile") {
    // actor が admin であることを確認（自分自身の編集も可）
    const actorMembership = allMemberships.find((m) => m.companyId === companyId);
    if (actorMembership?.permission !== "admin") {
      return NextResponse.json({ error: "役職・部署の変更は管理者のみ可能です" }, { status: 403 });
    }

    // 空文字は null に正規化、最大 100 文字
    const roleTitle = (body.role_title?.trim() || null);
    const department = (body.department?.trim() || null);

    if (roleTitle && roleTitle.length > 100) {
      return NextResponse.json({ error: "役職は 100 文字以内で入力してください" }, { status: 400 });
    }
    if (department && department.length > 100) {
      return NextResponse.json({ error: "部署は 100 文字以内で入力してください" }, { status: 400 });
    }

    const { error } = await supabase
      .from("ow_company_admins")
      .update({ role_title: roleTitle, department })
      .eq("id", adminRecordId);

    if (error) {
      console.error("[members PATCH update_profile]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
