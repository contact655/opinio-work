import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { cancelMeetingSlots } from "@/lib/meetings/server";

export const dynamic = "force-dynamic";

/** POST — 候補日（確定済みなら面談も）を取り消す。求職者に通知する */
export async function POST(_req: NextRequest, { params }: { params: { id: string; messageId: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await cancelMeetingSlots({ conversationId: params.id, companyId: ctx.tenantId, actorOwUserId: ctx.currentOwnId, messageId: params.messageId });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
