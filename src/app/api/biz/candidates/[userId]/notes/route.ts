import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { addCandidateNote, canWriteCandidateNote, getCandidateNotes, isCandidateNotesEnabled } from "@/lib/candidateNotes/server";

export const dynamic = "force-dynamic";

/** 社内メモ（2026-10-10 / 段5）。⚠️ フラグがオフなら 404。その企業の有効な担当者だけ */
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  if (!isCandidateNotesEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [r, writable] = await Promise.all([getCandidateNotes(ctx.tenantId, params.userId), canWriteCandidateNote(ctx.tenantId, params.userId)]);
  if (!r) return NextResponse.json({ error: "取得できませんでした" }, { status: 500 });
  /* ★書けない相手でも読める（自社の記録）。画面は writable=false なら入力欄と状態の変更を出さない */
  return NextResponse.json({ ...r, writable });
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  if (!isCandidateNotesEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await addCandidateNote(ctx.tenantId, params.userId, ctx.currentOwnId, b?.body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, id: r.data.id });
}
