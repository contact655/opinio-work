"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { ConversationRow } from "./page";

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

const STAGE_FILTER_TABS: { key: string; label: string }[] = [
  { key: "all",            label: "すべて" },
  { key: "inquiry",        label: "問い合わせ" },
  { key: "casual_meeting", label: "カジュアル面談" },
  { key: "interview",      label: "面接" },
  { key: "offer",          label: "オファー" },
  { key: "closed",         label: "クローズ" },
];

function StageTag({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const cfg = STAGE_CONFIG[stage] ?? { label: stage, color: "var(--ink-soft)", bg: "var(--line-soft)" };
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

// ── Component ─────────────────────────────────────────────────────────────────

export function ConversationsClient({ conversations }: { conversations: ConversationRow[] }) {
  const [activeStage, setActiveStage] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Count by stage
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of conversations) {
      const s = c.stage ?? "unknown";
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [conversations]);

  const activeCount = useMemo(
    () => conversations.filter((c) => c.stage !== "closed").length,
    [conversations]
  );

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (activeStage !== "all" && c.stage !== activeStage) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const name = c.candidate?.name ?? "";
      return name.toLowerCase().includes(q);
    });
  }, [conversations, activeStage, searchQuery]);

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
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
      </div>

      {/* ── Stats strip ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "対話件数", value: conversations.length, color: "var(--royal)" },
          { label: "進行中", value: activeCount, color: "var(--accent)" },
          { label: "カジュアル面談", value: stageCounts["casual_meeting"] ?? 0, color: "var(--warm)" },
          { label: "クローズ", value: stageCounts["closed"] ?? 0, color: "var(--ink-mute)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1,
            padding: "14px 18px",
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 10,
          }}>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 24,
              fontWeight: 700,
              color,
              lineHeight: 1,
            }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4, fontWeight: 500 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Stage filter tabs ── */}
      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 14,
        borderBottom: "1px solid var(--line)",
        flexWrap: "wrap",
      }}>
        {STAGE_FILTER_TABS.map((tab) => {
          const count = tab.key === "all" ? conversations.length : (stageCounts[tab.key] ?? 0);
          const isActive = activeStage === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveStage(tab.key)}
              style={{
                padding: "10px 14px",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid var(--royal)" : "2px solid transparent",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--royal)" : "var(--ink-mute)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginBottom: -1,
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: 100,
                background: isActive ? "var(--royal-50)" : "var(--line-soft)",
                color: isActive ? "var(--royal)" : "var(--ink-mute)",
              }}>
                {count}
              </span>
            </button>
          );
        })}

        {/* Search */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingBottom: 8 }}>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              color: "var(--ink-mute)", pointerEvents: "none",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="候補者名で検索..."
              style={{
                padding: "7px 12px 7px 30px",
                border: "1px solid var(--line)",
                borderRadius: 7,
                fontFamily: "inherit",
                fontSize: 12,
                background: "#fff",
                width: 200,
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--royal)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
            />
          </div>
        </div>
      </div>

      {/* ── Empty state ── */}
      {conversations.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "80px 20px",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--line)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
            対話がありません
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>
            候補者からの問い合わせがここに表示されます。
          </div>
        </div>
      )}

      {/* ── Filtered empty state ── */}
      {conversations.length > 0 && filtered.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "48px 20px",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--line)",
          color: "var(--ink-mute)",
          fontSize: 13,
        }}>
          {searchQuery.trim()
            ? `「${searchQuery}」に一致する対話が見つかりません`
            : "このステージの対話はありません"}
        </div>
      )}

      {/* ── Conversation list ── */}
      {filtered.length > 0 && (
        <div style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--line)",
          overflow: "hidden",
        }}>
          <style>{`.conv-row:hover { background: var(--bg-tint) !important; }`}</style>
          {filtered.map((conv, idx) => {
            const candidate = conv.candidate;
            const candidateName = candidate?.name ?? "名前未設定";
            const initial = candidateName.trim().charAt(0).toUpperCase();
            const avatarColor = candidate?.avatar_color ?? "linear-gradient(135deg, #64748b, #475569)";
            const timeLabel = formatRelativeTime(conv.last_message_at ?? conv.created_at);
            // unread dot: show for active/non-closed stages only
            const showUnread = conv.stage !== "closed" && conv.status !== "closed";

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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
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

                {/* Unread dot — conditional on stage */}
                {showUnread && (
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--error)",
                    flexShrink: 0,
                  }} />
                )}
                {!showUnread && <div style={{ width: 8, flexShrink: 0 }} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
