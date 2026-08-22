import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { VALID_APPLICATION_STATUSES } from "@/lib/business/applications";
import { notify } from "@/lib/notify/email";
import { applicationStatusTemplate } from "@/lib/notify/templates";
import { insertActivity } from "@/lib/business/activities";
import { fmtMan } from "@/lib/utils/salary";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const appId = params.id;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const supabase = createClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { status?: string; hired_salary?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newStatus = body.status;
  const hiredSalary = body.hired_salary; // 採用確定時の年収（万円）

  if (body.hired_salary !== undefined && body.hired_salary !== null) {
    if (typeof body.hired_salary !== "number" || !Number.isFinite(body.hired_salary) || body.hired_salary < 0 || body.hired_salary > 100000) {
      return NextResponse.json({ error: "hired_salaryは0〜100000万円の範囲で入力してください" }, { status: 400 });
    }
  }

  if (!newStatus || !VALID_APPLICATION_STATUSES.has(newStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${Array.from(VALID_APPLICATION_STATUSES).join(", ")}` },
      { status: 400 }
    );
  }

  // ── Company context (auth + companyId) ────────────────────────────────────
  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Verify application belongs to this company (defense in depth) ─────────
  // RLS handles this automatically, but we also check explicitly to return
  // a proper 404 (vs silent 0-rows which RLS would produce).
  const { data: appRow } = await supabase
    .from("ow_job_applications")
    .select("id, ow_jobs!inner(company_id)")
    .eq("id", appId)
    .maybeSingle();

  if (!appRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Type assertion: ow_jobs join returns object
  const jobCompanyId = (appRow.ow_jobs as unknown as { company_id: string })?.company_id;
  if (jobCompanyId !== ctx.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── UPDATE + 0-rows detection (Commit W lesson: RLS silent block) ─────────
  const updatePayload: {
    status: string;
    updated_at: string;
    hired_confirmed_at?: string | null;
    hired_salary?: number | null;
  } = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === "hired") {
    updatePayload.hired_confirmed_at = new Date().toISOString();
    if (hiredSalary != null) updatePayload.hired_salary = hiredSalary;
  }

  const { data: updated, error } = await supabase
    .from("ow_job_applications")
    .update(updatePayload)
    .eq("id", appId)
    .select("id")
    .single();

  if (error) {
    console.error("[applications PATCH]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!updated) {
    // RLS blocked the UPDATE silently
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Activity: candidate_status_changed / offer_sent (best-effort) ────────
  const STATUS_ACTIVITY_MAP: Record<string, { type: string; desc: string }> = {
    reviewing:  { type: "candidate_status_changed", desc: "候補者を「書類選考中」に変更しました" },
    interview:  { type: "meeting_scheduled",        desc: "候補者を「面接」ステージに進めました" },
    accepted:   { type: "offer_sent",               desc: "候補者にオファーを送りました" },
    rejected:   { type: "candidate_status_changed", desc: "候補者の選考を終了しました" },
    hired:      { type: "offer_sent",               desc: "採用確定を報告しました 🎉" },
  };
  if (STATUS_ACTIVITY_MAP[newStatus]) {
    const { type, desc } = STATUS_ACTIVITY_MAP[newStatus];
    await insertActivity(supabase, {
      company_id: ctx.companyId,
      actor_user_id: null,
      type,
      description: desc,
      target_type: "job_application",
      target_id: appId,
    });
  }

  // ── Notify (best-effort) ──────────────────────────────────────────────────
  const { data: appForNotify } = await supabase
    .from("ow_job_applications")
    .select("email, name, ow_jobs!inner(title, ow_companies!inner(name))")
    .eq("id", appId)
    .maybeSingle();

  const job = appForNotify?.ow_jobs as unknown as {
    title: string;
    ow_companies: { name: string };
  } | null;

  /* 採用確定時: 運営に通知する。
     ⚠️ **請求のトリガーではない**（2026-08-23）。掲載サービスの成功報酬は
        2026-08-21 の規約改定で廃止済み。ここで料率を計算していた（年収 × 0.1）が
        削除した。**戻さないこと。**
     ⚠️ 年収は任意入力。未入力なら「未入力」と出す（0 や推定値で埋めない）。 */
  if (newStatus === "hired" && appForNotify) {
    await notify({
      to: process.env.ADMIN_EMAIL || "contact@opinio.co.jp",
      subject: `【採用確定】${job?.ow_companies?.name ?? "企業"} が採用を確定しました`,
      html: `<!DOCTYPE html><html lang="ja"><body style="font-family:sans-serif;padding:32px;background:#f1f5f9">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
  <div style="background:linear-gradient(135deg,var(--royal),#3B5FD9);padding:20px 28px;border-radius:8px;margin-bottom:28px">
    <span style="font-size:20px;font-weight:800;color:#fff">OPINIO</span>
    <span style="font-size:12px;color:rgba(255,255,255,0.7);margin-left:12px">採用確定通知</span>
  </div>
  <h2 style="color:#065F46;margin:0 0 20px">🎉 採用確定が報告されました</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;width:130px">企業名</td>
        <td style="padding:10px 14px;border:1px solid #e2e8f0">${job?.ow_companies?.name ?? "—"}</td></tr>
    <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">求人</td>
        <td style="padding:10px 14px;border:1px solid #e2e8f0">${job?.title ?? "—"}</td></tr>
    <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">採用者名</td>
        <td style="padding:10px 14px;border:1px solid #e2e8f0">${appForNotify.name ?? "—"}</td></tr>
    <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">採用者メール</td>
        <td style="padding:10px 14px;border:1px solid #e2e8f0"><a href="mailto:${appForNotify.email}" style="color:#3B5FD9">${appForNotify.email ?? "—"}</a></td></tr>
    <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">想定年収</td>
        <td style="padding:10px 14px;border:1px solid #e2e8f0">${hiredSalary ? `${fmtMan(Number(hiredSalary))}万円` : "未入力"}</td></tr>
    <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">申込ID</td>
        <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:12px;color:#475569;font-family:monospace">${appId}</td></tr>
  </table>
  <div style="margin-top:16px;font-size:12px;color:#94a3b8">確定日時: ${new Date().toLocaleString("ja-JP")}</div>
</div></body></html>`,
    });
  }

  // 通常ステータス変更: 応募者本人に通知
  const NOTIFY_STATUSES = new Set(["reviewing", "interview", "accepted", "rejected"]);
  if (NOTIFY_STATUSES.has(newStatus) && appForNotify?.email) {
    await notify(
      applicationStatusTemplate({
        to: appForNotify.email,
        name: appForNotify.name ?? "",
        companyName: job?.ow_companies?.name ?? "",
        jobTitle: job?.title ?? "",
        status: newStatus as "reviewing" | "interview" | "accepted" | "rejected",
      })
    );
  }

  return NextResponse.json({ ok: true, id: updated.id });
}
