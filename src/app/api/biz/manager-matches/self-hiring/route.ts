import { NextRequest, NextResponse } from "next/server";
import { requireBizAction } from "@/lib/auth/companyAccess";
import { removeSelfHiring } from "@/lib/nextManager/server";
import { isUuid } from "@/lib/nextManager/constants";

export const dynamic = "force-dynamic";

/**
 * ★自社で採用中を申告している人の表示を外す（2026-11-19）。外すと、本人はこの会社でもう一度オンにできない。
 * ⚠️ 管理者だけ（managerMatches.handover と同じ範囲）。会社は「いま選んでいる会社」だけ。
 */
export async function POST(req: NextRequest) {
  const a = await requireBizAction("managerMatches.handover");
  if (!a.ok) return a.response;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !isUuid(body.userId)) return NextResponse.json({ error: "外す人を選んでください" }, { status: 400 });
  const r = await removeSelfHiring({ userId: body.userId, companyId: a.actor.companyId, byUserId: a.actor.owUserId, role: "company" });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
