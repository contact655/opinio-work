"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { BizApplication, ApplicationStatus, ApplicationStatusTab } from "@/lib/business/applications";
import { APPLICATION_STATUS_TABS, countByStatus, VALID_APPLICATION_STATUSES } from "@/lib/business/applications";

// ─── Status helpers ─────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  pending:   "#D97706",
  reviewing: "var(--royal)",
  interview: "#7C3AED",
  accepted:  "var(--success)",
  rejected:  "#DC2626",
};

const STATUS_BG: Record<ApplicationStatus, string> = {
  pending:   "#FEF3C7",
  reviewing: "var(--royal-50)",
  interview: "#F5F3FF",
  accepted:  "var(--success-soft)",
  rejected:  "#FEE2E2",
};

function StatusPill({ status }: { status: ApplicationStatus }) {
  const tab = APPLICATION_STATUS_TABS.find((t) => t.status === status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 100,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
      fontFamily: "'Inter', sans-serif",
      background: STATUS_BG[status],
      color: STATUS_COLOR[status],
    }}>
      {tab?.labelJa ?? status}
    </span>
  );
}

// ─── Initial for avatar ─────────────────────────────────────────────────────

function nameInitial(name: string): string {
  return name.trim().charAt(0) || "?";
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, var(--royal), var(--accent))",
  "linear-gradient(135deg, #FBBF24, #D97706)",
  "linear-gradient(135deg, #34D399, #059669)",
  "linear-gradient(135deg, #A78BFA, #7C3AED)",
  "linear-gradient(135deg, #DB2777, #9D174D)",
  "linear-gradient(135deg, #0EA5E9, #0369A1)",
];

function avatarGradient(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function EmptyStateTotal() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 40px", gap: 16,
      background: "#fff", borderRadius: 12, border: "1px solid var(--line)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "var(--royal-50)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="var(--royal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{
          margin: "0 0 6px", fontSize: 16, fontWeight: 700,
          color: "var(--ink)", fontFamily: "'Noto Sans JP', sans-serif",
        }}>
          まだ応募はありません
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>
          求人を公開すると、応募者が集まり始めます
        </p>
      </div>
      <Link
        href="/biz/jobs"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 20px", borderRadius: 8,
          background: "var(--royal)", color: "#fff",
          fontSize: 13, fontWeight: 600, textDecoration: "none",
          fontFamily: "'Noto Sans JP', sans-serif",
          marginTop: 4,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        </svg>
        求人を管理する
      </Link>
    </div>
  );
}

function EmptyState({ status }: { status: ApplicationStatus | "all" }) {
  const tab = APPLICATION_STATUS_TABS.find((t) => t.status === status);
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 12,
      color: "var(--ink-mute)", padding: 40,
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ opacity: 0.4 }}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
        <path d="M9 12h6M9 16h4"/>
      </svg>
      <p style={{ margin: 0, fontSize: 14, textAlign: "center" }}>
        {status === "all"
          ? "まだ応募がありません"
          : `「${tab?.labelJa}」の応募はありません`}
      </p>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

type Props = {
  applications: BizApplication[];
};

export function ApplicationsClient({ applications: initialApplications }: Props) {
  const [applications, setApplications] = useState<BizApplication[]>(initialApplications);
  const [activeStatus, setActiveStatus] = useState<ApplicationStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialApplications[0]?.id ?? null
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const counts = useMemo(() => countByStatus(applications), [applications]);

  const filtered = useMemo(() =>
    activeStatus === "all"
      ? applications
      : applications.filter((a) => a.status === activeStatus),
    [applications, activeStatus]
  );

  const selected = useMemo(() =>
    applications.find((a) => a.id === selectedId) ?? null,
    [applications, selectedId]
  );

  const selectedIndex = useMemo(() =>
    filtered.findIndex((a) => a.id === selectedId),
    [filtered, selectedId]
  );

  // ── Keyboard navigation (↑↓ / j k) ──────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        if (selectedIndex < filtered.length - 1) setSelectedId(filtered[selectedIndex + 1].id);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        if (selectedIndex > 0) setSelectedId(filtered[selectedIndex - 1].id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, selectedIndex]);

  // ── Status change ─────────────────────────────────────────────────────────
  async function handleStatusChange(appId: string, newStatus: ApplicationStatus) {
    const old = applications.find((a) => a.id === appId);
    if (!old || old.status === newStatus) return;

    // Optimistic update
    setApplications((prev) =>
      prev.map((a) => a.id === appId ? { ...a, status: newStatus } : a)
    );
    setUpdatingId(appId);

    try {
      const res = await fetch(`/api/biz/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      // Rollback
      setApplications((prev) =>
        prev.map((a) => a.id === appId ? { ...a, status: old.status } : a)
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // ─── Layout ───────────────────────────────────────────────────────────────
  const totalApplications = applications.length;
  const pendingApplications = counts["pending"] ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
      <style>{`
        .app-row:hover { background: var(--bg-tint) !important; outline-color: var(--royal-100) !important; }
        .app-tab-pill:hover { background: var(--line-soft) !important; }
        .app-tab-pill[aria-selected="true"]:hover { background: var(--royal) !important; }
      `}</style>

      {/* Page-level header */}
      <div style={{
        marginBottom: 24, paddingBottom: 20,
        borderBottom: "1px solid var(--line-soft)",
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <h1 style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: 22, fontWeight: 700, color: "var(--royal)", margin: 0,
            }}>
              応募管理
            </h1>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.15em",
              textTransform: "uppercase", color: "var(--ink-mute)", opacity: 0.6,
            }}>
              Applications
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>
            求人への応募者を管理しましょう
          </p>
        </div>

        {/* Total count badge */}
        {totalApplications > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 16px", borderRadius: 10,
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
          }}>
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 22, fontWeight: 800, color: "var(--royal)",
                lineHeight: 1,
              }}>
                {totalApplications}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                総応募数
              </div>
            </div>
            {pendingApplications > 0 && (
              <>
                <div style={{ width: 1, height: 32, background: "var(--royal-100)" }} />
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 22, fontWeight: 800, color: "#D97706",
                    lineHeight: 1,
                  }}>
                    {pendingApplications}
                  </div>
                  <div style={{ fontSize: 11, color: "#D97706", marginTop: 2 }}>
                    未確認
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Status tabs — pill style */}
      <div
        role="tablist"
        aria-label="応募ステータス"
        style={{
          display: "flex", gap: 6, marginBottom: 20,
          overflowX: "auto", flexWrap: "wrap",
        }}>
        {APPLICATION_STATUS_TABS.map((tab: ApplicationStatusTab) => {
          const isActive = activeStatus === tab.status;
          const count = counts[tab.status as ApplicationStatus | "all"];
          return (
            <button
              key={tab.status}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveStatus(tab.status as ApplicationStatus | "all");
                setSelectedId(null);
              }}
              className="app-tab-pill"
              style={{
                padding: "7px 14px",
                background: isActive ? "var(--royal)" : "var(--line-soft)",
                border: "none", borderRadius: 100,
                cursor: "pointer",
                color: isActive ? "#fff" : "var(--ink-soft)",
                fontFamily: "'Noto Sans JP', sans-serif",
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                display: "inline-flex", alignItems: "center", gap: 6,
                whiteSpace: "nowrap",
                transition: "background .15s, color .15s",
              }}
            >
              {tab.labelJa}
              {count > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: isActive ? "rgba(255,255,255,0.25)" : "var(--line)",
                  color: isActive ? "#fff" : "var(--ink-mute)",
                  fontSize: 10, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  padding: "0 5px",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 2-pane layout */}
      {applications.length === 0 ? (
        <EmptyStateTotal />
      ) : (
      <div style={{
        display: "grid",
        gridTemplateColumns: filtered.length === 0 ? "1fr" : "340px 1fr",
        gap: 16, flex: 1, minHeight: 0,
      }}>

        {/* Left pane: list */}
        {filtered.length === 0 ? (
          <EmptyState status={activeStatus} />
        ) : (
          <div style={{
            display: "flex", flexDirection: "column", gap: 6,
            overflowY: "auto",
          }}>
            {filtered.map((app) => {
              const isSelected = app.id === selectedId;
              const appliedDate = new Date(app.createdAt).toLocaleDateString("ja-JP", {
                month: "short", day: "numeric",
              });
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedId(app.id)}
                  className={isSelected ? undefined : "app-row"}
                  style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "13px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: isSelected ? "var(--royal-50)" : "#fff",
                    outline: isSelected ? `2px solid var(--royal)` : "1px solid var(--line)",
                    outlineOffset: -1,
                    textAlign: "left", transition: "background .12s",
                  }}
                >
                  {/* Avatar — 40px */}
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                    background: avatarGradient(app.id),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: 15,
                    fontFamily: "'Noto Sans JP', sans-serif",
                    boxShadow: isSelected ? "0 0 0 2px #fff, 0 0 0 4px var(--royal)" : "none",
                    transition: "box-shadow .12s",
                  }}>
                    {nameInitial(app.name)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Name — 16px bold */}
                    <div style={{
                      fontSize: 16, fontWeight: 700, color: "var(--ink)",
                      marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontFamily: "'Noto Sans JP', sans-serif",
                    }}>
                      {app.name}
                    </div>
                    {/* Job title below name in muted color */}
                    <div style={{
                      fontSize: 11, color: "var(--ink-mute)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginBottom: 6,
                    }}>
                      {app.jobTitle}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <StatusPill status={app.status} />
                      <span style={{
                        fontSize: 11, color: "var(--ink-mute)",
                        fontFamily: "'Inter', sans-serif",
                      }}>
                        {appliedDate}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Right pane: detail */}
        {filtered.length > 0 && (
          <div style={{
            background: "#fff", borderRadius: 12, border: "1px solid var(--line)",
            padding: 28, overflowY: "auto",
          }}>
            {!selected ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "100%", color: "var(--ink-mute)", fontSize: 14,
              }}>
                応募者を選択してください
              </div>
            ) : (
              <DetailPanel
                app={selected}
                isUpdating={updatingId === selected.id}
                onStatusChange={handleStatusChange}
              />
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────────────

type DetailProps = {
  app: BizApplication;
  isUpdating: boolean;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
};

function DetailPanel({ app, isUpdating, onStatusChange }: DetailProps) {
  const statusOptions: { value: ApplicationStatus; label: string }[] = [
    { value: "pending",   label: "新着" },
    { value: "reviewing", label: "確認中" },
    { value: "interview", label: "面接中" },
    { value: "accepted",  label: "採用" },
    { value: "rejected",  label: "不採用" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Profile header — improved visual hierarchy */}
      <div style={{
        background: "linear-gradient(135deg, var(--royal-50) 0%, #f8faff 100%)",
        borderRadius: 12, border: "1px solid var(--royal-100)",
        padding: "20px 20px 18px",
        display: "flex", alignItems: "flex-start", gap: 16,
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
          {/* Large avatar with ring */}
          <div style={{
            width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
            background: avatarGradient(app.id),
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 22,
            fontFamily: "'Noto Sans JP', sans-serif",
            boxShadow: "0 0 0 3px #fff, 0 0 0 5px var(--royal-100)",
          }}>
            {nameInitial(app.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 20, fontWeight: 800, color: "var(--ink)",
              fontFamily: "'Noto Sans JP', sans-serif", marginBottom: 6,
              letterSpacing: "-0.01em",
            }}>
              {app.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <StatusPill status={app.status} />
              <span style={{
                fontSize: 12, color: "var(--ink-mute)",
                fontFamily: "'Inter', sans-serif",
              }}>
                {new Date(app.createdAt).toLocaleDateString("ja-JP", {
                  year: "numeric", month: "short", day: "numeric",
                })} 応募
              </span>
            </div>
          </div>
        </div>

        {/* Status selector */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <label htmlFor={`app-status-${app.id}`} style={{
            fontSize: 10, color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif",
            fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            ステータス変更
          </label>
          <select
            id={`app-status-${app.id}`}
            value={app.status}
            disabled={isUpdating}
            onChange={(e) => {
              const newStatus = e.target.value as ApplicationStatus;
              if (VALID_APPLICATION_STATUSES.has(newStatus)) {
                onStatusChange(app.id, newStatus);
              }
            }}
            style={{
              padding: "7px 12px", borderRadius: 8,
              border: "1px solid var(--royal-100)",
              background: isUpdating ? "var(--bg-tint)" : "#fff",
              fontSize: 13, color: "var(--ink)",
              fontFamily: "'Noto Sans JP', sans-serif",
              cursor: isUpdating ? "not-allowed" : "pointer",
              outline: "none",
              boxShadow: "0 1px 3px rgba(0,35,102,0.06)",
            }}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: 0 }} />

      {/* 求人情報 */}
      <Section title="応募求人">
        <InfoRow label="求人タイトル" value={app.jobTitle} />
        <InfoRow label="応募日" value={
          new Date(app.createdAt).toLocaleDateString("ja-JP", {
            year: "numeric", month: "long", day: "numeric",
          })
        } />
      </Section>

      {/* 連絡先 */}
      <Section title="連絡先">
        <InfoRow label="メールアドレス" value={
          <a href={`mailto:${app.email}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
            {app.email}
          </a>
        } />
        {app.phone && <InfoRow label="電話番号" value={app.phone} />}
      </Section>

      {/* 志望動機 */}
      {app.message && (
        <Section title="志望動機・メッセージ">
          <p style={{
            margin: 0, fontSize: 14, color: "var(--ink)",
            lineHeight: 1.8, whiteSpace: "pre-wrap",
            background: "var(--bg-tint)", borderRadius: 8,
            padding: "12px 16px",
          }}>
            {app.message}
          </p>
        </Section>
      )}

      {/* アクションボタン群 */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
        {app.conversationId && (
          <Link
            href={`/biz/conversations/${app.conversationId}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 20px",
              background: "var(--royal)", color: "#fff",
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              textDecoration: "none",
              transition: "opacity 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            対話を見る →
          </Link>
        )}
        {app.userId && (
          <a
            href={`/u/${app.userId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 16px",
              background: "var(--bg-tint)", color: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              textDecoration: "none",
              transition: "border-color 0.15s, color 0.15s",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            公開プロフィール
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Section / InfoRow ───────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h3 style={{
        margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--ink-mute)",
        fontFamily: "'Inter', sans-serif",
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{
        fontSize: 12, color: "var(--ink-mute)", flexShrink: 0,
        width: 120, paddingTop: 1,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>
        {value}
      </span>
    </div>
  );
}
