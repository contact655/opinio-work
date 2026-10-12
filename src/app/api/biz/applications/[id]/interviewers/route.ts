import { NextRequest, NextResponse } from "next/server";
import { requireBizAction } from "@/lib/auth/companyAccess";
import { setInterviewer } from "@/lib/business/interviewers";

export const dynamic = "force-dynamic";

/**
 * ★応募の面接担当の付け外し（2026-10-12）。採用担当以上（selection.assignInterviewers）。
 *   POST   { userId } … 付ける（何人でも）
 *   DELETE { userId } … 外す
 * ⚠️ 応募が自社のものか・相手が自社の有効な担当者かは lib/business/interviewers.ts が確かめる。
 */
async function handle(req: NextRequest, id: string, assign: boolean) {
  const a = await requireBizAction("selection.assignInterviewers");
  if (!a.ok) return a.response;
  const b = (await req.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = typeof b?.userId === "string" ? b.userId : "";
  const r = await setInterviewer(a.actor.companyId, id, userId, assign, a.actor.owUserId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, interviewers: r.interviewers });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(req, params.id, true);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(req, params.id, false);
}
