import { can } from "@/lib/auth/roles";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { loadCompanyThread, markCompanyThreadRead } from "@/lib/conversations/companyThread";
import { PANE_THREAD_RECENT } from "@/lib/constants/companyApproaches";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ★自社の会話1本のやり取りを PANE_THREAD_RECENT 件ずつ（2026-10-18 / 柴さんの指示。選考管理の右側にメッセージを出すため）。
 *   形は `GET /api/biz/approaches/[id]?thread=1` の `thread` と同じ（`PaneThread` がそのまま使う）。
 *   ?before=<メッセージid> … その1通より前。無ければ最新から。⚠️ 知らない before は空で返す（取り違えたページを足さない）
 *   ?read=0 … 既読を付けずに読む（候補者を探すの右欄と同じ。既読は POST で付ける）
 * ⚠️ 自社の会話か・参加者かの判定は /biz/messages と同じ `loadCompanyThread`（会社で絞る・RLS）。条件を書き足さない。
 *    他社・存在しない id は 404（区別しない）。
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "messages.use")) return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  const url = new URL(req.url);
  const t = await loadCompanyThread(params.id, { tenantId: ctx.tenantId, currentOwnId: ctx.currentOwnId }, { markRead: url.searchParams.get("read") !== "0" });
  if (!t) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  const before = url.searchParams.get("before");
  const end = before ? t.messages.findIndex((m) => m.id === before) : t.messages.length;
  const page = end < 0 ? [] : t.messages.slice(Math.max(0, end - PANE_THREAD_RECENT), end);
  return NextResponse.json({
    thread: {
      conv: { id: t.conv.id }, isParticipant: t.isParticipant, canReply: t.canReply, sendBlocked: t.sendBlocked, messagesFailed: t.messagesFailed,
      total: t.messages.length, messages: page,
      hasMore: end > PANE_THREAD_RECENT,
      firstAt: t.messages[0]?.sent_at ?? null,
      approachFirst: t.approachFirst, replyNote: t.replyNote,
    },
  });
}

/** ★既読にする（入力欄にフォーカス・スクロール・送信したとき）。条件は /biz/messages と同じ `markCompanyThreadRead`（参加者のときだけ） */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "messages.use")) return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  const ok = await markCompanyThreadRead(params.id, { tenantId: ctx.tenantId, currentOwnId: ctx.currentOwnId });
  return NextResponse.json({ ok });
}
