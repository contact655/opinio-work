import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { respondToMessageRequest, type RespondAction } from "@/lib/conversations/messageRequest";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS: readonly RespondAction[] = ["accept", "decline"];

/**
 * ★届いた「メッセージのお願い」に答える（2026-10-09 / 段階3）。
 * body: { action: "accept" | "decline" }
 *
 * ⚠️ 判定と書き込みは `lib/conversations/messageRequest.ts` の1か所。ここに条件を書かない。
 * ⚠️ 断っても送り手には何も伝わらない（通知も出さない）。
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: { action?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const action = body.action as RespondAction;
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const admin = createAdminClient();
  const { data: owMe, error } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[dm/requests] ow_users:", error.message);
  if (!owMe) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const r = await respondToMessageRequest({ conversationId: params.id, recipientId: owMe.id as string, action });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, conversationId: params.id });
}
