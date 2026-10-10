import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUse } from "@/lib/constants/plans";
import { listApproachSenders, sendApproach } from "@/lib/approaches/server";
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

  /* ★送る担当者（2026-10-10 / 段4）。省略したら自分。⚠️★**その企業の有効な担当者か**をサーバーで確かめる
        （画面の選択肢と同じ `listApproachSenders`）。違えば 400（黙って自分に置き換えない）。
     ★2026-10-10: 選べるのは**操作している人と is_test が同じ担当者だけ**（同じ関数が絞る）。違えば 400。
     ⚠️ 送れる相手かの判定（is_test の一致を含む）は sendApproach が**この送り手で**行う。 */
  let senderOwUserId = ctx.currentOwnId;
  if (typeof body?.senderUserId === "string" && body.senderUserId && body.senderUserId !== ctx.currentOwnId) {
    const senders = await listApproachSenders(ctx.tenantId, ctx.currentOwnId);
    if (!senders) return NextResponse.json({ error: "担当者を確認できませんでした" }, { status: 500 });
    if (!senders.some((s) => s.id === body.senderUserId)) {
      return NextResponse.json({ error: "送る担当者は、選べる担当者の中から選んでください" }, { status: 400 });
    }
    senderOwUserId = body.senderUserId;
  }

  const r = await sendApproach({
    companyId: ctx.tenantId,
    senderOwUserId,
    candidateOwUserId: candidateUserId,
    reason,
    body: message,
    jobId,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, id: r.id });
}
