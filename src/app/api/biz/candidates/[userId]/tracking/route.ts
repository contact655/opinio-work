import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { isCandidateNotesEnabled, setCandidateTracking } from "@/lib/candidateNotes/server";

export const dynamic = "force-dynamic";

/** 候補者の社内の状態と担当。「気になる」は stage=interested。⚠️ フラグがオフなら 404 */
export async function PUT(req: NextRequest, { params }: { params: { userId: string } }) {
  if (!isCandidateNotesEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await setCandidateTracking(ctx.tenantId, params.userId, b?.stage ?? null, b && "ownerId" in b ? b.ownerId : undefined);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, tracking: r.data });
}
