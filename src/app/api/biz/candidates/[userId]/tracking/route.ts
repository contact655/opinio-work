import { can } from "@/lib/auth/roles";
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { isCandidateNotesEnabled, setCandidateTracking } from "@/lib/candidateNotes/server";
import { canUseCandidateSearch } from "@/lib/business/scoutGate";
import { hasCandidateContact } from "@/lib/business/selectionHistory";

export const dynamic = "force-dynamic";

/** 候補者の社内の状態と担当。「気になる」は stage=interested。⚠️ フラグがオフなら 404 */
export async function PUT(req: NextRequest, { params }: { params: { userId: string } }) {
  if (!isCandidateNotesEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "candidates.notes")) return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  /* ★審査前の会社は、候補者の側からの接点（応募・面談など）がある人だけ（2026-10-26 / 柴さんの判断）。
        選考管理の応募者にはメモを書けるようにし、候補者を探すから接点の無い人に書くことは止める */
  if (!canUseCandidateSearch(ctx) && !(await hasCandidateContact(ctx.tenantId, params.userId))) {
    return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await setCandidateTracking(ctx.tenantId, params.userId, b?.stage ?? null, b && "ownerId" in b ? b.ownerId : undefined);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, tracking: r.data });
}
