import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUse } from "@/lib/constants/plans";
import { sendApproach } from "@/lib/approaches/server";
import { isCompanyReviewed, COMPANY_REVIEW_BLOCKED_MESSAGE } from "@/lib/business/scoutGate";

export const dynamic = "force-dynamic";

/**
 * POST /api/biz/approaches — 企業からの「声かけ」を送る（2026-10-09）。
 *
 * ⚠️ 判定（送れる相手・上限・使い回し）は `lib/approaches/server.ts` の `sendApproach` の1か所。
 *    ここでは「企業の有効な担当者か」（`getTenantContext`）と「プランで使えるか」だけを見る。
 * ⚠️★送れない相手には理由を返さない（403 と決まった文言だけ）。
 */
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  /* ⚠️ 候補者検索（/biz/candidates）と同じ審査の判定。画面だけ塞いでも API は直接叩ける */
  if (!isCompanyReviewed(ctx)) {
    return NextResponse.json({ error: COMPANY_REVIEW_BLOCKED_MESSAGE }, { status: 403 });
  }
  if (!canUse(ctx.planType, "companyApproach")) {
    return NextResponse.json({ error: "この機能はご利用のプランでは使えません" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const candidateUserId = typeof body?.candidateUserId === "string" ? body.candidateUserId : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const message = typeof body?.body === "string" ? body.body : null;
  const jobId = typeof body?.jobId === "string" && body.jobId ? body.jobId : null;
  if (!candidateUserId) return NextResponse.json({ error: "宛先がありません" }, { status: 400 });

  const r = await sendApproach({
    companyId: ctx.tenantId,
    senderOwUserId: ctx.currentOwnId,
    candidateOwUserId: candidateUserId,
    reason,
    body: message,
    jobId,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, id: r.id });
}
