"use client";

import { useState, useMemo } from "react";
import type { BizApplication, ApplicationStatus, ApplicationStatusTab } from "@/lib/business/applications";
import { APPLICATION_STATUS_TABS, countByStatus, VALID_APPLICATION_STATUSES } from "@/lib/business/applications";

// ─── Status helpers ─────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  pending:   "var(--warm)",
  reviewing: "var(--accent)",
  interview: "var(--purple)",
  accepted:  "var(--success)",
  rejected:  "var(--error)",
};

const STATUS_BG: Record<ApplicationStatus, string> = {
  pending:   "var(--warm-soft)",
  reviewing: "var(--royal-50)",
  interview: "var(--purple-soft)",
  accepted:  "var(--success-soft)",
  rejected:  "var(--error-soft)",
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 22, fontWeight: 700, color: "var(--royal)", margin: "0 0 4px",
        }}>
          応募管理
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>
          自社求人への応募を確認し、選考状況を管理します。
        </p>
      </div>

      {/* Status tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20,
        borderBottom: "1px solid var(--line)", paddingBottom: 0,
        overflowX: "auto",
      }}>
        {APPLICATION_STATUS_TABS.map((tab: ApplicationStatusTab) => {
          const isActive = activeStatus === tab.status;
          const count = counts[tab.status as ApplicationStatus | "all"];
          return (
            <button
              key={tab.status}
              onClick={() => {
                setActiveStatus(tab.status as ApplicationStatus | "all");
                setSelectedId(null);
              }}
              style={{
                padding: "8px 14px",
                background: "none", border: "none", cursor: "pointer",
                borderBottom: isActive ? `2px solid var(--royal)` : "2px solid transparent",
                color: isActive ? "var(--royal)" : "var(--ink-mute)",
                fontFamily: "'Inter', sans-serif",
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                display: "flex", alignItems: "center", gap: 6,
                whiteSpace: "nowrap", transition: "color .15s",
              }}
            >
              {tab.labelJa}
              {count > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: isActive ? "var(--royal)" : "var(--line)",
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
              return (
                <button
                  key={app.id}
                  onClick={() => setSelectedId(app.id)}
                  style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: isSelected ? "var(--royal-50)" : "#fff",
                    outline: isSelected ? `2px solid var(--royal)` : "1px solid var(--line)",
                    outlineOffset: -1,
                    textAlign: "left", transition: "background .12s",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: avatarGradient(app.id),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 14,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}>
                    {nameInitial(app.name)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: "var(--ink)",
                      marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {app.name}
                    </div>
                    <div style={{
                      fontSize: 12, color: "var(--ink-mute)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginBottom: 4,
                    }}>
                      {app.jobTitle}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <StatusPill status={app.status} />
                      <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif" }}>
                        {app.appliedAtLabel}
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

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: avatarGradient(app.id),
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 20,
            fontFamily: "'Noto Sans JP', sans-serif",
            flexShrink: 0,
          }}>
            {nameInitial(app.name)}
          </div>
          <div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: "var(--ink)",
              fontFamily: "'Noto Sans JP', sans-serif", marginBottom: 4,
            }}>
              {app.name}
            </div>
            <StatusPill status={app.status} />
          </div>
        </div>

        {/* Status selector */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif" }}>
            ステータス変更
          </label>
          <select
            value={app.status}
            disabled={isUpdating}
            onChange={(e) => {
              const newStatus = e.target.value as ApplicationStatus;
              if (VALID_APPLICATION_STATUSES.has(newStatus)) {
                onStatusChange(app.id, newStatus);
              }
            }}
            style={{
              padding: "6px 10px", borderRadius: 8,
              border: "1px solid var(--line)",
              background: isUpdating ? "var(--bg-tint)" : "#fff",
              fontSize: 13, color: "var(--ink)",
              fontFamily: "'Noto Sans JP', sans-serif",
              cursor: isUpdating ? "not-allowed" : "pointer",
              outline: "none",
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
