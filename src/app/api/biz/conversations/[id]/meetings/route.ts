import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { recordLinkMeeting } from "@/lib/meetings/server";

export const dynamic = "force-dynamic";

/** POST — 日程調整リンクで決まった面談日を記録する（確定と同じ扱い。両方へ .ics つきのメール） */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await recordLinkMeeting({ conversationId: params.id, companyId: ctx.tenantId, actorOwUserId: ctx.currentOwnId, startsAt: b?.startsAt, duration: b?.duration, format: b?.format });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, meetingId: r.data.meetingId });
}
