import { can } from "@/lib/auth/roles";
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
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "messages.use")) return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  const list = await listSentApproaches(ctx.tenantId);
  if (!list) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  const r = list.find((x) => x.id === params.id);
  if (!r) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  /* ★返信があれば冒頭だけ（右欄の吹き出しの下に出す）。⚠️ 自社の1件と確かめた後の conversationId だけを渡す */
  const replyExcerpt = r.status === "accepted" && r.conversationId ? await getApproachReplyExcerpt(r.conversationId, r.candidate.id) : null;
  /* ★やり取りを PANE_THREAD_RECENT 件ずつ（欄に出すときだけ。?thread=1）。2026-10-12 に「直近10通＋上へスクロールで前の10通」にした。
        ?before=<メッセージid> … その1通より前の PANE_THREAD_RECENT 件（上へスクロールしたとき）。無ければ最新から。
        ⚠️ 読み込みは /biz/messages と同じ `loadCompanyThread`（会社で絞る・参加者でなければ RLS で読めない）。条件を書き足さない。
        ⚠️ 参加者なら既読が付く（欄に出して見た＝見た、として /biz/messages と同じ扱い）。閉じているあいだは呼ばない。
        ⚠️ 知らない before（別の会話の id など）は最新から返さずに空で返す（取り違えたページを足さないため） */
  let thread = null;
  const url = new URL(req.url);
  if (r.status === "accepted" && r.conversationId && url.searchParams.get("thread") === "1") {
    /* ★`?read=0` … 既読を付けずに読む（2026-10-13。候補者を探すの右欄。既読は POST …/read で付ける）。省略時は今までどおり付ける */
    const markRead = url.searchParams.get("read") !== "0";
    const t = await loadCompanyThread(r.conversationId, { tenantId: ctx.tenantId, currentOwnId: ctx.currentOwnId }, { markRead });
    if (t) {
      const before = url.searchParams.get("before");
      const end = before ? t.messages.findIndex((m) => m.id === before) : t.messages.length;
      const page = end < 0 ? [] : t.messages.slice(Math.max(0, end - PANE_THREAD_RECENT), end);
      thread = {
        conv: { id: t.conv.id }, isParticipant: t.isParticipant, canReply: t.canReply, sendBlocked: t.sendBlocked, messagesFailed: t.messagesFailed,
        total: t.messages.length, messages: page,
        /* 前にまだあるか（上端に「ここからやり取りが始まりました」を出すかどうか） */
        hasMore: end > PANE_THREAD_RECENT,
        firstAt: t.messages[0]?.sent_at ?? null,
        approachFirst: t.approachFirst, replyNote: t.replyNote,
      };
    }
  }
  return NextResponse.json({
    id: r.id, createdAt: r.createdAt, senderName: r.senderName, jobTitle: r.jobTitle, reason: r.reason, body: r.body,
    status: r.status, conversationId: r.conversationId, replyExcerpt, thread,
  });
}
