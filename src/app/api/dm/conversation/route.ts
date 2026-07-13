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

  // 参加者チェック（admin で取得して本人かどうか確認）
  const { data: participant } = await admin
    .from("ow_conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", owMe.id)
    .maybeSingle();

  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

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
