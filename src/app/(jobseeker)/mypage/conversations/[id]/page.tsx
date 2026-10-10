import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ConversationDetailClient, {
  type ConversationDetail,
  type MessageRow,
} from "./ConversationDetailClient";

export const dynamic = "force-dynamic";

/**
 * ★タブの題名に相手の名前を入れる（2026-10-09）。無いとサイト既定の題名になり、
 *   タブを何枚開いても見分けがつかない（一覧の page.tsx と同じ理由）。
 * ⚠️★**参加者でなければ相手の名前を出さない。** 本体と同じ判定（参加者行があるか）を通す。
 *    承認前のお願いの受け手は参加者ではないので、ここでも名前は出ない。
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const fallback: Metadata = { title: { absolute: "メッセージ | OPINIO" }, robots: { index: false, follow: false } };
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return fallback;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fallback;
  const admin = createAdminClient();
  const { data: me } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!me) return fallback;
  const [{ data: part }, { data: conv }] = await Promise.all([
    admin.from("ow_conversation_participants").select("id").eq("conversation_id", params.id).eq("user_id", me.id).maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from("ow_conversations")
      .select("kind, candidate_user_id, partner_user_id, ow_companies(name), partner:ow_users!partner_user_id(name), candidate:ow_users!candidate_user_id(name)")
      .eq("id", params.id).maybeSingle(),
  ]);
  if (!part || !conv) return fallback;
  /* 相手は「自分でない側」。DM は始めた人と相手のどちらからでも開ける */
  const other =
    conv.kind === "direct_message"
      ? (conv.candidate_user_id === me.id ? conv.partner?.name : conv.candidate?.name)
      : conv.ow_companies?.name;
  if (!other) return fallback;
  return { title: { absolute: `${other} とのメッセージ | OPINIO` }, robots: { index: false, follow: false } };
}

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
        `id, kind, stage, status, company_id, candidate_user_id, partner_user_id, request_status,
         ow_companies(name, logo_url, logo_letter),
         partner:ow_users!partner_user_id(name),
         starter:ow_users!candidate_user_id(name)`
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

  /* ★DM の「相手」は見ている人によって変わる（2026-10-11。一覧の page.tsx と同じ判定）。
        受けた側が見ると partner_user_id は自分なので、始めた人を相手にする。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawConv = convResult.data as any;
  const conversation = (rawConv
    ? (() => {
        const { starter, candidate_user_id, ...c } = rawConv;
        return c.kind === "direct_message" && candidate_user_id && candidate_user_id !== owUser.id
          ? { ...c, partner: starter ?? null }
          : c;
      })()
    : null) as ConversationDetail | null;
  const myParticipant = partResult.data as { id: string } | null;

  // Conversation not found or user is not a participant
  if (!conversation || !myParticipant) notFound();

  // Fetch initial messages + mark as read in parallel
  const [msgsResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminSupabase as any)
      .from("ow_conversation_messages")
      .select(
        `id, body, kind, payload, sent_at, sender_participant_id,
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
