import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ConversationsClient, { type Conversation } from "./ConversationsClient";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams?: { open?: string };
}) {
  const initialOpenConvId = searchParams?.open ?? null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/conversations");

  const adminSupabase = createAdminClient();

  // Resolve ow_users.id from auth_id
  const { data: owUser } = await adminSupabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!owUser) {
    return <ConversationsClient initialConversations={[]} initialOpenConvId={null} />;
  }

  // Fetch conversations (RLS already filters by participant via migration 066/067)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: convData } = await (adminSupabase as any)
    .from("ow_conversations")
    .select(
      `id, kind, stage, status, last_message_at, created_at,
       company_id, mentor_user_id,
       ow_companies(id, name, logo_url, logo_letter),
       mentor:ow_users!mentor_user_id(id, name)`
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const conversations: Conversation[] = convData ?? [];
  const conversationIds = conversations.map((c) => c.id);

  if (conversationIds.length === 0) {
    return <ConversationsClient initialConversations={[]} initialOpenConvId={null} />;
  }

  // Fetch unread state: participants + messages in parallel
  const [{ data: myParticipants }, { data: messages }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminSupabase as any)
      .from("ow_conversation_participants")
      .select("id, conversation_id, last_read_at")
      .eq("user_id", owUser.id)
      .in("conversation_id", conversationIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminSupabase as any)
      .from("ow_conversation_messages")
      .select("conversation_id, sender_participant_id, sent_at")
      .in("conversation_id", conversationIds)
      .is("deleted_at", null),
  ]);

  const participantMap = new Map<string, { id: string; last_read_at: string | null }>();
  for (const p of myParticipants ?? []) {
    participantMap.set(p.conversation_id, { id: p.id, last_read_at: p.last_read_at });
  }

  const conversationsWithUnread = conversations.map((conv) => {
    const myPart = participantMap.get(conv.id);
    if (!myPart) return { ...conv, hasUnread: false };
    const hasUnread = (messages ?? []).some(
      (m: { conversation_id: string; sender_participant_id: string | null; sent_at: string }) =>
        m.conversation_id === conv.id &&
        m.sender_participant_id !== myPart.id &&
        (!myPart.last_read_at || new Date(m.sent_at) > new Date(myPart.last_read_at))
    );
    return { ...conv, hasUnread };
  });

  return <ConversationsClient initialConversations={conversationsWithUnread} initialOpenConvId={initialOpenConvId} />;
}
