import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDmParticipants } from "@/lib/conversations/participants";

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

  /* 参加者を冪等に揃える。
     ⚠️ **自分のぶんだけ作らない。** 相手の参加者行が無いと、相手の一覧に
        この会話が出ない（可視性は参加者行で決まる）ため、相手からは
        永久に開けない。会話行だけが残った過去のデータは、
        どちらかがここを通れば揃う。
     ⚠️ 失敗を握りつぶさない。2026-08-25 まで INSERT の error を捨てており、
        `myParticipantId: null` を返して**入力欄だけが動く**状態になっていた。 */
  const participants = await ensureDmParticipants(admin, conversationId, [
    owMe.id,
    conv.candidate_user_id,
    conv.mentor_user_id,
  ]);
  if (!participants.ok) {
    console.error("[dm/conversation] ensureDmParticipants:", participants.error);
    return NextResponse.json({ error: participants.error }, { status: participants.status });
  }

  const myParticipantId = participants.byUserId.get(owMe.id) ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (admin as any)
    .from("ow_conversation_messages")
    .select(`id, body, sent_at, sender_participant_id, ow_conversation_participants!sender_participant_id(ow_users(name))`)
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("sent_at", { ascending: true });

  return NextResponse.json({
    messages: messages ?? [],
    myParticipantId,
    myName: owMe.name,
  });
}
