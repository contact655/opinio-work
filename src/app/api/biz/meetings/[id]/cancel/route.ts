import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { cancelMeeting } from "@/lib/meetings/server";

export const dynamic = "force-dynamic";

/** POST — 面談を取り消す。求職者に通知する */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await cancelMeeting({ meetingId: params.id, companyId: ctx.tenantId, actorOwUserId: ctx.currentOwnId });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
