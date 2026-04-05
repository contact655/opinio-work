"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────

type Thread = {
  id: string;
  company_id: string;
  candidate_id: string;
  company_name: string;
  status: string;
  last_message: string | null;
  unread_count: number;
  updated_at: string;
  company_logo: string | null;
  company_brand_color: string;
};

type Message = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_type: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

// ─── Constants ───────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  casual_requested: { label: "申込み済み", bg: "#E6F1FB", color: "#185FA5" },
  schedule_adjusting: { label: "日程調整中", bg: "#FAEEDA", color: "#854F0B" },
  casual_confirmed: { label: "面談確定", bg: "#E1F5EE", color: "#0F6E56" },
  interviewing: { label: "選考中", bg: "#E6F1FB", color: "#185FA5" },
  offer: { label: "内定", bg: "#FCEBEB", color: "#A32D2D" },
  rejected: { label: "見送り", bg: "#F1EFE8", color: "#5F5E5A" },
};

const STEPS = ["気になる", "申込み", "日程調整", "面談", "選考", "内定"];
const STATUS_TO_STEP: Record<string, number> = {
  casual_requested: 1,
  schedule_adjusting: 2,
  casual_confirmed: 3,
  interviewing: 4,
  offer: 5,
  rejected: -1,
};

const QUICK_REPLIES: Record<string, string[]> = {
  schedule_adjusting: [
    "4/8（火）14:00でお願いします！",
    "4/9（水）11:00でお願いします！",
    "4/10（木）16:00でお願いします！",
    "別の日程はありますか？",
  ],
  casual_confirmed: [
    "ありがとうございます！よろしくお願いいたします。",
    "当日は何を準備しておくとよいですか？",
    "ZoomリンクをURLで教えていただけますか？",
  ],
  interviewing: [
    "選考に進みたいと思います！",
    "少し検討させていただけますか？",
    "他の選考状況を確認してからご連絡します。",
  ],
  offer: [
    "内定ありがとうございます！ぜひよろしくお願いします。",
    "少し検討させてください。",
    "条件について確認したいことがあります。",
  ],
};

// ─── Helpers ─────────────────────────────────────────

function getLogoUrl(company: any): string | null {
  if (!company) return null;
  if (company.logo_url) return company.logo_url;
  if (company.url) {
    try {
      return `https://logo.clearbit.com/${new URL(company.url).hostname}`;
    } catch {}
  }
  return null;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "今";
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}時間前`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Progress Bar ────────────────────────────────────

function ProgressBar({ status }: { status: string }) {
  const currentStep = STATUS_TO_STEP[status] ?? 0;
  const isRejected = status === "rejected";

  return (
    <div className="px-4 py-3" style={{ borderBottom: "0.5px solid #f0f0f0" }}>
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isActive = !isRejected && i <= currentStep;
          const isCurrent = !isRejected && i === currentStep;
          return (
            <div key={step} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full h-1.5 rounded-full transition-all"
                style={{
                  background: isRejected
                    ? "#e5e7eb"
                    : isActive
                    ? "#1D9E75"
                    : "#e5e7eb",
                }}
              />
              <span
                className="text-[9px] leading-none"
                style={{
                  color: isCurrent ? "#1D9E75" : isActive ? "#6b7280" : "#d1d5db",
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Thread List Item ────────────────────────────────

function ThreadItem({
  thread,
  isSelected,
  onClick,
}: {
  thread: Thread;
  isSelected: boolean;
  onClick: () => void;
}) {
  const sc = STATUS_CONFIG[thread.status] || { label: thread.status, bg: "#f5f5f4", color: "#78716c" };

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-3 transition-colors"
      style={{
        background: isSelected ? "#E1F5EE" : "transparent",
        borderLeft: isSelected ? "3px solid #1D9E75" : "3px solid transparent",
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* Company logo */}
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: thread.company_brand_color ? `${thread.company_brand_color}20` : "#f5f5f4" }}
        >
          {thread.company_logo ? (
            <img
              src={thread.company_logo}
              alt=""
              className="w-full h-full object-contain p-1"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, color: thread.company_brand_color || "#9ca3af" }}>
              {thread.company_name[0]}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[12px] font-medium text-gray-800 truncate flex-1">
              {thread.company_name}
            </span>
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              {relativeTime(thread.updated_at)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: sc.bg, color: sc.color, fontWeight: 600 }}
            >
              {sc.label}
            </span>
            {thread.unread_count > 0 && (
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ background: "#E24B4A" }}
              >
                {thread.unread_count}
              </span>
            )}
          </div>
          {thread.last_message && (
            <p className="text-[11px] text-gray-400 truncate mt-1">{thread.last_message}</p>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Chat Area ───────────────────────────────────────

function ChatArea({
  thread,
  userId,
}: {
  thread: Thread;
  userId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  // Load messages
  useEffect(() => {
    async function loadMessages() {
      setLoadingMsgs(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("ow_messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });
      setMessages(data || []);
      setLoadingMsgs(false);

      // Mark as read
      if (data && data.length > 0) {
        const unreadIds = data
          .filter((m: any) => !m.is_read && m.sender_type !== "candidate")
          .map((m: any) => m.id);
        if (unreadIds.length > 0) {
          await supabase.from("ow_messages").update({ is_read: true }).in("id", unreadIds);
        }
      }
      scrollToBottom();
    }
    loadMessages();
  }, [thread.id, scrollToBottom]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${thread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ow_messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [thread.id, scrollToBottom]);

  // Send message
  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    setSending(true);
    const supabase = createClient();

    const { error } = await supabase.from("ow_messages").insert({
      thread_id: thread.id,
      sender_id: userId,
      sender_type: "candidate",
      content: content.trim(),
    });

    if (!error) {
      await supabase
        .from("ow_threads")
        .update({
          last_message: content.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", thread.id);
    }

    setInput("");
    setSending(false);
    scrollToBottom();
  };

  const quickReplies = QUICK_REPLIES[thread.status] || [];
  const sc = STATUS_CONFIG[thread.status] || { label: thread.status, bg: "#f5f5f4", color: "#78716c" };

  return (
    <div className="flex flex-col h-full" style={{ borderLeft: "0.5px solid #e5e7eb" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "0.5px solid #e5e7eb", background: "#fff" }}>
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: thread.company_brand_color ? `${thread.company_brand_color}20` : "#f5f5f4" }}
        >
          {thread.company_logo ? (
            <img src={thread.company_logo} alt="" className="w-full h-full object-contain p-1" />
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: thread.company_brand_color || "#9ca3af" }}>
              {thread.company_name[0]}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-medium text-gray-800 truncate">{thread.company_name}</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color, fontWeight: 600 }}>
              {sc.label}
            </span>
          </div>
        </div>
        <Link
          href={`/companies/${thread.company_id}`}
          className="text-[11px] transition-colors"
          style={{ color: "#1D9E75" }}
        >
          企業詳細 →
        </Link>
      </div>

      {/* Progress bar */}
      <ProgressBar status={thread.status} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ background: "#fafaf8" }}>
        {loadingMsgs ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[13px] text-gray-400">読み込み中...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[13px] text-gray-400">メッセージはまだありません</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isCandidate = msg.sender_type === "candidate";
            const isSystem = msg.sender_type === "system";

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="text-[11px] text-gray-400 px-3 py-1.5 rounded-full" style={{ background: "#f0f0f0" }}>
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isCandidate ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[70%] rounded-2xl px-4 py-2.5"
                  style={{
                    background: isCandidate ? "#1D9E75" : "#fff",
                    color: isCandidate ? "#fff" : "#374151",
                    border: isCandidate ? "none" : "0.5px solid #e5e7eb",
                    borderBottomRightRadius: isCandidate ? 6 : 18,
                    borderBottomLeftRadius: isCandidate ? 18 : 6,
                  }}
                >
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className="text-[10px] mt-1"
                    style={{ color: isCandidate ? "rgba(255,255,255,0.6)" : "#9ca3af", textAlign: isCandidate ? "right" : "left" }}
                  >
                    {formatMessageTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies */}
      {quickReplies.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5" style={{ borderTop: "0.5px solid #f0f0f0", background: "#fff" }}>
          {quickReplies.map((reply, i) => (
            <button
              key={i}
              onClick={() => sendMessage(reply)}
              disabled={sending}
              className="text-[11px] px-3 py-1.5 rounded-full transition-colors"
              style={{ border: "0.5px solid #5DCAA5", color: "#0F6E56", background: "#E1F5EE" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#d1f0e3"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#E1F5EE"; }}
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 flex items-end gap-2" style={{ borderTop: "0.5px solid #e5e7eb", background: "#fff" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="メッセージを入力..."
          rows={1}
          className="flex-1 resize-none text-[13px] px-3 py-2.5 rounded-xl outline-none"
          style={{
            border: "0.5px solid #e5e7eb",
            background: "#fafaf8",
            maxHeight: 120,
          }}
          onInput={(e) => {
            const el = e.target as HTMLTextAreaElement;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || sending}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40"
          style={{ background: "#1D9E75" }}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="white">
            <path d="M2.94 5.02L9.71 9.2a.996.996 0 010 1.6l-6.77 4.18c-.97.6-2.18-.1-1.94-1.23l.83-3.97c.05-.25.05-.51 0-.76l-.83-3.97c-.24-1.13.97-1.83 1.94-1.23z" />
            <path d="M10 10.5h7.5M10 9.5h7.5" stroke="white" strokeWidth="0.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────

function EmptyState({ hasThreads }: { hasThreads: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4"
      style={{ borderLeft: "0.5px solid #e5e7eb", background: "#fafaf8" }}
    >
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#9FE1CB" strokeWidth="1.5" strokeLinecap="round">
        <path d="M24 4C13 4 4 13 4 24s9 20 20 20c3 0 5.5-.6 8-2l8 2-2-8c1.4-2.5 2-5 2-8C40 13 35 4 24 4z" />
        <line x1="16" y1="18" x2="32" y2="18" />
        <line x1="16" y1="24" x2="26" y2="24" />
      </svg>
      <p style={{ fontSize: 14, fontWeight: 500 }}>
        {hasThreads ? "スレッドを選択してください" : "メッセージはまだありません"}
      </p>
      {!hasThreads && (
        <>
          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            企業の「話を聞きに行く」ボタンを押すと
            <br />
            ここにスレッドが表示されます
          </p>
          <Link
            href="/companies"
            style={{
              padding: "10px 20px",
              background: "#1D9E75",
              color: "#fff",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            企業を探す
          </Link>
        </>
      )}
    </div>
  );
}

// ─── Main Content ────────────────────────────────────

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadParam = searchParams.get("thread");

  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(threadParam);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login?redirect=/messages");
        return;
      }
      setUserId(user.id);

      try {
        const { data: threadData, error } = await supabase
          .from("ow_threads")
          .select("*")
          .eq("candidate_id", user.id)
          .order("updated_at", { ascending: false });

        if (error) {
          console.error("Threads fetch error:", error);
        }

        if (threadData && threadData.length > 0) {
          // Fetch company data
          const companyIds = Array.from(new Set(threadData.map((t: any) => t.company_id)));
          const { data: companies } = await supabase
            .from("ow_companies")
            .select("id, name, logo_url, url, brand_color")
            .in("id", companyIds);

          const companyMap = new Map((companies || []).map((c: any) => [c.id, c]));

          const enrichedThreads: Thread[] = threadData.map((t: any) => {
            const company = companyMap.get(t.company_id) as any;
            return {
              id: t.id,
              company_id: t.company_id,
              candidate_id: t.candidate_id,
              company_name: t.company_name || company?.name || "不明な企業",
              status: t.status,
              last_message: t.last_message,
              unread_count: t.unread_count || 0,
              updated_at: t.updated_at,
              company_logo: getLogoUrl(company),
              company_brand_color: company?.brand_color || "#1D9E75",
            };
          });

          setThreads(enrichedThreads);

          // Auto-select first or param thread
          if (threadParam) {
            setSelectedThreadId(threadParam);
          } else if (enrichedThreads.length > 0) {
            setSelectedThreadId(enrichedThreads[0].id);
          }
        }
      } catch (err) {
        console.error("Messages load error:", err);
      }

      setLoading(false);
    }
    load();
  }, [router, threadParam]);

  const selectThread = (id: string) => {
    setSelectedThreadId(id);
    router.push(`/messages?thread=${id}`, { scroll: false });
  };

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "256px 1fr",
          height: "calc(100vh - 64px)",
          overflow: "hidden",
        }}
      >
        <div className="flex items-center justify-center" style={{ borderRight: "0.5px solid #e5e7eb" }}>
          <p className="text-[13px] text-gray-400">読み込み中...</p>
        </div>
        <div className="flex items-center justify-center" style={{ background: "#fafaf8" }}>
          <p className="text-[13px] text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "256px 1fr",
        height: "calc(100vh - 64px)",
        overflow: "hidden",
      }}
    >
      {/* Thread list */}
      <div className="flex flex-col" style={{ background: "#fff" }}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "0.5px solid #e5e7eb" }}>
          <h2 className="text-[14px] font-bold text-gray-800">メッセージ</h2>
          {threads.length > 0 && (
            <span className="text-[11px] text-gray-400">{threads.length}件</span>
          )}
        </div>

        {/* Thread items */}
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[12px] text-gray-400">スレッドなし</p>
            </div>
          ) : (
            threads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                isSelected={selectedThreadId === thread.id}
                onClick={() => selectThread(thread.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat area / Empty state */}
      {selectedThread ? (
        <ChatArea thread={selectedThread} userId={userId} />
      ) : (
        <EmptyState hasThreads={threads.length > 0} />
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────

export default function MessagesPage() {
  return (
    <>
      <Header />
      <main className="pt-16" style={{ height: "100vh", overflow: "hidden" }}>
        <Suspense
          fallback={
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "256px 1fr",
                height: "calc(100vh - 64px)",
              }}
            >
              <div className="flex items-center justify-center">
                <p className="text-gray-400 text-sm">読み込み中...</p>
              </div>
              <div className="flex items-center justify-center" style={{ background: "#fafaf8" }} />
            </div>
          }
        >
          <MessagesContent />
        </Suspense>
      </main>
    </>
  );
}
