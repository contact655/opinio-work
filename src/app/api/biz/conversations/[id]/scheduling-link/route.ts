import { can } from "@/lib/auth/roles";
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { sendSchedulingLink } from "@/lib/meetings/server";

export const dynamic = "force-dynamic";

/** POST — 自分の日程調整リンクを会話に送る。⚠️ リンクは事前に /api/biz/scheduling-url で登録 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "meetings.manage")) return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  const r = await sendSchedulingLink({ conversationId: params.id, companyId: ctx.tenantId, senderOwUserId: ctx.currentOwnId });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, messageId: r.data.messageId });
}
