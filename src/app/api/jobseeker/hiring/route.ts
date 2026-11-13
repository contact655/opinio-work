import { NextRequest, NextResponse } from "next/server";
import { currentOwUser } from "@/lib/nextManager/me";
import { getMyHiringRows, setHiring } from "@/lib/nextManager/server";
import { parseHiringInput } from "@/lib/nextManager/constants";

export const dynamic = "force-dynamic";

/**
 * ★Next Manager の「採用中」（2026-11-13）。本人が担当者になっている会社ごとに切り替える。
 * ⚠️ オンにできるのは本人だけ。会社の有効な担当者であることは setHiring が確かめる（論点A）。
 */
export async function GET() {
  const me = await currentOwUser();
  if (!me) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const rows = await getMyHiringRows(me.id);
  if (!rows) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json({ rows });
}

export async function PUT(req: NextRequest) {
  const me = await currentOwUser();
  if (!me) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const parsed = parseHiringInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const r = await setHiring({ owUserId: me.id, companyId: parsed.companyId, isHiring: parsed.isHiring, note: parsed.note, jobIds: parsed.jobIds });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
