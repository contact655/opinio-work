import { createClient } from "@/lib/supabase/server";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { mutateOne } from "@/lib/supabase/mutate";
import { deliverPendingInterests } from "@/lib/interest/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { requireCompanyAction, permissionDeniedResponse, roleIn } from "@/lib/auth/permissions";
import { can, isCompanyRole } from "@/lib/auth/roles";

type Action = "permission" | "deactivate" | "reactivate" | "update_profile";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const adminRecordId = params.id; // ow_company_admins.id
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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
    .select("id, user_id, permission, is_active, company_id, accepted_at, created_via")
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

  // メンバーの変更は admin 必須
  try { requireCompanyAction(allMemberships, companyId, "members.manage"); } catch { return permissionDeniedResponse(); }

  // 最後の admin を数える共通ヘルパー
  async function countActiveAdmins(): Promise<number> {
    const { count } = await supabase
      .from("ow_company_admins")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId!)
      .eq("permission", "admin")
      .eq("is_active", true)
      /* ⚠️ 招待中の行（user_id が無い）は数えない。数えると「受けていない招待」が管理者の代わりになり、
            本当の最後の1人を降格・無効化できてしまう（2026-10-12 に直した） */
      .not("user_id", "is", null);
    return count ?? 0;
  }

  // ── action: permission ──────────────────────────────────────────
  if (body.action === "permission") {
    /* ★役割は4つ（2026-10-12。lib/auth/roles.ts） */
    const newPermission = body.value;
    if (!isCompanyRole(newPermission)) {
      return NextResponse.json({ error: "Invalid permission value" }, { status: 400 });
    }

    // ガード A: 自己降格防止
    if (isSelf && newPermission !== "admin") {
      return NextResponse.json(
        { error: "自分自身の権限を降格することはできません", code: "SELF_DEMOTION" },
        { status: 403 }
      );
    }

    // ガード B: 最後の admin 消去防止
    if (target.permission === "admin" && newPermission !== "admin") {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "最後の管理者は降格できません", code: "LAST_ADMIN" },
          { status: 400 }
        );
      }
    }

    const res = await mutateOne(
      supabase.from("ow_company_admins").update({ permission: newPermission }).eq("id", adminRecordId),
      "members PATCH permission",
    );
    const error = res.ok ? null : { message: res.error };

    if (error) {
      console.error("[members PATCH permission]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

    const res = await mutateOne(
      supabase.from("ow_company_admins").update({ is_active: false }).eq("id", adminRecordId),
      "members PATCH deactivate",
    );
    const error = res.ok ? null : { message: res.error };

    if (error) {
      console.error("[members PATCH deactivate]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // ── action: reactivate ─────────────────────────────────────────
  else if (body.action === "reactivate") {
    /* ★本人が担当者になることに同意した行だけ戻せる（2026-10-26 / フェーズ1a-1）。
          同意の記録は「招待を承諾した（accepted_at）」か「本人が参加を申請した（created_via='join_request'）」。
          それ以外（承諾の記録が無い古い行）を戻すと、本人の承諾なしに担当者の権限を渡すことになる。
       ⚠️ 戻せない行は招待を送り直す（承諾すると同じ行が有効になる。accept/route.ts）。
       ⚠️ select から accepted_at / created_via を落とさないこと。undefined になると全員戻せなくなる。 */
    const consented = target.accepted_at != null || target.created_via === "join_request";
    if (!consented) {
      return NextResponse.json(
        { error: "本人の承諾の記録がないため、そのまま戻せません。招待を送ってください（相手が承諾すると担当者に戻ります）。", code: "CONSENT_REQUIRED" },
        { status: 409 }
      );
    }
    const res = await mutateOne(
      supabase.from("ow_company_admins").update({ is_active: true }).eq("id", adminRecordId),
      "members PATCH reactivate",
    );
    const error = res.ok ? null : { message: res.error };

    if (error) {
      console.error("[members PATCH reactivate]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    /* ★担当者に戻ったので「話を聞いてみたい」の登録待ちを届ける（90日以内）。best-effort・黙らない */
    await deliverPendingInterests([companyId!]).catch((e) => console.error("[members PATCH reactivate] deliverPendingInterests:", e));
  }

  // ── action: update_profile ────────────────────────────────────────
  else if (body.action === "update_profile") {
    // admin チェックは PATCH 冒頭で一元実施済み

    // 空文字は null に正規化、最大 100 文字
    const roleTitle = (body.role_title?.trim() || null);
    const department = (body.department?.trim() || null);

    if (roleTitle && roleTitle.length > 100) {
      return NextResponse.json({ error: "役職は 100 文字以内で入力してください" }, { status: 400 });
    }
    if (department && department.length > 100) {
      return NextResponse.json({ error: "部署は 100 文字以内で入力してください" }, { status: 400 });
    }

    const res = await mutateOne(
      supabase.from("ow_company_admins").update({ role_title: roleTitle, department }).eq("id", adminRecordId),
      "members PATCH update_profile",
    );
    const error = res.ok ? null : { message: res.error };

    if (error) {
      console.error("[members PATCH update_profile]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  /* ⚠️ action: ambassador（`ow_company_admins.is_ambassador`）は 2026-10-16 に撤去した。死にフラグだった */
  else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  /* ⚠️★2026-09-07 追加。採用担当者は企業ページの「採用担当者」に出るので作り直す。
        ⚠️ `getCompanyRecruitersCached`（unstable_cache 300秒）越しだが、
           **`revalidatePath` で一緒に落ちる**（2026-09-08 に本番でツールで実測）。 */
  await revalidateCompanyPages(companyId);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const adminRecordId = params.id;
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 403 });

  const { companyId, allMemberships } = ctx;

  if (!can(roleIn(allMemberships, companyId), "members.manage")) {
    return NextResponse.json({ error: "招待のキャンセルは管理者のみ可能です" }, { status: 403 });
  }

  const { data: target } = await supabase
    .from("ow_company_admins")
    .select("id, company_id, user_id")
    .eq("id", adminRecordId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.company_id !== companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (target.user_id !== null) {
    return NextResponse.json(
      { error: "受諾済みの招待はキャンセルできません", code: "ALREADY_ACCEPTED" },
      { status: 409 }
    );
  }

  /* ⚠️ **0行削除を成功として扱わない。** 招待のキャンセルが効いていないのに
        「キャンセルしました」と出るのを防ぐ（CLAUDE.md）。 */
  const res = await mutateOne(
    supabase.from("ow_company_admins").delete().eq("id", adminRecordId),
    "members DELETE",
  );
  const error = res.ok ? null : { message: res.error };

  if (error) {
    console.error("[members DELETE]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  /* ⚠️★2026-09-07 追加。採用担当者は企業ページの「採用担当者」に出るので作り直す。
        ⚠️ `getCompanyRecruitersCached`（unstable_cache 300秒）越しだが、
           **`revalidatePath` で一緒に落ちる**（2026-09-08 に本番でツールで実測）。 */
  await revalidateCompanyPages(companyId);
  return NextResponse.json({ success: true });
}
