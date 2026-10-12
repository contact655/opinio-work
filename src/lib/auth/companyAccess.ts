/* ★サーバー専用（2026-10-12）。クライアントから読まれるとビルドが落ちる */
import "server-only";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyContext, type CompanyContext } from "@/lib/business/company";
import { can, type CompanyAction, type CompanyRole } from "@/lib/auth/roles";

/**
 * ★企業側の API・Server Action が権限を確かめる入口（2026-10-12）。
 *
 * ⚠️★**サーバー用のキー（admin クライアント）を使う処理は、必ずここを通してから書く・読む。**
 *    admin クライアントは DB のルール（RLS）を通らないので、ここが唯一の防波堤になる。
 * ⚠️ 判定は `can(role, action)`（lib/auth/roles.ts）の1か所。ここに条件を書き足さない。
 * ⚠️ 会社は「いま選んでいる会社」（biz_current_company_id）。所属が無ければ 401/403。
 */

export type BizActor = {
  companyId: string;
  owUserId: string;
  role: CompanyRole;
  ctx: CompanyContext;
};

/** ログインしていて、いま選んでいる会社の有効な担当者なら返す。そうでなければ null */
export async function getBizActor(): Promise<BizActor | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ctx = await getCompanyContext(supabase, user.id, cookies().get("biz_current_company_id")?.value);
  if (!ctx) return null;
  const m = ctx.allMemberships.find((x) => x.companyId === ctx.companyId);
  if (!m) return null;
  return { companyId: ctx.companyId, owUserId: ctx.owUserId, role: m.permission, ctx };
}

/** 判定に要るだけの形（getTenantContext からも作れるように） */
export type ActorLike = Pick<BizActor, "companyId" | "owUserId" | "role">;

/** getTenantContext() の戻り値から作る */
export function actorFromTenant(t: { tenantId: string; currentOwnId: string; currentPermission: CompanyRole }): ActorLike {
  return { companyId: t.tenantId, owUserId: t.currentOwnId, role: t.currentPermission };
}

export const PERMISSION_DENIED_MESSAGE = "この操作の権限がありません。";

export function permissionDenied(): NextResponse {
  return NextResponse.json({ error: PERMISSION_DENIED_MESSAGE, code: "permission_denied" }, { status: 403 });
}

/**
 * API で使う形。いずれかの操作ができればよい（`actions` は OR）。
 *   const a = await requireBizAction("jobs.edit"); if (!a.ok) return a.response;
 */
export async function requireBizAction(
  ...actions: CompanyAction[]
): Promise<{ ok: true; actor: BizActor } | { ok: false; response: NextResponse }> {
  const actor = await getBizActor();
  if (!actor) return { ok: false, response: NextResponse.json({ error: "ログインが必要です。", code: "unauthorized" }, { status: 401 }) };
  if (!actions.some((a) => can(actor.role, a))) return { ok: false, response: permissionDenied() };
  return { ok: true, actor };
}

/** Server Action で使う形（NextResponse を返せないので理由だけ返す） */
export async function checkBizAction(
  ...actions: CompanyAction[]
): Promise<{ ok: true; actor: BizActor } | { ok: false; error: string }> {
  const actor = await getBizActor();
  if (!actor) return { ok: false, error: "ログインし直してください。" };
  if (!actions.some((a) => can(actor.role, a))) return { ok: false, error: PERMISSION_DENIED_MESSAGE };
  return { ok: true, actor };
}

// ─── 面接官: 担当の応募 ──────────────────────────────────────────────────────

/**
 * この人が担当になっている応募の id（この会社の分だけ）。⚠️ 取れなければ null（「担当なし」と区別する）
 */
export async function assignedApplicationIds(companyId: string, owUserId: string): Promise<string[] | null> {
  const { data, error } = await createAdminClient().from("ow_application_interviewers")
    .select("application_id").eq("company_id", companyId).eq("user_id", owUserId);
  if (error) { console.error("[companyAccess] interviewers:", error.message); return null; }
  return (data ?? []).map((r) => r.application_id as string);
}

/**
 * この人が担当になっている候補者（ow_users.id）。⚠️ 取れなければ null
 */
export async function assignedCandidateIds(companyId: string, owUserId: string): Promise<string[] | null> {
  const ids = await assignedApplicationIds(companyId, owUserId);
  if (ids === null) return null;
  if (ids.length === 0) return [];
  const { data, error } = await createAdminClient().from("ow_job_applications").select("user_id").in("id", ids);
  if (error) { console.error("[companyAccess] applications:", error.message); return null; }
  return Array.from(new Set((data ?? []).map((r) => r.user_id as string).filter(Boolean)));
}

/**
 * ★この候補者の情報を見てよいか（選考の流れ・プロフィール）。
 *   選考を見られる役割なら誰の分でも、面接官は担当の応募の候補者だけ。
 */
export async function canSeeCandidate(actor: ActorLike, candidateOwUserId: string): Promise<boolean> {
  if (can(actor.role, "selection.view")) return true;
  if (!can(actor.role, "selection.viewAssigned")) return false;
  const ids = await assignedCandidateIds(actor.companyId, actor.owUserId);
  return !!ids && ids.includes(candidateOwUserId);
}

/** ★この候補者にメモを書いてよいか。採用担当以上は誰の分でも、面接官は担当の応募の候補者だけ */
export async function canNoteCandidate(actor: ActorLike, candidateOwUserId: string): Promise<boolean> {
  if (can(actor.role, "candidates.notes")) return true;
  if (!can(actor.role, "candidate.noteAssigned")) return false;
  const ids = await assignedCandidateIds(actor.companyId, actor.owUserId);
  return !!ids && ids.includes(candidateOwUserId);
}

/**
 * ★画面（/biz のページ）の入口。権限が無ければホームへ戻す（2026-10-12）。
 *   サイドバーで出していない画面を URL で開かれたときのため。⚠️ ホーム（dashboard.view）は全員が見られる。
 *   使い方（getTenantContext のあと）: guardBizPage(ctx.currentPermission, "jobs.edit");
 */
export function guardBizPage(role: CompanyRole | null, ...actions: CompanyAction[]): void {
  if (!actions.some((a) => can(role, a))) redirect("/biz/dashboard?denied=1");
}
