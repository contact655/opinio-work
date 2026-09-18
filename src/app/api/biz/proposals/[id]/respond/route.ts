import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveProposalResponse } from "@/lib/evidence/respond";
import { isCompanyResponse } from "@/lib/constants/proposalResponses";

export const dynamic = "force-dynamic";

/**
 * ⑨ 企業が候補者の提案に答える。
 *
 * ⚠️★**その提案が自社宛であることを必ず確かめる。**（`getTenantContext` は
 *    「どの企業の人か」を返すだけで、提案の所有者までは見ない）
 * ⚠️ これはスカウトではない。`ow_scouts` には何も書かない。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: proposal, error: pErr } = await db
    .from("ow_proposals").select("id, company_id").eq("id", params.id).maybeSingle();
  if (pErr) console.error("[biz/proposals] ow_proposals:", pErr.message);
  if (!proposal || proposal.company_id !== ctx.tenantId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const response = String(body.response ?? "");
  if (!isCompanyResponse(response)) {
    return NextResponse.json({ error: "invalid response" }, { status: 400 });
  }

  const out = await saveProposalResponse({
    proposalId: params.id,
    side: "company",
    response,
    reason: typeof body.reason === "string" ? body.reason : null,
    note: typeof body.note === "string" ? body.note : null,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true });
}
