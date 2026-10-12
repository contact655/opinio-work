import { NextRequest, NextResponse } from "next/server";
import { actorFromTenant, canNoteCandidate, permissionDenied } from "@/lib/auth/companyAccess";
import { can } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { deleteCandidateNote, isCandidateNotesEnabled } from "@/lib/candidateNotes/server";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { userId: string; noteId: string } }) {
  if (!isCandidateNotesEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  /* ★役割（2026-10-12）。採用担当以上は誰のメモでも消せる。面接官は担当の候補者の、自分が書いたメモだけ */
  if (!can(ctx.currentPermission, "candidates.notes")) {
    if (!(await canNoteCandidate(actorFromTenant(ctx), params.userId))) return permissionDenied();
    const { data: note, error: nErr } = await createAdminClient().from("ow_candidate_notes").select("author_id")
      .eq("id", params.noteId).eq("company_id", ctx.tenantId).maybeSingle();
    if (nErr) console.error("[notes DELETE] author:", nErr.message);
    if (!note || note.author_id !== ctx.currentOwnId) return permissionDenied();
  }
  const r = await deleteCandidateNote(ctx.tenantId, params.userId, params.noteId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
