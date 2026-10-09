import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import { CONTACT_BLOCKED_MESSAGE, isMessagingBlocked } from "@/lib/conversations/contactGate";
import {
  getDmState,
  getRequestQuota,
  quotaBlockMessage,
  sendMessageRequest,
  stateBlockMessage,
} from "@/lib/conversations/messageRequest";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ★DM の入口（`/u/[id]` の「メッセージ」ボタン）。2026-10-09 に「メッセージのお願い」へ作り替えた（段階3）。
 *
 * - GET  … 相手とのあいだの段と、送り手の残り枠を返す（ボタンが「開く／書く／止まる」を決める）
 * - POST … お願いを送る（本文が必須）。判定と書き込みは `lib/conversations/messageRequest.ts`
 *
 * ⚠️★**空の会話を作らない。** 以前はボタンを押しただけで本文の無い会話ができていた
 *    （本番の DM 3件はすべてそれだった）。
 * ⚠️★GET は**本文を返さない。** 以前は既存の会話のメッセージまで返していたが、受け手が
 *    承認前に本文を読めてしまう。
 * ⚠️ 止めた理由のうち相手に関わるものは返さない（`CONTACT_BLOCKED_MESSAGE`）。
 */

async function resolveMe() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: owMe } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  return (owMe?.id as string | undefined) ?? null;
}

async function targetExists(targetUserId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("ow_users").select("id, visibility").eq("id", targetUserId).maybeSingle();
  return !!data && data.visibility !== "private";
}

export async function GET(request: NextRequest) {
  const meId = await resolveMe();
  if (!meId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetUserId = request.nextUrl.searchParams.get("targetUserId");
  if (!targetUserId || !UUID_RE.test(targetUserId)) {
    return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  }
  if (targetUserId === meId || !(await targetExists(targetUserId))) {
    return NextResponse.json({ error: CONTACT_BLOCKED_MESSAGE }, { status: 404 });
  }

  const state = await getDmState(meId, targetUserId);
  if (!state) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });

  /* 承認済み・自分が送ったお願いは、その会話を開く（自分の会話なので開いてよい） */
  if (state.kind === "accepted" || state.kind === "outgoing_pending") {
    return NextResponse.json({ action: "open", conversationId: state.conversationId });
  }
  /* 相手からのお願いが届いている／自分が断った */
  const stateMsg = stateBlockMessage(state);
  if (stateMsg) {
    return NextResponse.json({
      action: state.kind === "incoming_pending" ? "incoming" : "blocked",
      message: stateMsg,
    });
  }

  /* これから送る。⚠️ 相手に関わる理由で止まるなら、書かせる前に止める */
  if (await isMessagingBlocked(meId, targetUserId)) {
    return NextResponse.json({ action: "blocked", message: CONTACT_BLOCKED_MESSAGE });
  }
  const quota = await getRequestQuota(meId);
  if (!quota) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  const quotaMsg = quotaBlockMessage(quota);
  if (quotaMsg) return NextResponse.json({ action: "blocked", message: quotaMsg });

  return NextResponse.json({ action: "compose", quota });
}

export async function POST(request: NextRequest) {
  const allowed = await checkRateLimit(request, { limit: 20, windowSec: 3600, prefix: "dm" });
  if (!allowed) return NextResponse.json({ error: "リクエストが多すぎます。しばらくしてから再試行してください。" }, { status: 429 });

  const meId = await resolveMe();
  if (!meId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { targetUserId?: unknown; message?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
  if (!UUID_RE.test(targetUserId)) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }
  if (!(await targetExists(targetUserId))) {
    return NextResponse.json({ error: CONTACT_BLOCKED_MESSAGE }, { status: 404 });
  }

  const result = await sendMessageRequest({
    senderId: meId,
    recipientId: targetUserId,
    body: typeof body.message === "string" ? body.message : "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ conversationId: result.conversationId }, { status: 201 });
}
