import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { getApproachReplyExcerpt, listSentApproaches } from "@/lib/approaches/server";

export const dynamic = "force-dynamic";

/**
 * ★自社が送ったメッセージ1件の中身（2026-10-11。候補者を探すの右欄の「送った内容を見る」）。
 * ⚠️ /biz/messages と同じ取得（`listSentApproaches`）から自社の1件を選ぶだけ。条件を書き足さない。
 * ⚠️ 他社・存在しない id は 404（区別しない）。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const list = await listSentApproaches(ctx.tenantId);
  if (!list) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  const r = list.find((x) => x.id === params.id);
  if (!r) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  /* ★返信があれば冒頭だけ（右欄の吹き出しの下に出す）。⚠️ 自社の1件と確かめた後の conversationId だけを渡す */
  const replyExcerpt = r.status === "accepted" && r.conversationId ? await getApproachReplyExcerpt(r.conversationId, r.candidate.id) : null;
  return NextResponse.json({
    id: r.id, createdAt: r.createdAt, senderName: r.senderName, jobTitle: r.jobTitle, reason: r.reason, body: r.body,
    status: r.status, conversationId: r.conversationId, replyExcerpt,
  });
}
