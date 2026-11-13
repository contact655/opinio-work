import { NextRequest, NextResponse } from "next/server";
import { requireBizAction } from "@/lib/auth/companyAccess";
import { handoverMatches } from "@/lib/nextManager/server";
import { isUuid } from "@/lib/nextManager/constants";

export const dynamic = "force-dynamic";

/**
 * ★候補者管理の引き継ぎ（2026-11-13）。退職などで外れたマネージャーの記録を、後任へまとめて付け替える。
 * ⚠️ 管理者だけ（managerMatches.handover）。会社は「いま選んでいる会社」。
 */
export async function POST(req: NextRequest) {
  const a = await requireBizAction("managerMatches.handover");
  if (!a.ok) return a.response;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !isUuid(body.fromUserId) || !isUuid(body.toUserId)) {
    return NextResponse.json({ error: "引き継ぎ元と引き継ぎ先を選んでください" }, { status: 400 });
  }
  const r = await handoverMatches({ companyId: a.actor.companyId, fromUserId: body.fromUserId, toUserId: body.toUserId, byUserId: a.actor.owUserId });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, count: r.count });
}
