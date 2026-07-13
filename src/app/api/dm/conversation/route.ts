import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("id");
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!conversationId || !UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { data: owMe } = await supabase.from("ow_users").select("id, name").eq("auth_id", authUser.id).maybeSingle();
  if (!owMe) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // 会話が存在し、かつ自分が candidate_user_id または mentor_user_id であることを確認
  const { data: conv } = await admin
    .from("ow_conversations")
    .select("id, candidate_user_id, mentor_user_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const isMember = conv.candidate_user_id === owMe.id || conv.mentor_user_id === owMe.id;
  if (!isMember) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  // participant レコードを取得（なければ自動作成）
  let { data: participant } = await admin
    .from("ow_conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", owMe.id)
    .maybeSingle();

  if (!participant) {
    const role = conv.candidate_user_id === owMe.id ? "initiator" : "recipient";
    const { data: created } = await admin
      .from("ow_conversation_participants")
      .insert({ conversation_id: conversationId, user_id: owMe.id, role })
      .select("id")
      .single();
    participant = created;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (admin as any)
    .from("ow_conversation_messages")
    .select(`id, body, sent_at, sender_participant_id, ow_conversation_participants!sender_participant_id(role, ow_users(name))`)
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("sent_at", { ascending: true });

  return NextResponse.json({
    messages: messages ?? [],
    myParticipantId: participant.id,
    myName: owMe.name,
  });
}
