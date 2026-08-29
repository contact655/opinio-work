import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { ReplyForm } from "./ReplyForm";
import { JoinButton } from "./JoinButton";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type CandidateInfo = {
  id: string;
  name: string | null;
  about_me: string | null;
  location: string | null;
  avatar_color: string | null;
};

type ConversationRow = {
  id: string;
  kind: string | null;
  stage: string | null;
  status: string | null;
  last_message_at: string | null;
  created_at: string;
  candidate: CandidateInfo | null;
};

type ParticipantRow = {
  id: string;
  role: string;
  user_id: string;
  user: { name: string | null } | null;
};

type MessageRow = {
  id: string;
  body: string;
  sent_at: string;
  sender_participant_id: string | null;
  participant: {
    id: string;
    role: string;
    user_id: string;
    user: { name: string | null } | null;
  } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: "進行中",   color: "var(--accent)",   bg: "var(--royal-50)" },
  mediated: { label: "調整中",   color: "var(--purple)",   bg: "var(--purple-soft)" },
  direct:   { label: "直接対話", color: "var(--success)",  bg: "var(--success-soft)" },
  archived: { label: "クローズ", color: "var(--ink-mute)", bg: "var(--bg-tint)" },
};

function formatDateTime(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }),
    time: d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
  };
}

// ── No-tenant fallback ────────────────────────────────────────────────────────

// ── Main page ─────────────────────────────────────────────────────────────────

export default async function BizConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const conversationId = params.id;

  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  // ── [1] Conversation detail ────────────────────────────────────────────────
  const { data: rawConv, error: convError } = await supabase
    .from("ow_conversations")
    .select(`
      id, kind, stage, status, last_message_at, created_at,
      candidate:ow_users!candidate_user_id(id, name, about_me, location, avatar_color)
    `)
    .eq("id", conversationId)
    .eq("company_id", ctx.tenantId)
    .maybeSingle();

  if (convError) {
    console.error("[BizConvDetail] conv fetch error:", convError.message);
  }

  if (!rawConv) {
    notFound();
  }

  const conv: ConversationRow = {
    id: rawConv.id,
    kind: rawConv.kind,
    stage: rawConv.stage,
    status: rawConv.status,
    last_message_at: rawConv.last_message_at,
    created_at: rawConv.created_at,
    candidate: Array.isArray(rawConv.candidate)
      ? (rawConv.candidate[0] ?? null)
      : rawConv.candidate ?? null,
  };

  const candidate = conv.candidate;
  const candidateName = candidate?.name ?? "名前未設定";
  const candidateInitial = candidateName.trim().charAt(0).toUpperCase();
  const candidateAvatarColor =
    candidate?.avatar_color ?? "linear-gradient(135deg, #6b7280, #475569)";

  const stageCfg = conv.stage
    ? (STAGE_CONFIG[conv.stage] ?? { label: conv.stage, color: "var(--ink-soft)", bg: "var(--line-soft)" })
    : null;

  // ── [2] Participants ───────────────────────────────────────────────────────
  const { data: rawParticipants } = await supabase
    .from("ow_conversation_participants")
    .select("id, role, user_id, user:ow_users(name)")
    .eq("conversation_id", conversationId);

  const participants: ParticipantRow[] = (rawParticipants ?? []).map((p: any) => ({
    id: p.id,
    role: p.role,
    user_id: p.user_id,
    user: Array.isArray(p.user) ? (p.user[0] ?? null) : p.user ?? null,
  }));

  // Check if current user (ctx.currentOwnId) is a participant
  const myParticipant = participants.find((p) => p.user_id === ctx.currentOwnId) ?? null;
  const isParticipant = myParticipant !== null;

  // ── [3] Messages ──────────────────────────────────────────────────────────
  // NOTE: ow_conversation_messages SELECT RLS requires being a participant.
  // 担当者_001 IS a participant → can see messages.
  // Non-participant HR (e.g. 担当者_005) gets empty result (not an error).
  const { data: rawMessages, error: msgsError } = await supabase
    .from("ow_conversation_messages")
    .select(`
      id, body, sent_at, sender_participant_id,
      participant:ow_conversation_participants!sender_participant_id(
        id, role, user_id,
        user:ow_users(name)
      )
    `)
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("sent_at", { ascending: true });

  if (msgsError) {
    console.error("[BizConvDetail] messages fetch error:", msgsError.message);
  }

  const messages: MessageRow[] = (rawMessages ?? []).map((m: any) => ({
    id: m.id,
    body: m.body,
    sent_at: m.sent_at,
    sender_participant_id: m.sender_participant_id,
    participant: Array.isArray(m.participant)
      ? (m.participant[0] ?? null)
      : m.participant ?? null,
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <style>{`
        .msg-bubble-candidate {
          background: var(--line-soft);
          color: var(--ink);
          border-radius: 16px 16px 16px 4px;
        }
        .msg-bubble-hr {
          background: var(--royal);
          color: #fff;
          border-radius: 16px 16px 4px 16px;
        }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 20 }}>
        {/* Back link */}
        <Link
          href="/biz/conversations"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--ink-soft)",
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          対話一覧に戻る
        </Link>

        {/* Conversation title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Candidate avatar */}
          <div style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: candidateAvatarColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: "var(--font-inter), var(--font-noto)",
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}>
            {candidateInitial}
          </div>
          <div>
            <h1 style={{
              fontFamily: "var(--font-noto-serif)",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--ink)",
              margin: 0,
            }}>
              {candidateName} さんとの対話
            </h1>
            {stageCfg && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 100,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "var(--font-inter), var(--font-noto)",
                color: stageCfg.color,
                background: stageCfg.bg,
                marginTop: 4,
              }}>
                {stageCfg.label}
              </span>
            )}
          </div>

          {/* Participant status badge */}
          <div style={{ marginLeft: "auto" }}>
            {isParticipant ? (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 12px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--success)",
                background: "var(--success-soft)",
                border: "1px solid #A7F3D0",
              }}>
                ✓ 参加中
              </span>
            ) : (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 12px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-mute)",
                background: "var(--bg-tint)",
                border: "1px solid var(--line)",
              }}>
                未参加（閲覧のみ）
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content: 2-column ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>

        {/* ── Left: Chat messages ── */}
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Message area */}
          <div style={{
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minHeight: 400,
          }}>
            {messages.length === 0 ? (
              <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-mute)",
                fontSize: 13,
                padding: "60px 0",
              }}>
                {isParticipant
                  ? "まだメッセージはありません"
                  : "この対話のメッセージを閲覧するには、参加が必要です"}
              </div>
            ) : (
              messages.map((msg) => {
                const participantRole = msg.participant?.role;
                const isCandidate = participantRole === "candidate";
                const senderName = msg.participant?.user?.name ?? "不明";
                const { date, time } = formatDateTime(msg.sent_at);

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isCandidate ? "flex-start" : "flex-end",
                      gap: 4,
                    }}
                  >
                    {/* Sender name (candidate side only) */}
                    {isCandidate && (
                      <span style={{ fontSize: 11, color: "var(--ink-mute)", paddingLeft: 4 }}>
                        {senderName}
                      </span>
                    )}

                    <div style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 8,
                      flexDirection: isCandidate ? "row" : "row-reverse",
                    }}>
                      {/* Timestamp */}
                      <span style={{
                        fontSize: 11,
                        color: "var(--ink-mute)",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}>
                        {date} {time}
                      </span>

                      {/* Bubble */}
                      <div
                        className={isCandidate ? "msg-bubble-candidate" : "msg-bubble-hr"}
                        style={{
                          maxWidth: "70%",
                          padding: "10px 14px",
                          fontSize: 14,
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.body}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Reply area: JoinButton for non-participants, ReplyForm for participants */}
          {isParticipant ? (
            <ReplyForm conversationId={conv.id} />
          ) : (
            <JoinButton conversationId={conv.id} />
          )}
        </div>

        {/* ── Right: Candidate summary + participants ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Candidate profile card */}
          <div style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-mute)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "var(--font-inter), var(--font-noto)",
              marginBottom: 14,
            }}>
              候補者
            </div>

            {/* Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: candidateAvatarColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontFamily: "var(--font-inter), var(--font-noto)",
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
              }}>
                {candidateInitial}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
                  {candidateName}
                </div>
                {candidate?.location && (
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>{candidate.location}
                  </div>
                )}
              </div>
            </div>

            {/* About me */}
            {candidate?.about_me ? (
              <div style={{ marginBottom: 14 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-mute)",
                  display: "block",
                  marginBottom: 4,
                }}>
                  自己紹介
                </span>
                <p style={{
                  fontSize: 13,
                  color: "var(--ink)",
                  lineHeight: 1.6,
                  margin: 0,
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {candidate.about_me}
                </p>
              </div>
            ) : (
              <div style={{
                marginBottom: 14,
                fontSize: 12,
                color: "var(--ink-mute)",
                fontStyle: "italic",
              }}>
                自己紹介は未設定です
              </div>
            )}

            {/* Candidate profile link */}
            {candidate?.id && (
              <div style={{
                paddingTop: 12,
                borderTop: "1px solid var(--line-soft)",
              }}>
                <a
                  href={`/u/${candidate.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    color: "var(--royal)",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    textDecoration: "none",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  公開プロフィールを見る →
                </a>
              </div>
            )}
          </div>

          {/* Participants list */}
          <div style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-mute)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "var(--font-inter), var(--font-noto)",
              marginBottom: 12,
            }}>
              参加者 ({participants.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {participants.map((p) => {
                const roleLabel =
                  p.role === "candidate" ? "候補者" :
                  p.role === "company_admin" ? "HR" :
                  p.role;
                const isMe = p.user_id === ctx.currentOwnId;
                return (
                  <div key={p.id} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: isMe ? 600 : 400 }}>
                      {p.user?.name ?? "名前未設定"}
                      {isMe && (
                        <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 400, marginLeft: 4 }}>
                          (自分)
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: p.role === "candidate" ? "var(--ink-soft)" : "var(--accent)",
                      background: p.role === "candidate" ? "var(--line-soft)" : "var(--royal-50)",
                      padding: "1px 7px",
                      borderRadius: 100,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}>
                      {roleLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </BusinessLayout>
  );
}
