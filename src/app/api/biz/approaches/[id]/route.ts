import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { getApproachReplyExcerpt, listSentApproaches } from "@/lib/approaches/server";
import { loadCompanyThread } from "@/lib/conversations/companyThread";
import { PANE_THREAD_RECENT } from "@/lib/constants/companyApproaches";

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
  /* ★返信があれば、やり取りの最新 PANE_THREAD_RECENT 件（2026-10-12 / 柴さんの指示。右欄に吹き出しで出す）。
        ⚠️ 読み込みは /biz/messages と同じ `loadCompanyThread`（会社で絞る・参加者でなければ RLS で読めない）。条件を書き足さない。
        ⚠️ 参加者なら既読が付く（右欄に最新のやり取りを出した＝見た、として /biz/messages と同じ扱い） */
  let thread = null;
  if (r.status === "accepted" && r.conversationId) {
    const t = await loadCompanyThread(r.conversationId, { tenantId: ctx.tenantId, currentOwnId: ctx.currentOwnId });
    if (t) {
      thread = {
        conv: { id: t.conv.id }, isParticipant: t.isParticipant, messagesFailed: t.messagesFailed,
        total: t.messages.length, messages: t.messages.slice(-PANE_THREAD_RECENT),
        approachFirst: t.approachFirst, replyNote: t.replyNote,
      };
    }
  }
  return NextResponse.json({
    id: r.id, createdAt: r.createdAt, senderName: r.senderName, jobTitle: r.jobTitle, reason: r.reason, body: r.body,
    status: r.status, conversationId: r.conversationId, replyExcerpt, thread,
  });
}
