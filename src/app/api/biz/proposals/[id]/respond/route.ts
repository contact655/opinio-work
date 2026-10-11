import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { saveCompanyResponse } from "@/lib/evidence/respond";
import { isCompanyResponse } from "@/lib/constants/proposalResponses";

export const dynamic = "force-dynamic";

/**
 * 企業が「届いた方」（review）に答える。
 *
 * ⚠️★**その提案が自社宛であることを必ず確かめる。**（`getTenantContext` は
 *    「どの企業の人か」を返すだけで、提案の所有者までは見ない）
 * ⚠️ これはスカウトではない。`ow_scouts` には何も書かない。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const response = String(body.response ?? "");
  if (!isCompanyResponse(response)) {
    return NextResponse.json({ error: "invalid response" }, { status: 400 });
  }

  /* ⚠️★自社宛か・答えられる段かは saveCompanyResponse が確かめる。
        答えられない提案（未回答・見送り・期限切れ・他社）は一律 404（存在を区別させない） */
  const out = await saveCompanyResponse({
    proposalId: params.id,
    companyId: ctx.tenantId,
    response,
    reason: typeof body.reason === "string" ? body.reason : null,
    note: typeof body.note === "string" ? body.note : null,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, conversationId: out.conversationId ?? null });
}
