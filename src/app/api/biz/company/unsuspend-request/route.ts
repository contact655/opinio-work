import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import { requireCompanyAction, permissionDeniedResponse } from "@/lib/auth/permissions";
import { requestUnsuspend } from "@/lib/companies/suspension";

export const dynamic = "force-dynamic";

/**
 * POST /api/biz/company/unsuspend-request — 停止中の企業ページについて「停止解除を依頼する」（2026-10-28）
 *   body: { message?: string }（任意・500文字まで）。運営にメールし、履歴に残す。依頼中は 409
 * ⚠️ 管理者だけ（公開・非公開と同じ company.listingRequest）。
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ctx = await getCompanyContext(supabase, user.id, cookies().get("biz_current_company_id")?.value);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  try { requireCompanyAction(ctx.allMemberships, ctx.companyId, "company.listingRequest"); } catch { return permissionDeniedResponse(); }

  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
  const r = await requestUnsuspend({ companyId: ctx.companyId, owUserId: ctx.owUserId, message: typeof body?.message === "string" ? body.message : null });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, requestedAt: r.requestedAt });
}
