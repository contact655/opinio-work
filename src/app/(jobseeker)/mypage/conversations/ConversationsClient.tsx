"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils/formatRelativeTime";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";

export type Conversation = {
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
  hasUnread?: boolean;
};

export default function ConversationsClient({
  initialConversations,
}: {
  initialConversations: Conversation[];
}) {
  const [conversations] = useState<Conversation[]>(initialConversations);

  const retryFetch = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <MypageLayout activeKey="conversations">
      <h1 style={{
        fontFamily: '"Noto Serif JP", serif', fontSize: 22, fontWeight: 700,
        color: "var(--ink)", marginBottom: 24,
      }}>対話一覧</h1>

      {conversations.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--line)", padding: "40px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>まだ対話がありません</p>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.75, marginBottom: 24 }}>
            気になる企業の在籍ユーザーにDMを送るか、<br />
            カジュアル面談を申し込んで対話を始めましょう。
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", background: "var(--royal)", color: "#fff",
              borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              企業を見てDMする
            </Link>
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px",
              border: "1.5px solid var(--royal-100)", background: "var(--royal-50)", color: "var(--royal)",
              borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>
              カジュアル面談を申し込む
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => {
            const company = conv.ow_companies;
            const displayName =
              conv.kind === "direct_message"
                ? conv.mentor?.name ?? "ユーザー"
                : conv.kind === "mentor"
                ? conv.mentor?.name ?? "対話相手"
                : company?.name ?? "(企業情報なし)";

            const hasMessages = conv.last_message_at !== null;
            const displayDate = hasMessages ? formatRelativeTime(conv.last_message_at!) : null;
            const hasUnread = conv.hasUnread ?? false;

            return (
              <Link
                key={conv.id}
                href={`/mypage/conversations/${conv.id}`}
                className="block"
                aria-label={hasUnread ? `${displayName}（未読あり）` : displayName}
              >
                <div className={`bg-white rounded-card border p-4 transition-all duration-150 flex items-center gap-4 ${
                  hasUnread
                    ? "border-primary shadow-card-hover"
                    : "border-card-border hover:border-primary hover:shadow-card-hover"
                }`}>
                  {conv.kind === "direct_message" ? (
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 700, color: "#fff",
                    }}>
                      {displayName[0] ?? "?"}
                    </div>
                  ) : company?.logo_url ? (
                    <img src={company.logo_url} alt={company.name} loading="lazy"
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                      {company?.logo_letter ?? company?.name?.[0] ?? displayName[0] ?? "?"}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className={`text-sm truncate ${hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                        {displayName}
                      </span>
                      {conv.kind === "direct_message" && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 100, flexShrink: 0,
                          background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
                          letterSpacing: "0.05em",
                        }}>DM</span>
                      )}
                    </div>
                    {displayDate ? (
                      <div className="text-xs text-gray-400 mt-0.5 tabular-nums">{displayDate}</div>
                    ) : (
                      <div className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>これから対話</div>
                    )}
                  </div>

                  {hasUnread && (
                    <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-primary" aria-label="未読あり" title="未読あり" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* リロードボタン（エラー時用）*/}
      <button
        type="button"
        onClick={retryFetch}
        style={{ display: "none" }}
        id="conversations-retry"
      />
    </MypageLayout>
  );
}
