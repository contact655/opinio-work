import { NextRequest, NextResponse } from "next/server";
import { currentOwUser } from "@/lib/nextManager/me";
import { getPanelForConversation } from "@/lib/nextManager/server";
import { isUuid } from "@/lib/nextManager/constants";

export const dynamic = "force-dynamic";

/**
 * ★メッセージ画面の「面談の記録」（2026-11-13）。担当マネージャー本人にだけ記録を返す。
 *   それ以外（求職者・会社を外れたマネージャー）には { panel: null }（＝欄を出さない）。
 * ⚠️ 本文は返さない。
 */
export async function GET(req: NextRequest) {
  const me = await currentOwUser();
  if (!me) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!isUuid(conversationId)) return NextResponse.json({ error: "会話が正しくありません" }, { status: 400 });
  const panel = await getPanelForConversation(conversationId, me.id);
  return NextResponse.json({ panel }, { headers: { "Cache-Control": "private, no-store" } });
}
