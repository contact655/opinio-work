import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ConversationDetailClient, {
  type ConversationDetail,
  type MessageRow,
} from "./ConversationDetailClient";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id: conversationId } = params;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=/mypage/conversations/${conversationId}`);

  const adminSupabase = createAdminClient();

  const { data: owUser } = await adminSupabase
    .from("ow_users")
    .select("id, name")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!owUser) redirect("/auth?next=/mypage/conversations");

  // Fetch conversation, participant check, and messages in parallel
  const [convResult, partResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminSupabase as any)
      .from("ow_conversations")
      .select(
        `id, kind, stage, status, company_id, mentor_user_id,
         ow_companies(name, logo_url, logo_letter),
         mentor:ow_users!mentor_user_id(name)`
      )
      .eq("id", conversationId)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminSupabase as any)
      .from("ow_conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", owUser.id)
      .maybeSingle(),
  ]);

  const conversation = convResult.data as ConversationDetail | null;
  const myParticipant = partResult.data as { id: string } | null;

  // Conversation not found or user is not a participant
  if (!conversation || !myParticipant) notFound();

  // Fetch initial messages + mark as read in parallel
  const [msgsResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminSupabase as any)
      .from("ow_conversation_messages")
      .select(
        `id, body, sent_at, sender_participant_id,
         ow_conversation_participants!sender_participant_id(
           role,
           ow_users(name)
         )`
      )
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("sent_at", { ascending: true }),
    // Mark as read (best-effort, don't block render)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminSupabase as any)
      .from("ow_conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("id", myParticipant.id),
  ]);

  const messages = (msgsResult.data as MessageRow[]) ?? [];
  const myUserName = owUser.name ?? user.email?.split("@")[0] ?? null;

  return (
    <ConversationDetailClient
      conversationId={conversationId}
      initialConversation={conversation}
      initialMessages={messages}
      initialMyParticipantId={myParticipant.id}
      myUserName={myUserName}
    />
  );
}
