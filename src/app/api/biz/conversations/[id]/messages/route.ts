import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { insertActivity } from "@/lib/business/activities";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const conversationId = params.id;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const supabase = createClient();

  // ── Auth check ─────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Body validation ────────────────────────────────────────────────────────
  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messageBody = body.message?.trim() ?? "";
  if (!messageBody) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (messageBody.length > 5000) {
    return NextResponse.json(
      { error: "message too long (max 5000 chars)" },
      { status: 400 }
    );
  }

  // ── Resolve ow_users.id from auth.uid() ───────────────────────────────────
  // auth.uid() is auth.users.id (Supabase Auth UUID space)
  // ow_users.id is the app-level UUID — different spaces
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!owUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── Participant check ──────────────────────────────────────────────────────
  // The sender must be an active participant of this conversation.
  // ow_conversation_messages INSERT RLS also enforces this, but we check early
  // to return a clear 403 rather than a generic Supabase error.
  const { data: participant } = await supabase
    .from("ow_conversation_participants")
    .select("id, role")
    .eq("conversation_id", conversationId)
    .eq("user_id", owUser.id)
    .is("left_at", null)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json(
      { error: "Not a participant of this conversation" },
      { status: 403 }
    );
  }

  // ── INSERT message ─────────────────────────────────────────────────────────
  const now = new Date().toISOString();

  const { data: newMsg, error: insertError } = await supabase
    .from("ow_conversation_messages")
    .insert({
      conversation_id: conversationId,
      sender_participant_id: participant.id,
      body: messageBody,
      sent_at: now,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error(
      "[conversations/messages POST] insert error:",
      insertError.message
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // ── UPDATE last_message_at (best-effort) ───────────────────────────────────
  // migration 072 fixed ow_conversations UPDATE RLS UUID mismatch.
  // If this still fails due to RLS, we log and continue (non-blocking).
  try {
    const { error: updateError } = await supabase
      .from("ow_conversations")
      .update({ last_message_at: now })
      .eq("id", conversationId);

    if (updateError) {
      console.warn(
        "[conversations/messages POST] last_message_at update failed:",
        updateError.message
      );
    }
  } catch (e) {
    console.warn("[conversations/messages POST] last_message_at update threw:", e);
  }

  // ── Activity: message_sent / message_received (best-effort) ─────────────
  /* participant.role: "company_admin" = biz側が送信 / "candidate" = 求職者が送信
     ⚠️ 2026-08-25 まで `=== "company"` と比べていたが、
        `ow_conversation_participants_role_check` に `'company'` は無く
        （許容は candidate / company_admin / mentor / editor / operator）、
        **常に false**。企業が送ったメッセージまで
        「候補者からメッセージが届きました」と記録されていた。
        企業担当者の role を入れているのは
        `POST /api/biz/conversations/[id]/join` で、値は `company_admin`。 */
  try {
    const { data: conv } = await supabase
      .from("ow_conversations")
      .select("company_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (conv?.company_id) {
      const isCompanySender = participant.role === "company_admin";
      await insertActivity(supabase, {
        company_id: conv.company_id,
        actor_user_id: owUser.id,
        type: isCompanySender ? "message_sent" : "message_received",
        description: isCompanySender
          ? "候補者にメッセージを送りました"
          : "候補者からメッセージが届きました",
        target_type: "conversation",
        target_id: conversationId,
      });
    }
  } catch (e) {
    console.warn("[conversations/messages] insertActivity failed:", e);
  }

  // ── Revalidate detail page ─────────────────────────────────────────────────
  revalidatePath(`/biz/conversations/${conversationId}`);

  return NextResponse.json({ ok: true, id: newMsg.id });
}
