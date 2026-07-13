import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetUserId = request.nextUrl.searchParams.get("targetUserId");
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!targetUserId || !UUID_RE.test(targetUserId)) {
    return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  }

  const { data: owMe } = await supabase.from("ow_users").select("id, name").eq("auth_id", authUser.id).maybeSingle();
  if (!owMe) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // 既存会話を探す（双方向）
  const { data: conv1 } = await admin.from("ow_conversations").select("id").eq("kind", "direct_message").eq("candidate_user_id", owMe.id).eq("mentor_user_id", targetUserId).maybeSingle();
  const { data: conv2 } = await admin.from("ow_conversations").select("id").eq("kind", "direct_message").eq("candidate_user_id", targetUserId).eq("mentor_user_id", owMe.id).maybeSingle();
  const conv = conv1 || conv2;

  if (!conv) return NextResponse.json({ conversation: null });

  const { data: participant } = await admin.from("ow_conversation_participants").select("id").eq("conversation_id", conv.id).eq("user_id", owMe.id).maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (admin as any)
    .from("ow_conversation_messages")
    .select(`id, body, sent_at, sender_participant_id, ow_conversation_participants!sender_participant_id(role, ow_users(name))`)
    .eq("conversation_id", conv.id)
    .is("deleted_at", null)
    .order("sent_at", { ascending: true });

  return NextResponse.json({
    conversation: { id: conv.id, myParticipantId: participant?.id ?? null, myName: owMe.name },
    messages: messages ?? [],
  });
}

export async function POST(request: NextRequest) {
  const allowed = await checkRateLimit(request, { limit: 20, windowSec: 3600, prefix: "dm" });
  if (!allowed) return NextResponse.json({ error: "リクエストが多すぎます。しばらくしてから再試行してください。" }, { status: 429 });

  const supabase = createClient();
  const admin = createAdminClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { targetUserId: string; message: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { targetUserId, message } = body;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!targetUserId || !UUID_RE.test(targetUserId) || !message?.trim()) {
    return NextResponse.json({ error: "targetUserId and message are required" }, { status: 400 });
  }
  if (message.trim().length > 2000) {
    return NextResponse.json({ error: "メッセージは2000文字以内で入力してください" }, { status: 400 });
  }

  // ow_users.id (app UUID) for the current auth user
  const { data: owMe } = await supabase
    .from("ow_users")
    .select("id, name")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (!owMe) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  if (owMe.id === targetUserId) {
    return NextResponse.json({ error: "Cannot DM yourself" }, { status: 400 });
  }

  // Check target user exists and has public visibility
  const { data: targetUser } = await admin
    .from("ow_users")
    .select("id, name, visibility")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!targetUser || targetUser.visibility === "private" || targetUser.visibility === "login_only") {
    return NextResponse.json({ error: "User not found or not accepting messages" }, { status: 404 });
  }

  // Check if DM conversation already exists between these two users
  const { data: existing } = await admin
    .from("ow_conversations")
    .select("id")
    .eq("kind", "direct_message")
    .eq("candidate_user_id", owMe.id)
    .eq("mentor_user_id", targetUserId)
    .maybeSingle();

  // Also check reverse direction
  const { data: existingReverse } = await admin
    .from("ow_conversations")
    .select("id")
    .eq("kind", "direct_message")
    .eq("candidate_user_id", targetUserId)
    .eq("mentor_user_id", owMe.id)
    .maybeSingle();

  const existingConv = existing || existingReverse;

  if (existingConv) {
    // Add new message to existing conversation
    const { data: existingParticipant } = await admin
      .from("ow_conversation_participants")
      .select("id")
      .eq("conversation_id", existingConv.id)
      .eq("user_id", owMe.id)
      .maybeSingle();

    if (existingParticipant) {
      await admin.from("ow_conversation_messages").insert({
        conversation_id: existingConv.id,
        sender_participant_id: existingParticipant.id,
        body: message.trim(),
      });
      await admin
        .from("ow_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", existingConv.id);
    }

    return NextResponse.json({ conversationId: existingConv.id });
  }

  // Create new DM conversation
  const { data: conv, error: convErr } = await admin
    .from("ow_conversations")
    .insert({
      kind: "direct_message",
      stage: "active",
      status: "active",
      candidate_user_id: owMe.id,
      mentor_user_id: targetUserId,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (convErr || !conv) {
    console.error("[dm/start] conv insert error:", convErr);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }

  // Add both participants
  const { data: participants, error: partErr } = await admin
    .from("ow_conversation_participants")
    .insert([
      { conversation_id: conv.id, user_id: owMe.id, role: "initiator" },
      { conversation_id: conv.id, user_id: targetUserId, role: "recipient" },
    ])
    .select("id, user_id");

  if (partErr || !participants) {
    console.error("[dm/start] participants insert error:", partErr);
    return NextResponse.json({ error: "Failed to add participants" }, { status: 500 });
  }

  const myParticipant = participants.find((p) => p.user_id === owMe.id);

  // Insert first message
  if (myParticipant) {
    await admin.from("ow_conversation_messages").insert({
      conversation_id: conv.id,
      sender_participant_id: myParticipant.id,
      body: message.trim(),
    });
  }

  return NextResponse.json({ conversationId: conv.id }, { status: 201 });
}
