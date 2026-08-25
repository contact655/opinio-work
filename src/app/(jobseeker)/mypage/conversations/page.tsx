import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ConversationsClient, { type Conversation } from "./ConversationsClient";
import type { Metadata } from "next";

/* ⚠️ **ログイン後のページにもタイトルを付ける。** 付けないとサイト既定の
      「IT/SaaS業界の転職・求人情報 | OPINIO」になり、**タブを何枚開いても全部同じ名前**で
      見分けがつかない。2026-08-20 の実測で /mypage 配下の3ページが該当した。
   ⚠️ `absolute` にする（ルートの template が `| OPINIO` を足すため）。 */
export const metadata: Metadata = {
  title: { absolute: "メッセージ | OPINIO" },
  robots: { index: false, follow: false },
};


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

  /* ⚠️ **絞り込みはここで必ず書く。RLS に任せない。**
        `createAdminClient()` は service_role なので **RLS が効かない**。
        2026-08-25 まで、ここには「RLS already filters by participant via
        migration 066/067」というコメントを根拠に **条件を1つも付けない select** が
        置かれており、**ログイン中の誰もが他人の会話を、相手企業名・相手ユーザー名・
        最終更新時刻つきで一覧に見ていた**（参加者0件の is_test アカウントで実測。
        本番の会話3件がそのまま出た）。

     ⚠️ 可視性の判定は「**自分の参加者行があるか**」だけにする。詳細ページ
        （`[id]/page.tsx`）が同じ条件で判定し、行が無ければ `notFound()` を返すので、
        条件がずれると**一覧には出るのに開けない行**ができる。

     ⚠️ `ow_conversations.candidate_user_id` / `mentor_user_id` では絞らない。
        あれは「誰の会話か」であって「誰が読んでよいか」ではない。企業担当者は
        参加者行でしか会話に繋がらないため、あの2列で絞ると企業側が読めなくなる。 */
  const { data: myParticipants, error: partError } = await adminSupabase
    .from("ow_conversation_participants")
    .select("id, conversation_id, last_read_at")
    .eq("user_id", owUser.id);

  /* ⚠️ error を捨てない。捨てると権限エラーもクエリ間違いも「0件」に化ける。 */
  if (partError) {
    console.error("[mypage/conversations] 参加者の取得:", partError.message);
  }

  const participantMap = new Map<string, { id: string; last_read_at: string | null }>();
  for (const p of myParticipants ?? []) {
    participantMap.set(p.conversation_id, { id: p.id, last_read_at: p.last_read_at });
  }

  const conversationIds = Array.from(participantMap.keys());

  if (conversationIds.length === 0) {
    return <ConversationsClient initialConversations={[]} initialOpenConvId={null} />;
  }

  // 参加している会話だけを取得（本文の取得もこの範囲に閉じる）
  const [{ data: convData, error: convError }, { data: messages, error: msgError }] =
    await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adminSupabase as any)
        .from("ow_conversations")
        .select(
          `id, kind, stage, status, last_message_at, created_at,
           company_id, mentor_user_id,
           ow_companies(id, name, logo_url, logo_letter),
           mentor:ow_users!mentor_user_id(id, name)`
        )
        .in("id", conversationIds)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adminSupabase as any)
        .from("ow_conversation_messages")
        .select("conversation_id, sender_participant_id, sent_at")
        .in("conversation_id", conversationIds)
        .is("deleted_at", null),
    ]);

  if (convError) {
    console.error("[mypage/conversations] 会話の取得:", convError.message);
  }
  if (msgError) {
    console.error("[mypage/conversations] メッセージの取得:", msgError.message);
  }

  const conversations: Conversation[] = convData ?? [];

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
