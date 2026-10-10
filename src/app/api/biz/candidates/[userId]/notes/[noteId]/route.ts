import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { deleteCandidateNote, isCandidateNotesEnabled } from "@/lib/candidateNotes/server";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { userId: string; noteId: string } }) {
  if (!isCandidateNotesEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await deleteCandidateNote(ctx.tenantId, params.userId, params.noteId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
