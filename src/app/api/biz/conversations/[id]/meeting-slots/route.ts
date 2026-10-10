import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { sendMeetingSlots } from "@/lib/meetings/server";

export const dynamic = "force-dynamic";

/** POST — 候補日を送る（2026-10-10 / 段4）。⚠️ 判定は lib/meetings/server.ts の1か所 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await sendMeetingSlots({
    conversationId: params.id, companyId: ctx.tenantId, senderOwUserId: ctx.currentOwnId,
    slots: b?.slots, format: b?.format, duration: b?.duration, attendeeUserIds: b?.attendeeUserIds,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, messageId: r.data.messageId });
}
