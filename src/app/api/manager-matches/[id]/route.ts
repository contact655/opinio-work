import { NextRequest, NextResponse } from "next/server";
import { currentOwUser } from "@/lib/nextManager/me";
import { updateMatchByManager } from "@/lib/nextManager/server";
import { isUuid, parseMatchPatch } from "@/lib/nextManager/constants";

export const dynamic = "force-dynamic";

/** ★面談の記録を保存する（担当マネージャー本人だけ。2026-11-13）。⚠️ 本文に当たる項目は受け取らない */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentOwUser();
  if (!me) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: "記録が見つかりません" }, { status: 404 });
  const parsed = parseMatchPatch(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const r = await updateMatchByManager(params.id, me.id, parsed.patch);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
