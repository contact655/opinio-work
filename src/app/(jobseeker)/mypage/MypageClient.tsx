"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  MOCK_USER,
  MOCK_CASUAL_MEETINGS,
  MOCK_MENTOR_RESERVATIONS,
  MOCK_BOOKMARKS_ARTICLES,
  MOCK_BOOKMARKS_MENTORS,
  MOCK_RECEIVED_REQUESTS,
  PILL_STYLES,
  STATUS_LABEL,
  STATUS_VARIANT,
  type CasualMeeting,
  type MentorReservation,
  type Bookmark,
  type ReceivedRequest,
  type PillVariant,
} from "@/app/mypage/mockMypageData";

type OwUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  cover_color: string | null;
  about_me: string | null;
  age_range: string | null;
  location: string | null;
  social_links: Record<string, string> | null;
  is_mentor: boolean;
} | null;

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveView =
  | "dashboard"
  | "casual"
  | "mentor-reserve"
  | "bookmarks"
  | "mentor-requests"
  | "mentor-schedule";

// ─── Shared: Status Pill ──────────────────────────────────────────────────────

function StatusPill({
  statusKey,
  label,
}: {
  statusKey: string;
  label?: string;
}) {
  const variant: PillVariant = STATUS_VARIANT[statusKey] ?? "gray";
  const { bg, color } = PILL_STYLES[variant];
  const text = label ?? STATUS_LABEL[statusKey] ?? statusKey;
  return (
    <span style={{
      padding: "3px 9px", borderRadius: 100,
      fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
      letterSpacing: "0.05em", whiteSpace: "nowrap",
      background: bg, color,
    }}>
      {text}
    </span>
  );
}

// ─── Shared: Section block ────────────────────────────────────────────────────

function SectionBlock({
  title, titleEn, right, children,
}: {
  title: string; titleEn?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 14, padding: "24px 28px", marginBottom: 20,
    }}>
      <div style={{
        display: "flex", alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 18, paddingBottom: 14,
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{
          fontFamily: '"Noto Serif JP", serif',
          fontSize: 17, fontWeight: 600, color: "var(--ink)",
          display: "flex", alignItems: "baseline", gap: 10,
        }}>
          {title}
          {titleEn && (
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
              color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
            }}>
              {titleEn}
            </span>
          )}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ─── Shared: Request item (casual meeting / mentor reservation row) ───────────

function RequestItem({
  avatar, title, meta, statusKey, statusLabel,
  onClick,
}: {
  avatar: React.ReactNode;
  title: string;
  meta: React.ReactNode;
  statusKey: string;
  statusLabel?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "grid", gridTemplateColumns: "40px 1fr auto",
        gap: 14, alignItems: "center",
        padding: "12px 14px",
        background: "var(--bg-tint)", border: "1px solid var(--line)",
        borderRadius: 10, cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s",
      }}
      className="request-item-row"
    >
      {avatar}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.5 }}>{meta}</div>
      </div>
      <StatusPill statusKey={statusKey} label={statusLabel} />
    </div>
  );
}

function CompanyAvatar({ initial, gradient }: { initial: string; gradient: string }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 8, background: gradient,
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 16, flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}

function PersonAvatar({
  initial, gradient, size = 40, hasMentorBadge = false,
}: {
  initial: string; gradient: string; size?: number; hasMentorBadge?: boolean;
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: gradient,
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 600, fontSize: size * 0.4, flexShrink: 0, position: "relative",
    }}>
      {initial}
      {hasMentorBadge && (
        <div style={{
          position: "absolute", bottom: -2, right: -2,
          width: 14, height: 14,
          background: "linear-gradient(135deg, var(--royal), var(--accent))",
          color: "#fff", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid #fff",
        }}>
          <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
          </svg>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
      <div style={{
        width: 48, height: 48, background: "var(--bg-tint)", color: "var(--ink-mute)",
        borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 10px",
      }}>
        {icon}
      </div>
      <div style={{ fontWeight: 600, color: "var(--ink-soft)", marginBottom: 4 }}>{title}</div>
      {desc && <div>{desc}</div>}
    </div>
  );
}

// ─── Sidebar item ─────────────────────────────────────────────────────────────

function SidebarItem({
  icon, label, active, badge, onClick,
}: {
  icon: React.ReactNode; label: string; active: boolean;
  badge?: number; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 24px", fontSize: 13, fontWeight: active ? 600 : 500,
        color: active ? "var(--royal)" : "var(--ink-soft)",
        cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "space-between",
        borderLeft: `3px solid ${active ? "var(--royal)" : "transparent"}`,
        background: active ? "var(--royal-50)" : "transparent",
        transition: "all 0.15s",
      }}
      className="mypage-nav-item"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: active ? "var(--royal)" : "var(--ink-mute)", flexShrink: 0 }}>
          {icon}
        </span>
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <span style={{
          background: "var(--royal)", color: "#fff",
          fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
          padding: "1px 7px", borderRadius: 100, minWidth: 18, textAlign: "center",
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── VIEW: Dashboard ──────────────────────────────────────────────────────────

function DashboardView({
  isMentor, onNavigate, userName, userInitial, userAvatar, userCover, companyBookmarks,
}: {
  isMentor: boolean; onNavigate: (v: ActiveView) => void;
  userName: string; userInitial: string; userAvatar: string; userCover: string;
  companyBookmarks: Bookmark[];
}) {
  const pendingCasual = MOCK_CASUAL_MEETINGS.filter(
    (m) => m.status === "pending" || m.status === "scheduled"
  ).length;
  const pendingMentor = MOCK_MENTOR_RESERVATIONS.filter(
    (r) => r.status === "pending_review"
  ).length;
  const totalBookmarks =
    MOCK_BOOKMARKS_ARTICLES.length +
    companyBookmarks.length +
    MOCK_BOOKMARKS_MENTORS.length;

  const recentActivity: {
    id: string;
    avatar: React.ReactNode;
    title: string;
    meta: string;
    statusKey: string;
    isMentorRow?: boolean;
  }[] = [
    {
      id: "cm-1",
      avatar: <CompanyAvatar initial="L" gradient="linear-gradient(135deg,#1E40AF,#002366)" />,
      title: "株式会社LayerX · Bakuraku事業 PdM",
      meta: "カジュアル面談 · 2026.04.18 申込",
      statusKey: "pending",
    },
    {
      id: "mr-1",
      avatar: <PersonAvatar initial="渡" gradient="linear-gradient(135deg,#A78BFA,#7C3AED)" hasMentorBadge />,
      title: "渡辺 美穂さん · AIスタートアップA社 CPO",
      meta: "メンター相談 · 2026.04.16 申込",
      statusKey: "pending_review",
      isMentorRow: true,
    },
    {
      id: "cm-2",
      avatar: <CompanyAvatar initial="S" gradient="linear-gradient(135deg,#00B4D8,#0077B6)" />,
      title: "SmartHR株式会社 · プロダクト企画",
      meta: "カジュアル面談 · 2026.04.12 申込 · 2026.04.28(火) 14:00〜",
      statusKey: "scheduled",
    },
  ];

  return (
    <div>
      <h1 style={{
        fontFamily: '"Noto Serif JP", serif', fontWeight: 500,
        fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em",
      }}>
        おかえりなさい、田中翔太さん
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.8 }}>
        あなたのOpinio活動の全体像を確認できます。
      </p>

      {/* Profile card */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 16, overflow: "hidden", marginBottom: 20,
      }}>
        <div style={{
          height: 100,
          background: userCover,
        }} />
        <div style={{ padding: "0 28px 24px", marginTop: -40, position: "relative" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: userAvatar,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 600,
            border: "4px solid #fff", boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
            marginBottom: 14,
          }}>
            {userInitial}
            {isMentor && (
              <div style={{
                position: "absolute", bottom: 0, right: 0,
                width: 22, height: 22,
                background: "linear-gradient(135deg, var(--royal), var(--accent))",
                borderRadius: "50%", border: "3px solid #fff",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                </svg>
              </div>
            )}
          </div>
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            gap: 16, flexWrap: "wrap", marginBottom: 4,
          }}>
            <div>
              <div style={{
                fontFamily: '"Noto Serif JP", serif',
                fontWeight: 700, fontSize: 20, color: "var(--ink)",
              }}>
                {userName}
                {isMentor && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 18, height: 18, marginLeft: 6,
                    background: "linear-gradient(135deg, var(--royal), var(--accent))",
                    color: "#fff", borderRadius: "50%", verticalAlign: "middle",
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                    </svg>
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                {MOCK_USER.currentRole}
              </div>
            </div>
            <Link href="/profile/edit" style={{
              padding: "7px 14px", background: "#fff", color: "var(--ink)",
              border: "1px solid var(--line)", borderRadius: 8,
              fontFamily: "inherit", fontSize: 12, fontWeight: 600,
            }}>
              プロフィールを編集
            </Link>
          </div>
          {/* Completeness bar */}
          <div style={{
            background: "var(--bg-tint)", borderRadius: 10, padding: "12px 16px", marginTop: 16,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>プロフィール完成度</span>
              <span style={{
                fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, color: "var(--royal)",
              }}>
                {MOCK_USER.profileCompletion}%
              </span>
            </div>
            <div style={{ height: 6, background: "#fff", borderRadius: 100, overflow: "hidden", marginBottom: 8 }}>
              <div style={{
                height: "100%", width: `${MOCK_USER.profileCompletion}%`,
                background: "linear-gradient(to right, var(--royal), var(--accent))",
                borderRadius: 100,
              }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6 }}>
              基本情報と職歴を充実させると、企業やメンターがあなたをより理解できます。
              <Link href="/profile/edit" style={{ color: "var(--royal)", fontWeight: 600, marginLeft: 4 }}>
                プロフィールを編集する →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20,
      }}>
        {[
          {
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/></svg>,
            iconBg: "var(--warm-soft)", iconColor: "#B45309",
            value: pendingCasual, label: "カジュアル面談\n申込中",
            onClick: () => onNavigate("casual"),
          },
          {
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
            iconBg: "var(--royal-50)", iconColor: "var(--royal)",
            value: pendingMentor, label: "メンター相談\n審査中",
            onClick: () => onNavigate("mentor-reserve"),
          },
          {
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
            iconBg: "var(--pink-soft, #FCE7F3)", iconColor: "#DB2777",
            value: totalBookmarks, label: "ブックマーク\n合計",
            onClick: () => onNavigate("bookmarks"),
          },
          {
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
            iconBg: "var(--purple-soft)", iconColor: "var(--purple)",
            value: 8, label: "閲覧した\n記事数",
            onClick: undefined,
          },
        ].map((card, i) => (
          <div
            key={i}
            onClick={card.onClick}
            style={{
              background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
              padding: "18px 20px", cursor: card.onClick ? "pointer" : "default",
              transition: "all 0.2s",
            }}
            className={card.onClick ? "stat-card-hover" : ""}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: card.iconBg, color: card.iconColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 10,
            }}>
              {card.icon}
            </div>
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 700,
              color: "var(--ink)", marginBottom: 2,
            }}>
              {card.value}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 500, lineHeight: 1.5, whiteSpace: "pre-line" }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <SectionBlock
        title="最近の申込"
        titleEn="Recent Applications"
        right={
          <button
            onClick={() => onNavigate("casual")}
            style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, border: "none", background: "none", cursor: "pointer" }}
          >
            すべて見る →
          </button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recentActivity.map((item) => (
            <RequestItem
              key={item.id}
              avatar={item.avatar}
              title={item.title}
              meta={<span style={{ color: "var(--ink-soft)" }}>{item.meta}</span>}
              statusKey={item.statusKey}
            />
          ))}
        </div>
      </SectionBlock>

      {/* Bookmarks preview */}
      <SectionBlock
        title="ブックマーク"
        titleEn="Bookmarks"
        right={
          <button
            onClick={() => onNavigate("bookmarks")}
            style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, border: "none", background: "none", cursor: "pointer" }}
          >
            すべて見る →
          </button>
        }
      >
        {companyBookmarks.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
            ブックマークした企業がここに表示されます
          </div>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {companyBookmarks.slice(0, 3).map((bk) => (
            <Link key={bk.id} href={bk.href} style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 10, padding: "14px 16px", cursor: "pointer",
                transition: "all 0.2s", height: "100%",
              }}
              className="bookmark-card-hover"
            >
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700,
                color: "var(--ink-mute)", letterSpacing: "0.1em",
                textTransform: "uppercase", marginBottom: 6,
              }}>
                {bk.badge_label}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: "var(--ink)",
                lineHeight: 1.5, marginBottom: 8,
                display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              } as React.CSSProperties}>
                {bk.title}
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-mute)", lineHeight: 1.5 }}>{bk.meta}</div>
            </div>
            </Link>
          ))}
        </div>
        )}
      </SectionBlock>
    </div>
  );
}

// ─── VIEW: Casual meetings ────────────────────────────────────────────────────

function CasualView() {
  const statusMeta: Record<string, string> = {
    pending: "通常 3営業日以内に連絡",
    company_contacted: "企業から連絡あり",
    scheduled: "",
    completed: "実施済",
    declined: "お断りの連絡",
  };

  return (
    <div>
      <h1 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
        カジュアル面談
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.8 }}>
        あなたが申し込んだカジュアル面談の一覧と、それぞれのステータスを確認できます。
      </p>
      <SectionBlock
        title="申込一覧" titleEn="All Applications"
        right={<span style={{ fontSize: 11, color: "var(--ink-mute)" }}>全 {MOCK_CASUAL_MEETINGS.length} 件</span>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MOCK_CASUAL_MEETINGS.map((m: CasualMeeting) => (
            <RequestItem
              key={m.id}
              avatar={<CompanyAvatar initial={m.company_initial} gradient={m.company_gradient} />}
              title={`${m.company_name} · ${m.job_title}`}
              meta={
                <span>
                  {m.applied_at} 申込
                  {m.scheduled_at
                    ? <span style={{ color: "var(--ink-mute)" }}> · {m.scheduled_at}</span>
                    : statusMeta[m.status]
                    ? <span style={{ color: "var(--ink-mute)" }}> · {statusMeta[m.status]}</span>
                    : null}
                </span>
              }
              statusKey={m.status}
            />
          ))}
        </div>
      </SectionBlock>
    </div>
  );
}

// ─── VIEW: Mentor reservations ────────────────────────────────────────────────

function MentorReserveView() {
  const statusMeta: Record<string, string> = {
    pending_review: "編集部が内容確認中（2〜5営業日）",
    approved: "承認済み · 日程調整へ",
    scheduled: "日程確定",
    completed: "実施済",
    cancelled: "キャンセル済み",
  };

  return (
    <div>
      <h1 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
        メンター相談
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.8 }}>
        あなたが申し込んだメンター相談の一覧と、それぞれのステータスを確認できます。
      </p>
      <SectionBlock
        title="相談予約一覧" titleEn="Consultation Requests"
        right={<span style={{ fontSize: 11, color: "var(--ink-mute)" }}>全 {MOCK_MENTOR_RESERVATIONS.length} 件</span>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MOCK_MENTOR_RESERVATIONS.map((r: MentorReservation) => (
            <RequestItem
              key={r.id}
              avatar={<PersonAvatar initial={r.mentor_initial} gradient={r.mentor_gradient} hasMentorBadge />}
              title={`${r.mentor_name}さん · ${r.mentor_role}`}
              meta={
                <span>
                  {r.applied_at} 申込
                  {r.scheduled_at
                    ? <span style={{ color: "var(--ink-mute)" }}> · {r.scheduled_at}</span>
                    : <span style={{ color: "var(--ink-mute)" }}> · {statusMeta[r.status]}</span>}
                </span>
              }
              statusKey={r.status}
            />
          ))}
        </div>
      </SectionBlock>
    </div>
  );
}

// ─── VIEW: Bookmarks ──────────────────────────────────────────────────────────

function BookmarkGrid({ items }: { items: Bookmark[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
      {items.map((bk) => (
        <Link key={bk.id} href={bk.href} style={{ textDecoration: "none" }}>
          <div style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 10, padding: "14px 16px", height: "100%",
            transition: "all 0.2s",
          }} className="bookmark-card-hover">
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700,
              color: "var(--ink-mute)", letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: 6,
            }}>
              {bk.badge_label}
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5, marginBottom: 8,
              display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", overflow: "hidden",
            } as React.CSSProperties}>
              {bk.title}
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-mute)", lineHeight: 1.5 }}>{bk.meta}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function BookmarksView({ companyBookmarks }: { companyBookmarks: Bookmark[] }) {
  // target_type='company' uses real DB data; articles/mentors remain mock pending table availability
  const sections = [
    { title: "記事", titleEn: "Articles", items: MOCK_BOOKMARKS_ARTICLES },
    { title: "企業", titleEn: "Companies", items: companyBookmarks },
    { title: "メンター", titleEn: "Mentors", items: MOCK_BOOKMARKS_MENTORS },
  ];
  return (
    <div>
      <h1 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
        ブックマーク
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.8 }}>
        あなたがブックマークした企業・記事・メンターを一覧できます。
      </p>
      {sections.map((sec) => (
        <SectionBlock
          key={sec.title} title={sec.title} titleEn={sec.titleEn}
          right={<span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{sec.items.length} 件</span>}
        >
          <BookmarkGrid items={sec.items} />
        </SectionBlock>
      ))}
    </div>
  );
}

// ─── VIEW: Mentor received requests ──────────────────────────────────────────

function MentorRequestsView({
  requests, onApprove, onDecline,
}: {
  requests: ReceivedRequest[];
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const done = requests.filter((r) => r.status !== "pending");

  return (
    <div>
      <h1 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
        受けた相談
        <span style={{
          fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
          color: "var(--warm)", background: "var(--warm-soft)",
          padding: "4px 10px", borderRadius: 100, letterSpacing: "0.1em",
          marginLeft: 10, verticalAlign: "middle",
        }}>
          ⭐ MENTOR
        </span>
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.8 }}>
        あなたがメンターとして受けた相談リクエストを確認・承認できます。
      </p>

      {/* Pending */}
      <SectionBlock
        title="対応待ち" titleEn="Pending Approval"
        right={<span style={{ fontSize: 11, color: "var(--warm)", fontWeight: 700 }}>{pending.length} 件</span>}
      >
        {pending.length === 0 ? (
          <EmptyState
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01 9 11.01"/></svg>}
            title="対応待ちの相談はありません"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pending.map((r) => (
              <div key={r.id} style={{
                background: "#fff", border: "1.5px solid var(--line)",
                borderLeft: "3px solid var(--warm)",
                borderRadius: 12, padding: "16px 18px",
                transition: "all 0.2s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <PersonAvatar initial={r.requester_initial} gradient={r.requester_gradient} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
                      {r.requester_name}さん · {r.requester_age}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                      {r.requester_company} · {r.requester_role}
                    </div>
                  </div>
                  <StatusPill statusKey="pending_received" label="未対応" />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                  {r.themes.map((t) => (
                    <span key={t} style={{
                      padding: "3px 8px", background: "var(--royal-50)", color: "var(--royal)",
                      borderRadius: 4, fontSize: 10, fontWeight: 600,
                    }}>
                      ✓ {t}
                    </span>
                  ))}
                </div>
                <div style={{
                  fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7,
                  padding: "10px 12px", background: "var(--bg-tint)",
                  borderRadius: 8, marginBottom: 10,
                }}>
                  {r.preview_text}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => onDecline(r.id)}
                    style={{
                      padding: "7px 14px", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                      borderRadius: 7, cursor: "pointer",
                      border: "1px solid var(--error-soft)", background: "#fff", color: "var(--error)",
                    }}
                  >
                    見送る
                  </button>
                  <button style={{
                    padding: "7px 14px", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                    borderRadius: 7, cursor: "pointer",
                    border: "1px solid var(--line)", background: "#fff", color: "var(--ink)",
                  }}>
                    詳細を見る
                  </button>
                  <button
                    onClick={() => onApprove(r.id)}
                    style={{
                      padding: "7px 14px", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                      borderRadius: 7, cursor: "pointer",
                      border: "none", background: "var(--royal)", color: "#fff",
                    }}
                  >
                    承認する
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionBlock>

      {/* Done */}
      <SectionBlock
        title="対応済み" titleEn="Completed"
        right={<span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{done.length} 件</span>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {done.map((r) => (
            <RequestItem
              key={r.id}
              avatar={<PersonAvatar initial={r.requester_initial} gradient={r.requester_gradient} size={40} />}
              title={`${r.requester_name}さん · ${r.requester_company} ${r.requester_role}`}
              meta={<span style={{ color: "var(--ink-mute)" }}>{r.resolved_at} 相談実施 · {r.themes.join(", ")}</span>}
              statusKey="completed_received"
              statusLabel="完了"
            />
          ))}
        </div>
      </SectionBlock>
    </div>
  );
}

// ─── VIEW: Mentor schedule ────────────────────────────────────────────────────

function MentorScheduleView() {
  return (
    <div>
      <h1 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
        スケジュール
        <span style={{
          fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
          color: "var(--warm)", background: "var(--warm-soft)",
          padding: "4px 10px", borderRadius: 100, letterSpacing: "0.1em",
          marginLeft: 10, verticalAlign: "middle",
        }}>
          ⭐ MENTOR
        </span>
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.8 }}>
        今後のメンター相談の予定を確認できます。
      </p>
      <SectionBlock title="これからの予定" titleEn="Upcoming">
        <EmptyState
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          title="予定はありません"
          desc="承認した相談は、日程調整後こちらに表示されます。"
        />
      </SectionBlock>
    </div>
  );
}

// ─── Icons (inline SVG helpers) ──────────────────────────────────────────────

const Icons = {
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  briefcase: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/></svg>,
  message: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  bookmark: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01 9 11.01"/></svg>,
  calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MypageClient({ owUser, companyBookmarks }: { owUser: OwUser; companyBookmarks: Bookmark[] }) {
  const userName = owUser?.name ?? "ユーザー";
  const userInitial = userName.charAt(0);
  const userAvatar = owUser?.avatar_color ?? "linear-gradient(135deg, #002366, #3B5FD9)";
  const userCover = owUser?.cover_color ?? "linear-gradient(135deg, #002366, #3B5FD9, #818CF8)";

  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [isMentor, setIsMentor] = useState(owUser?.is_mentor ?? false);
  const [showBanner, setShowBanner] = useState(true);
  const [receivedRequests, setReceivedRequests] = useState(MOCK_RECEIVED_REQUESTS);

  const navigate = useCallback((v: ActiveView) => {
    setActiveView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const pendingCasualCount = MOCK_CASUAL_MEETINGS.filter(
    (m) => m.status === "pending" || m.status === "scheduled"
  ).length;
  const pendingMentorCount = MOCK_MENTOR_RESERVATIONS.filter(
    (r) => r.status === "pending_review"
  ).length;
  const pendingReceivedCount = receivedRequests.filter((r) => r.status === "pending").length;

  const handleApprove = (id: string) => {
    setReceivedRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "approved" as const } : r))
    );
  };
  const handleDecline = (id: string) => {
    setReceivedRequests((prev) =>
      prev.filter((r) => r.id !== id)
    );
  };

  const topOffset = showBanner ? 116 : 65;

  return (
    <>
      {/* Mock role toggle */}
      <div style={{
        background: "var(--bg-tint)", padding: "10px 32px",
        borderBottom: "1px solid var(--line)",
        display: "flex", alignItems: "center", gap: 10,
        position: "sticky", top: 65, zIndex: 50,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
          letterSpacing: "0.1em", textTransform: "uppercase",
          fontFamily: "Inter, sans-serif",
        }}>
          MOCK:
        </span>
        {[
          { label: "通常ユーザー", value: false },
          { label: "メンター登録済み", value: true },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => {
              setIsMentor(opt.value);
              if (!opt.value && (activeView === "mentor-requests" || activeView === "mentor-schedule")) {
                setActiveView("dashboard");
              }
            }}
            style={{
              padding: "5px 12px",
              background: isMentor === opt.value ? "var(--royal)" : "#fff",
              color: isMentor === opt.value ? "#fff" : "var(--ink-soft)",
              border: `1px solid ${isMentor === opt.value ? "var(--royal)" : "var(--line)"}`,
              borderRadius: 100, fontFamily: "inherit", fontSize: 11,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-mute)" }}>
          ※ モック用の切替。本番ではユーザーの役割に応じて動的に表示
        </span>
      </div>

      {/* Onboarding banner */}
      {showBanner && (
        <div style={{
          background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)",
          borderBottom: "1px solid var(--royal-100)",
          padding: "14px 32px",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, background: "var(--royal)", color: "#fff",
            borderRadius: 10, display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0,
          }}>
            {Icons.user}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 2 }}>
              プロフィールを完成させましょう
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              キャリア情報を追加すると、企業やメンターがあなたのことを理解しやすくなります。
            </div>
          </div>
          <Link href="/profile/edit" style={{
            padding: "7px 14px", background: "var(--royal)", color: "#fff",
            border: "none", borderRadius: 8, fontFamily: "inherit",
            fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            プロフィールを編集
          </Link>
          <button
            onClick={() => setShowBanner(false)}
            style={{
              border: "none", background: "none", cursor: "pointer",
              color: "var(--ink-mute)", padding: 6, borderRadius: 6,
              display: "flex", alignItems: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: `calc(100vh - ${topOffset}px)` }}>

        {/* Sidebar */}
        <aside style={{
          background: "#fff", borderRight: "1px solid var(--line)",
          padding: "24px 0",
          position: "sticky", top: topOffset, alignSelf: "start",
          height: `calc(100vh - ${topOffset}px)`, overflowY: "auto",
        }}>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "0 24px 10px",
          }}>
            マイアクティビティ
          </div>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            <SidebarItem icon={Icons.dashboard} label="ダッシュボード" active={activeView === "dashboard"} onClick={() => navigate("dashboard")} />
            <SidebarItem icon={Icons.briefcase} label="カジュアル面談" active={activeView === "casual"} badge={pendingCasualCount} onClick={() => navigate("casual")} />
            <SidebarItem icon={Icons.message} label="メンター相談" active={activeView === "mentor-reserve"} badge={pendingMentorCount} onClick={() => navigate("mentor-reserve")} />
            <SidebarItem icon={Icons.bookmark} label="ブックマーク" active={activeView === "bookmarks"} onClick={() => navigate("bookmarks")} />
          </nav>

          {isMentor && (
            <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--line-soft)" }}>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "16px 24px 8px",
              }}>
                ⭐ メンター管理
              </div>
              <nav style={{ display: "flex", flexDirection: "column" }}>
                <SidebarItem icon={Icons.check} label="受けた相談" active={activeView === "mentor-requests"} badge={pendingReceivedCount} onClick={() => navigate("mentor-requests")} />
                <SidebarItem icon={Icons.calendar} label="スケジュール" active={activeView === "mentor-schedule"} onClick={() => navigate("mentor-schedule")} />
              </nav>
            </div>
          )}

          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "20px 24px 8px",
          }}>
            アカウント
          </div>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            <SidebarItem icon={Icons.user} label="プロフィールを編集" active={false} onClick={() => { window.location.href = "/profile/edit"; }} />
            <SidebarItem icon={Icons.settings} label="設定" active={false} onClick={() => {}} />
          </nav>
        </aside>

        {/* Main */}
        <main style={{ padding: "36px 40px 60px", maxWidth: 1000 }}>
          {activeView === "dashboard" && (
            <DashboardView
              isMentor={isMentor}
              onNavigate={navigate}
              userName={userName}
              userInitial={userInitial}
              userAvatar={userAvatar}
              userCover={userCover}
              companyBookmarks={companyBookmarks}
            />
          )}
          {activeView === "casual" && <CasualView />}
          {activeView === "mentor-reserve" && <MentorReserveView />}
          {activeView === "bookmarks" && <BookmarksView companyBookmarks={companyBookmarks} />}
          {activeView === "mentor-requests" && (
            <MentorRequestsView
              requests={receivedRequests}
              onApprove={handleApprove}
              onDecline={handleDecline}
            />
          )}
          {activeView === "mentor-schedule" && <MentorScheduleView />}
        </main>
      </div>

      <style>{`
        .mypage-nav-item:hover { background: var(--bg-tint) !important; color: var(--ink) !important; }
        .request-item-row:hover { border-color: var(--royal-100) !important; background: #fff !important; }
        .stat-card-hover:hover { border-color: var(--royal-100) !important; box-shadow: 0 4px 14px rgba(15,23,42,0.06) !important; transform: translateY(-1px); }
        .bookmark-card-hover:hover { border-color: var(--royal-100) !important; box-shadow: 0 4px 12px rgba(15,23,42,0.05) !important; }
      `}</style>
    </>
  );
}
