import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne, mutateMany } from "@/lib/supabase/mutate";
import { deliverPendingInterests } from "@/lib/interest/server";
import { requireBizAction } from "@/lib/auth/companyAccess";
import { isCompanyRole, ROLE_LABELS, type CompanyRole } from "@/lib/auth/roles";
import { sendEmail } from "@/lib/notify/email";
import { joinRequestApprovedTemplate } from "@/lib/notify/templates";

/**
 * ★企業の管理者が「担当者に追加してください」という依頼を承認・見送る（2026-10-18 / 柴さんの指示）。
 *
 * それまで依頼は既存の担当者へメールが届くだけで、/biz に見る画面も承認する手段も無かった
 * （メールの案内は「メールアドレスを入力して招待する」で、依頼そのものは pending のまま残った）。
 *
 * - 承認できるのは `members.manage`（管理者）だけ
 * - 権限は承認するときに選ぶ（既定は採用担当）
 * - 承認したら本人にメール。見送ったときは知らせない（運営の見送りと同じ。理由を書けないため）
 *
 * ⚠️ 依頼の中身（どの企業・誰）は画面から受け取らず、サーバーで引き直す。
 *    **依頼の企業がいま操作している企業と一致すること**を必ず確かめる（他社の依頼を承認させない）。
 * ⚠️ `ow_company_join_requests` は anon / authenticated に GRANT が無い。admin クライアントで触る。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "依頼が見つかりません。" }, { status: 404 });

  const a = await requireBizAction("members.manage");
  if (!a.ok) return a.response;
  const { companyId, owUserId: reviewerId } = a.actor;

  let body: { action?: unknown; permission?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action が不正です。" }, { status: 400 });
  }
  /* 権限は既定で採用担当。⚠️ 知らない値は 400（黙って既定に落とさない） */
  let permission: CompanyRole = "recruiter";
  if (body.permission !== undefined) {
    if (!isCompanyRole(body.permission)) return NextResponse.json({ error: "権限が不正です。" }, { status: 400 });
    permission = body.permission;
  }

  const admin = createAdminClient();
  const { data: reqRow, error: reqErr } = await admin
    .from("ow_company_join_requests")
    .select("id, user_id, target_company_id, status, request_type")
    .eq("id", params.id)
    .maybeSingle();
  if (reqErr) {
    console.error("[biz/join-requests] 依頼の取得に失敗:", reqErr.message);
    return NextResponse.json({ error: "依頼を読めませんでした。" }, { status: 500 });
  }
  /* ⚠️ 他社の依頼と存在しない依頼を区別させない（どちらも 404） */
  if (!reqRow || reqRow.target_company_id !== companyId || reqRow.request_type !== "join_existing") {
    return NextResponse.json({ error: "依頼が見つかりません。" }, { status: 404 });
  }
  if (reqRow.status !== "pending") {
    return NextResponse.json({ error: "この依頼はすでに対応済みです。画面を読み込み直してください。" }, { status: 409 });
  }
  const userId = reqRow.user_id as string;
  const now = new Date().toISOString();

  if (action === "reject") {
    /* ⚠️ 同じ人の依頼が再送で2行あることがある。まとめて閉じる（片方だけ残ると一覧に出続ける） */
    const r = await mutateMany(
      admin.from("ow_company_join_requests")
        .update({ status: "rejected", reviewed_by: reviewerId, reviewed_at: now, updated_at: now })
        .eq("target_company_id", companyId).eq("user_id", userId).eq("status", "pending"),
      "biz join-request reject",
      { returning: "id" },
    );
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true });
  }

  /* ── 承認 ── 既に担当者なら追加しない（冪等） */
  const { data: existing, error: exErr } = await admin
    .from("ow_company_admins")
    .select("id, is_active")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (exErr) {
    console.error("[biz/join-requests] 所属の確認に失敗:", exErr.message);
    return NextResponse.json({ error: "所属を確認できませんでした。" }, { status: 500 });
  }

  if (!existing) {
    /* ⚠️ `created_via` は "join_request"（依頼から作った行）。運営が通した行は "admin" なので混ぜない */
    const r = await mutateOne(
      admin.from("ow_company_admins").insert({
        company_id: companyId,
        user_id: userId,
        permission,
        is_active: true,
        created_via: "join_request",
      }),
      "biz join-request insert admin",
      { returning: "id" },
    );
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  } else if (existing.is_active !== true) {
    const r = await mutateOne(
      admin.from("ow_company_admins").update({ is_active: true, permission }).eq("id", existing.id),
      "biz join-request reactivate admin",
      { returning: "id" },
    );
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  }

  /* ⚠️ 担当者への追加が済んでから依頼の状態を書く（逆にすると、追加に失敗したのに承認済みが残る） */
  const upd = await mutateMany(
    admin.from("ow_company_join_requests")
      .update({ status: "approved", reviewed_by: reviewerId, reviewed_at: now, updated_at: now })
      .eq("target_company_id", companyId).eq("user_id", userId).eq("status", "pending"),
    "biz join-request approve",
    { returning: "id" },
  );
  if (!upd.ok) return NextResponse.json({ error: upd.error }, { status: upd.status });

  /* ★担当者が付いたので「話を聞いてみたい」の登録待ちを届ける（90日以内）。best-effort・黙らない（lib/interest/server.ts） */
  await deliverPendingInterests([companyId]).catch((e) => console.error("[biz join-request] deliverPendingInterests:", e));

  /* 本人に知らせる。best-effort（追加そのものは済んでいる）。⚠️ 黙らない */
  const [{ data: user }, { data: company }] = await Promise.all([
    admin.from("ow_users").select("name, email").eq("id", userId).maybeSingle(),
    admin.from("ow_companies").select("name, brand_name").eq("id", companyId).maybeSingle(),
  ]);
  if (user?.email) {
    try {
      await sendEmail(joinRequestApprovedTemplate({
        to: user.email as string,
        requesterName: (user.name as string | null) ?? "",
        companyName: (company?.brand_name as string | null) ?? (company?.name as string | null) ?? "貴社",
        roleLabel: ROLE_LABELS[permission],
      }));
    } catch (e) {
      console.error("[biz/join-requests] 承認メールの送信に失敗:", e);
    }
  } else {
    console.error(`[biz/join-requests] 承認したがメールアドレスが無い user=${userId}`);
  }

  return NextResponse.json({ ok: true });
}
