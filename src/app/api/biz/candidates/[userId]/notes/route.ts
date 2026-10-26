import { NextRequest, NextResponse } from "next/server";
import { actorFromTenant, canNoteCandidate, canSeeCandidate, permissionDenied } from "@/lib/auth/companyAccess";
import { can } from "@/lib/auth/roles";
import { getTenantContext } from "@/lib/business/dashboard";
import { addCandidateNote, canWriteCandidateNote, getCandidateNotes, isCandidateNotesEnabled } from "@/lib/candidateNotes/server";
import { canUseCandidateSearch } from "@/lib/business/scoutGate";
import { hasCandidateContact } from "@/lib/business/selectionHistory";

export const dynamic = "force-dynamic";

/** 社内メモ（2026-10-10 / 段5）。⚠️ フラグがオフなら 404。その企業の有効な担当者だけ */
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  if (!isCandidateNotesEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  /* ★役割（2026-10-12）。見る … 選考を見られる役割（面接官は担当の候補者だけ）／書く … 採用担当以上（面接官は担当の候補者だけ） */
  const actor = actorFromTenant(ctx);
  if (!(await canSeeCandidate(actor, params.userId))) return permissionDenied();
  /* ★審査前の会社は、候補者の側からの接点（応募・面談など）がある人だけ（2026-10-26 / 柴さんの判断）。
        選考管理の応募者にはメモを書けるようにし、候補者を探すから接点の無い人に書くことは止める */
  if (!canUseCandidateSearch(ctx) && !(await hasCandidateContact(ctx.tenantId, params.userId))) return permissionDenied();
  const [r, writableHere, noteRole] = await Promise.all([
    getCandidateNotes(ctx.tenantId, params.userId), canWriteCandidateNote(ctx.tenantId, params.userId), canNoteCandidate(actor, params.userId),
  ]);
  if (!r) return NextResponse.json({ error: "取得できませんでした" }, { status: 500 });
  /* ★書けない相手でも読める（自社の記録）。画面は writable=false なら入力欄と状態の変更を出さない */
  return NextResponse.json({ ...r, writable: writableHere && noteRole, canTrack: can(ctx.currentPermission, "candidates.notes") });
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  if (!isCandidateNotesEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canNoteCandidate(actorFromTenant(ctx), params.userId))) return permissionDenied();
  /* ★審査前の会社は、候補者の側からの接点（応募・面談など）がある人だけ（2026-10-26 / 柴さんの判断）。
        選考管理の応募者にはメモを書けるようにし、候補者を探すから接点の無い人に書くことは止める */
  if (!canUseCandidateSearch(ctx) && !(await hasCandidateContact(ctx.tenantId, params.userId))) return permissionDenied();
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await addCandidateNote(ctx.tenantId, params.userId, ctx.currentOwnId, b?.body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, id: r.data.id });
}
