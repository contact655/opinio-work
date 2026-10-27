import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { can } from "@/lib/auth/roles";
import { requestScoutAccess } from "@/lib/business/scoutAccess";
import { COMPANY_SUSPENDED_MESSAGE } from "@/lib/business/scoutGate";

export const dynamic = "force-dynamic";

/**
 * POST /api/biz/scout-access/request — 「スカウト機能の利用を依頼する」（2026-10-28）
 *   body: { message?: string }（任意・500文字まで）
 * ⚠️ 候補者を探す画面を開ける人（candidates.viewProfile）なら依頼できる。
 * ⚠️ 停止中の企業は依頼できない（先に停止の解除）。二重の依頼は 409。
 */
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "candidates.viewProfile")) {
    return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  }
  if (ctx.isSuspended) return NextResponse.json({ error: COMPANY_SUSPENDED_MESSAGE }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message : null;
  const r = await requestScoutAccess({ companyId: ctx.tenantId, owUserId: ctx.currentOwnId, message });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
