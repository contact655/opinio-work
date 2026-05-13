import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "対話管理 | Opinio Business",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type CandidateInfo = {
  id: string;
  name: string | null;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  const months = Math.floor(days / 30);
  return `${months}ヶ月前`;
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  inquiry:        { label: "問い合わせ",    color: "var(--ink-soft)", bg: "var(--line-soft)" },
  casual_meeting: { label: "カジュアル面談", color: "var(--accent)",   bg: "var(--royal-50)" },
  interview:      { label: "面接",           color: "var(--purple)",   bg: "var(--purple-soft)" },
  offer:          { label: "オファー",       color: "var(--success)",  bg: "var(--success-soft)" },
  closed:         { label: "クローズ",       color: "var(--ink-mute)", bg: "var(--bg-tint)" },
  active:         { label: "進行中",         color: "var(--accent)",   bg: "var(--royal-50)" },
};

function StageTag({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const cfg = STAGE_CONFIG[stage] ?? {
    label: stage,
    color: "var(--ink-soft)",
    bg: "var(--line-soft)",
  };
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "'Inter', sans-serif",
      color: cfg.color,
      background: cfg.bg,
      flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  );
}

// ── No-tenant fallback ────────────────────────────────────────────────────────

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName}>
      <div style={{
        textAlign: "center",
        padding: "80px 20px",
        color: "var(--ink-mute)",
      }}>
        企業アカウントが必要です
      </div>
    </BusinessLayout>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default async function BizConversationsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <NoTenantPage />;

  const supabase = createClient();

  const { data: rawRows, error } = await supabase
    .from("ow_conversations")
    .select(`
      id, kind, stage, status, last_message_at, created_at,
      candidate:ow_users!candidate_user_id(id, name, avatar_color)
    `)
    .eq("company_id", ctx.tenantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[BizConversationsPage] fetch error:", error.message);
  }

  // Normalise: Supabase may return a single object or an array for the join
  const convList: ConversationRow[] = (rawRows ?? []).map((c: any) => ({
    id: c.id,
    kind: c.kind,
    stage: c.stage,
    status: c.status,
    last_message_at: c.last_message_at,
    created_at: c.created_at,
    candidate: Array.isArray(c.candidate)
      ? (c.candidate[0] ?? null)
      : c.candidate ?? null,
  }));

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      {/* Hover style for list rows */}
      <style>{`
        .conv-row:hover { background: var(--bg-tint) !important; }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: "'Noto Serif JP', serif",
          fontWeight: 700,
          fontSize: 22,
          color: "var(--ink)",
          margin: 0,
        }}>
          対話管理
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
          候補者から届いた問い合わせと進行中の対話を管理します。
        </p>
      </div>

      {/* ── Summary strip ── */}
      <div style={{
        display: "flex",
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          padding: "12px 20px",
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 10,
          minWidth: 100,
        }}>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--royal)",
            lineHeight: 1,
          }}>
            {convList.length}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
            対話件数
          </div>
        </div>
      </div>

      {/* ── Empty state ── */}
      {convList.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "80px 20px",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--line)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--ink-soft)",
            marginBottom: 6,
          }}>
            対話がありません
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>
            候補者からの問い合わせがここに表示されます。
          </div>
        </div>
      )}

      {/* ── Conversation list ── */}
      {convList.length > 0 && (
        <div style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--line)",
          overflow: "hidden",
        }}>
          {convList.map((conv, idx) => {
            const candidate = conv.candidate;
            const candidateName = candidate?.name ?? "名前未設定";
            const initial = candidateName.trim().charAt(0).toUpperCase();
            const avatarColor =
              candidate?.avatar_color ??
              "linear-gradient(135deg, #64748b, #475569)";
            const timeLabel = formatRelativeTime(
              conv.last_message_at ?? conv.created_at
            );

            return (
              <Link
                key={conv.id}
                href={`/biz/conversations/${conv.id}`}
                className="conv-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 20px",
                  textDecoration: "none",
                  borderTop: idx > 0 ? "1px solid var(--line-soft)" : "none",
                  background: "#fff",
                  transition: "background 0.12s",
                }}
              >
                {/* Candidate avatar */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: avatarColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700,
                  fontSize: 17,
                  flexShrink: 0,
                }}>
                  {initial}
                </div>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}>
                    <span style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {candidateName}
                    </span>
                    <StageTag stage={conv.stage} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                    {timeLabel}
                  </div>
                </div>

                {/* Unread dot — always shown in Phase ν-4 (赤ドット維持) */}
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--error)",
                  flexShrink: 0,
                }} />
              </Link>
            );
          })}
        </div>
      )}
    </BusinessLayout>
  );
}
