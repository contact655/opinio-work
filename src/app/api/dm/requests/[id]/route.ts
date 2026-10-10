import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { replyToMessageRequest, respondToMessageRequest, type RespondAction } from "@/lib/conversations/messageRequest";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS: readonly (RespondAction | "reply")[] = ["reply", "decline", "block", "report"];

/**
 * ★届いたメッセージリクエストに答える（2026-10-09 / 段階3。2026-10-11 に「承認」をやめ、返信・ブロック・報告を足した）。
 * body: { action: "reply", body } | { action: "decline" } | { action: "block" } | { action: "report", note? }
 * ⚠️ reply は DB 関数 `reply_to_message_request` の1トランザクション（`replyToMessageRequest`）。
 *
 * ⚠️ 判定と書き込みは `lib/conversations/messageRequest.ts` の1か所。ここに条件を書かない。
 * ⚠️ 見送り・ブロックは送り手に何も伝わらない（通知も出さない）。
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: { action?: unknown; body?: unknown; note?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const action = body.action as RespondAction | "reply";
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const admin = createAdminClient();
  const { data: owMe, error } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[dm/requests] ow_users:", error.message);
  if (!owMe) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (action === "reply") {
    const rr = await replyToMessageRequest({ conversationId: params.id, recipientId: owMe.id as string, body: typeof body.body === "string" ? body.body : "" });
    if (!rr.ok) return NextResponse.json({ error: rr.error }, { status: rr.status });
    return NextResponse.json({ ok: true, conversationId: rr.conversationId });
  }
  const r = await respondToMessageRequest({ conversationId: params.id, recipientId: owMe.id as string, action, note: typeof body.note === "string" ? body.note : null });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, conversationId: params.id });
}
