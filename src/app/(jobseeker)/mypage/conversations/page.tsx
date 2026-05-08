"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils/formatRelativeTime";
import Link from "next/link";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";

type Conversation = {
  id: string;
  kind: string;
  stage: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  company_id: string | null;
  mentor_user_id: string | null;
  ow_companies: {
    id: string;
    name: string;
    logo_url: string | null;
    logo_letter: string | null;
  } | null;
  mentor: {
    id: string;
    name: string;
  } | null;
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hasUnreadMap, setHasUnreadMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!owUser) {
      setLoading(false);
      return;
    }

    // RLS (migration 066 + 067) filters by owUser.id via ow_conversation_participants
    // No explicit .eq() needed — RLS handles it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: fetchError } = await (supabase as any)
      .from("ow_conversations")
      .select(
        `id, kind, stage, status, last_message_at, created_at,
         company_id, mentor_user_id,
         ow_companies(id, name, logo_url, logo_letter),
         mentor:ow_users!mentor_user_id(id, name)`
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setConversations((data as Conversation[]) || []);

      const conversationIds = (data ?? []).map((c: Conversation) => c.id);
      if (conversationIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: myParticipants, error: partError } = await (supabase as any)
          .from("ow_conversation_participants")
          .select("id, conversation_id, last_read_at")
          .eq("user_id", owUser.id)
          .in("conversation_id", conversationIds);

        if (partError) {
          console.error("[Step 4-3 E] participants fetch failed:", partError.message);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: messages, error: msgError } = await (supabase as any)
          .from("ow_conversation_messages")
          .select("conversation_id, sender_participant_id, sent_at")
          .in("conversation_id", conversationIds)
          .is("deleted_at", null);

        if (msgError) {
          console.error("[Step 4-3 E] messages fetch failed:", msgError.message);
        }

        const participantMap = new Map<string, { id: string; last_read_at: string | null }>();
        for (const p of myParticipants ?? []) {
          participantMap.set(p.conversation_id, { id: p.id, last_read_at: p.last_read_at });
        }

        const nextUnreadMap = new Map<string, boolean>();
        for (const convId of conversationIds) {
          const myPart = participantMap.get(convId);
          if (!myPart) { nextUnreadMap.set(convId, false); continue; }
          const hasUnread = (messages ?? []).some(
            (m: { conversation_id: string; sender_participant_id: string | null; sent_at: string }) =>
              m.conversation_id === convId &&
              m.sender_participant_id !== myPart.id &&
              (!myPart.last_read_at || new Date(m.sent_at) > new Date(myPart.last_read_at))
          );
          nextUnreadMap.set(convId, hasUnread);
        }
        setHasUnreadMap(nextUnreadMap);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <MypageLayout activeKey="conversations">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>読み込み中...</p>
        </div>
      </MypageLayout>
    );
  }

  return (
    <MypageLayout activeKey="conversations">
      <h1 style={{
        fontFamily: '"Noto Serif JP", serif', fontSize: 22, fontWeight: 700,
        color: "var(--ink)", marginBottom: 24,
      }}>対話一覧</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="bg-white rounded-card border border-card-border p-8 text-center">
          <p className="text-gray-600 text-lg mb-4">まだ対話がありません</p>
          <Link href="/jobs" className="text-primary hover:underline text-sm">
            求人を探す →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => {
            const company = conv.ow_companies;
            const displayName =
              conv.kind === "mentor"
                ? conv.mentor?.name ?? "メンター"
                : company?.name ?? "(企業情報なし)";

            // last_message_at が null = メッセージ未着。created_at へのフォールバックを停止し
            // 「これから対話」固定テキストを表示する（フォールバック時の誤解を防ぐ hotfix）
            const hasMessages = conv.last_message_at !== null;
            const displayDate = hasMessages
              ? formatRelativeTime(conv.last_message_at!)
              : null;
            const hasUnread = hasUnreadMap.get(conv.id) ?? false;

            return (
              <Link key={conv.id} href={`/mypage/conversations/${conv.id}`} className="block">
                <div
                  className={`bg-white rounded-card border p-4 transition-all duration-150 flex items-center gap-4 ${
                    hasUnread
                      ? "border-primary shadow-card-hover"
                      : "border-card-border hover:border-primary hover:shadow-card-hover"
                  }`}
                >
                  {/* Logo / Avatar */}
                  {company?.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={company.name}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                      {company?.logo_letter ?? company?.name?.[0] ?? displayName[0] ?? "?"}
                    </div>
                  )}

                  {/* Name + date */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate ${
                        hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
                      }`}
                    >
                      {displayName}
                    </div>
                    {displayDate ? (
                      <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
                        {displayDate}
                      </div>
                    ) : (
                      // last_message_at = null: メッセージ未着状態
                      <div className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                        これから対話
                      </div>
                    )}
                  </div>

                  {/* 未読インジケーター */}
                  {hasUnread && (
                    <div
                      className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-primary"
                      aria-label="未読あり"
                      title="未読あり"
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </MypageLayout>
  );
}
