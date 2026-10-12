import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notify/email";
import { interviewerAssignedTemplate } from "@/lib/notify/templates";

/**
 * ★応募ごとの面接担当（2026-10-12 / 柴さんの指示）。**サーバー専用。**
 *
 * 表は ow_application_interviewers（migration 20261012200000）。クライアントからは読みだけで、
 * 付け外しはここ（admin クライアント）だけ。⚠️ 呼ぶ前に役割（selection.assignInterviewers）を確かめること。
 * ⚠️ 担当にできるのは、その会社の有効な担当者（役割は問わない）。
 */

export type InterviewerRef = { userId: string; name: string };

/** 応募ごとの担当。⚠️ 取れなければ null（「担当なし」と区別する） */
export async function listInterviewersFor(companyId: string, applicationIds: string[]): Promise<Record<string, InterviewerRef[]> | null> {
  const out: Record<string, InterviewerRef[]> = {};
  if (applicationIds.length === 0) return out;
  const db = createAdminClient();
  const { data, error } = await db.from("ow_application_interviewers")
    .select("application_id, user_id, created_at, ow_users!ow_application_interviewers_user_id_fkey(name)")
    .eq("company_id", companyId).in("application_id", applicationIds).order("created_at");
  if (error) { console.error("[interviewers] list:", error.message); return null; }
  for (const r of data ?? []) {
    const u = r.ow_users as unknown as { name: string | null } | null;
    (out[r.application_id as string] ??= []).push({ userId: r.user_id as string, name: u?.name ?? "（名前なし）" });
  }
  return out;
}

/** 担当にできる人（その会社の有効な担当者）。⚠️ 取れなければ null */
export async function listAssignableStaff(companyId: string): Promise<InterviewerRef[] | null> {
  const { data, error } = await createAdminClient().from("ow_company_admins")
    .select("user_id, ow_users!user_id(name)")
    .eq("company_id", companyId).eq("is_active", true).not("user_id", "is", null);
  if (error) { console.error("[interviewers] staff:", error.message); return null; }
  return (data ?? []).map((r) => ({ userId: r.user_id as string, name: (r.ow_users as unknown as { name: string | null } | null)?.name ?? "（名前なし）" }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

type Result = { ok: true; interviewers: InterviewerRef[] } | { ok: false; status: number; error: string };

/** 応募がこの会社のものか。⚠️ 別の会社の応募は「見つからない」と同じに返す */
async function applicationInCompany(companyId: string, applicationId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("ow_job_applications")
    .select("id, ow_jobs!inner(company_id)").eq("id", applicationId).eq("ow_jobs.company_id", companyId).maybeSingle();
  if (error) console.error("[interviewers] application:", error.message);
  return !!data;
}

async function isActiveStaff(companyId: string, owUserId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("ow_company_admins")
    .select("id").eq("company_id", companyId).eq("user_id", owUserId).eq("is_active", true).maybeSingle();
  if (error) console.error("[interviewers] staff check:", error.message);
  return !!data;
}

export async function setInterviewer(
  companyId: string, applicationId: string, targetOwUserId: string, assign: boolean, actorOwUserId: string,
): Promise<Result> {
  if (!/^[0-9a-f-]{36}$/i.test(applicationId) || !/^[0-9a-f-]{36}$/i.test(targetOwUserId)) {
    return { ok: false, status: 400, error: "指定が正しくありません。" };
  }
  if (!(await applicationInCompany(companyId, applicationId))) return { ok: false, status: 404, error: "応募が見つかりません。" };
  const db = createAdminClient();
  if (assign) {
    if (!(await isActiveStaff(companyId, targetOwUserId))) return { ok: false, status: 400, error: "この会社のメンバーではありません。" };
    const { error } = await db.from("ow_application_interviewers").upsert(
      { application_id: applicationId, user_id: targetOwUserId, company_id: companyId, assigned_by: actorOwUserId },
      { onConflict: "application_id,user_id", ignoreDuplicates: true },
    );
    if (error) { console.error("[interviewers] add:", error.message); return { ok: false, status: 500, error: "担当を付けられませんでした。" }; }
    /* ★本人に知らせる（面接官に送るのは担当の応募の通知だけ。2026-10-12）。best-effort。自分で自分を付けたときは送らない */
    if (targetOwUserId !== actorOwUserId) await notifyAssigned(companyId, applicationId, targetOwUserId);
  } else {
    const { error } = await db.from("ow_application_interviewers").delete()
      .eq("application_id", applicationId).eq("user_id", targetOwUserId).eq("company_id", companyId);
    if (error) { console.error("[interviewers] remove:", error.message); return { ok: false, status: 500, error: "担当を外せませんでした。" }; }
  }
  const list = await listInterviewersFor(companyId, [applicationId]);
  if (!list) return { ok: false, status: 500, error: "担当を読み込めませんでした。" };
  return { ok: true, interviewers: list[applicationId] ?? [] };
}

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://opinio.jp";
}

async function notifyAssigned(companyId: string, applicationId: string, owUserId: string): Promise<void> {
  try {
    const db = createAdminClient();
    const [{ data: u }, { data: co }, { data: app }] = await Promise.all([
      db.from("ow_users").select("name, email").eq("id", owUserId).maybeSingle(),
      db.from("ow_companies").select("name").eq("id", companyId).maybeSingle(),
      db.from("ow_job_applications").select("ow_jobs!inner(title)").eq("id", applicationId).maybeSingle(),
    ]);
    if (!u?.email) return;
    await sendEmail(interviewerAssignedTemplate({
      recipientEmail: u.email as string,
      recipientName: (u.name as string | null) ?? null,
      companyName: (co?.name as string | null) ?? "",
      jobTitle: ((app?.ow_jobs as unknown as { title: string | null } | null)?.title) ?? null,
      url: `${siteUrl()}/biz/meetings?tab=applications&show=a:${applicationId}`,
    }));
  } catch (e) {
    console.error("[interviewers] notify:", e instanceof Error ? e.message : e);
  }
}
