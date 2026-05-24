"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import MypageLayout, { type MypageActiveKey } from "./_components/MypageLayout";
import { useMypageMock } from "./_components/MypageMockContext";
import UserProfileCard from "@/components/profile/UserProfileCard";
import MergedTimeline, { type CareerEntry } from "@/components/profile/MergedTimeline";
import {
  toTimelineEducationEntries,
  buildFutureData,
  type RawEducation,
} from "@/lib/utils/timeline";
import {
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
  birth_date: string | null;
  location: string | null;
  social_links: Record<string, string> | null;
  future_aspirations: string | null;
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
          fontFamily: 'var(--font-noto-serif)',
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

// ─── Right column: Recent activity card ──────────────────────────────────────

function RecentActivityItem({
  avatar, companyName, jobTitle, kind, appliedAt, statusKey,
}: {
  avatar: React.ReactNode;
  companyName: string;
  jobTitle: string;
  kind: string;
  appliedAt: string;
  statusKey: string;
}) {
  const truncStyle: React.CSSProperties = {
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  };
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 6,
        padding: "12px 14px",
        background: "var(--bg-tint)", border: "1px solid var(--line)",
        borderRadius: 10, transition: "all 0.2s",
      }}
      className="request-item-row"
    >
      {/* アバター + テキスト列 */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
        <div style={{ flexShrink: 0 }}>{avatar}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...truncStyle, fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
            {companyName}
          </div>
          <div style={{ ...truncStyle, fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 2 }}>
            {jobTitle}
          </div>
          <div style={{ ...truncStyle, fontSize: 11, color: "var(--ink-mute)" }}>
            {kind} · {appliedAt}
          </div>
        </div>
      </div>
      {/* ステータスバッジ: 独立行 */}
      <div>
        <StatusPill statusKey={statusKey} />
      </div>
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

// ─── Profile completeness widget ─────────────────────────────────────────────

function ProfileCompletenessCard({
  userName, userAboutMe, userLocation, userSkillTags, timelineCareers, userEducations, hasCareerPreferences,
}: {
  userName: string;
  userAboutMe?: string | null;
  userLocation?: string | null;
  userSkillTags?: { id: string; label: string; sort_order: number }[];
  timelineCareers?: CareerEntry[];
  userEducations?: { id: string; school: string; [key: string]: unknown }[];
  hasCareerPreferences?: boolean;
}) {
  const checks: { label: string; done: boolean; hint: string }[] = [
    { label: "名前", done: !!userName && userName !== "ユーザー", hint: "名前を設定する" },
    { label: "自己紹介", done: !!userAboutMe && userAboutMe.trim().length > 0, hint: "あなたの経歴や想いを一言で" },
    { label: "居住地", done: !!userLocation && userLocation.trim().length > 0, hint: "勤務地の希望条件に使われます" },
    { label: "スキルタグ", done: (userSkillTags?.length ?? 0) > 0, hint: "得意な技術・スキルを追加" },
    { label: "職歴", done: (timelineCareers?.length ?? 0) > 0, hint: "これまでのキャリアを記録" },
    { label: "学歴", done: (userEducations?.length ?? 0) > 0, hint: "学校・学部を追加" },
    { label: "希望条件", done: !!hasCareerPreferences, hint: "希望職種・勤務スタイルを設定" },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const pct = Math.round((doneCount / checks.length) * 100);

  if (pct === 100) return null; // 完成したら非表示

  const firstMissing = checks.find((c) => !c.done);

  return (
    <section style={{
      background: "linear-gradient(135deg, #EFF3FC 0%, #fff 60%)",
      border: "1.5px solid var(--royal-100)",
      borderRadius: 16,
      padding: "22px 26px",
      marginBottom: 20,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* 背景デコレーション */}
      <div style={{
        position: "absolute", right: -20, top: -20,
        width: 120, height: 120, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,95,217,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, var(--royal), #3B5FD9)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 2px 8px rgba(0,35,102,0.25)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
              プロフィール完成度
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
              充実させるほど、企業に伝わりやすくなります
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 2,
            background: "var(--royal)", borderRadius: 10,
            padding: "6px 14px",
          }}>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 26, fontWeight: 800, color: "#fff",
              lineHeight: 1,
            }}>
              {pct}
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>%</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 10, borderRadius: 100, background: "rgba(0,35,102,0.08)",
        overflow: "hidden", marginBottom: 16,
      }}>
        <div style={{
          height: "100%", borderRadius: 100,
          background: pct >= 80
            ? "linear-gradient(90deg, var(--success), #34D399)"
            : "linear-gradient(90deg, var(--royal), #3B5FD9)",
          width: `${pct}%`,
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: pct >= 80
            ? "0 0 8px rgba(5,150,105,0.4)"
            : "0 0 8px rgba(59,95,217,0.4)",
        }} />
      </div>

      {/* Checklist (6 pills) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {checks.map((c) => (
          <div key={c.label} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 100,
            background: c.done ? "var(--success-soft)" : "var(--bg-tint)",
            border: `1px solid ${c.done ? "#A7F3D0" : "var(--line)"}`,
            fontSize: 11, fontWeight: 600,
            color: c.done ? "var(--success)" : "var(--ink-mute)",
          }}>
            {c.done
              ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
              : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/></svg>
            }
            {c.label}
          </div>
        ))}
      </div>

      {/* Next step CTA */}
      {firstMissing && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href="/profile/edit" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 8,
            background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#fff",
            fontSize: 12, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
            transition: "opacity 0.15s",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14m-7-7h14"/></svg>
            {firstMissing.hint}を追加する
          </Link>
          <span style={{ fontSize: 11, color: "var(--ink-mute)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            入力は自動保存されます
          </span>
        </div>
      )}
    </section>
  );
}

// ─── VIEW: Dashboard ──────────────────────────────────────────────────────────

function DashboardView({
  userId, isMentor, userName, userInitial, userAvatar,
  currentRole,
  userLocation, userAboutMe, userBirthDate, userFutureAspirations, userSocialLinks,
  userSkillTags, userEducations, userCertifications, timelineCareers,
  hasCareerPreferences,
}: {
  userId: string; isMentor: boolean;
  userName: string; userInitial: string; userAvatar: string;
  currentRole?: string | null;
  userLocation?: string | null; userAboutMe?: string | null;
  userBirthDate?: string | null; userFutureAspirations?: string | null;
  userSocialLinks?: Record<string, string> | null;
  userSkillTags?: { id: string; label: string; sort_order: number }[];
  userEducations?: {
    id: string; school: string; school_id: string | null;
    school_master: { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
    faculty: string | null; degree: string | null;
    enrolled_at: string | null; graduated_at: string | null; is_current: boolean; sort_order: number;
  }[];
  userCertifications?: { id: string; name: string; sort_order: number }[];
  timelineCareers?: CareerEntry[];
  hasCareerPreferences?: boolean;
}) {
  // MergedTimeline 用データ整形（/mypage は常に本人なので viewerIsOwner = true）
  const timelineEdus = toTimelineEducationEntries((userEducations ?? []) as RawEducation[]);
  const futureData = buildFutureData(
    { name: userName, avatar_color: userAvatar, future_aspirations: userFutureAspirations ?? null },
    true,
  );
  const hasMergedTimeline =
    (timelineCareers?.length ?? 0) > 0 || timelineEdus.length > 0 || futureData != null;

  return (
    <div>
      {/* プロフィール完成度ウィジェット */}
      <ProfileCompletenessCard
        userName={userName}
        userAboutMe={userAboutMe}
        userLocation={userLocation}
        userSkillTags={userSkillTags}
        timelineCareers={timelineCareers}
        userEducations={userEducations}
        hasCareerPreferences={hasCareerPreferences}
      />

      {/* コンパクトプロフィールカード — Phase ν-6 段階3: 全フィールドインライン編集対応 */}
      <UserProfileCard
        userId={userId}
        userName={userName}
        userInitial={userInitial}
        userAvatar={userAvatar}
        currentRole={currentRole}
        userLocation={userLocation}
        userAboutMe={userAboutMe}
        userBirthDate={userBirthDate}
        userFutureAspirations={userFutureAspirations}
        userSocialLinks={userSocialLinks}
        userSkillTags={userSkillTags}
        userCertifications={userCertifications}
        isMentor={isMentor}
      />

      {/* 経歴タイムライン（キャリア + 学歴 + 未来を統合表示） */}
      {hasMergedTimeline && (
        <SectionBlock title="経歴" titleEn="TIMELINE">
          <MergedTimeline
            careers={timelineCareers ?? []}
            educations={timelineEdus}
            future={futureData}
            viewerIsOwner={true}
          />
        </SectionBlock>
      )}

      {/* ── Quick Actions ── */}
      <section style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 14, padding: "24px 28px", marginBottom: 20,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 10,
          marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--line)",
        }}>
          <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>
            次にやること
          </span>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase" as const }}>
            QUICK ACTIONS
          </span>
        </div>
        <div style={{ display: "grid", gap: 10 }} className="grid-cols-1 sm:grid-cols-3">
          {[
            {
              href: "/companies",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
              ),
              color: "var(--royal)",
              bg: "var(--royal-50)",
              border: "var(--royal-100)",
              title: "企業を探す",
              desc: "IT/SaaS業界の13社を見る",
            },
            {
              href: "/mentors",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              ),
              color: "var(--purple)",
              bg: "var(--purple-soft, #F3E8FF)",
              border: "#DDD6FE",
              title: "先輩に相談する",
              desc: "30分の無料キャリア相談",
            },
            {
              href: "/profile/edit",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              ),
              color: "var(--success)",
              bg: "var(--success-soft)",
              border: "#A7F3D0",
              title: "プロフィールを充実させる",
              desc: "企業に伝えたい経歴を記録",
            },
          ].map(({ href, icon, color, bg, border, title, desc }) => (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "16px 18px",
              background: "var(--bg-tint)", border: "1px solid var(--line)",
              borderRadius: 12, textDecoration: "none",
              transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
            }}
              className="request-item-row"
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: bg, border: `1px solid ${border}`,
                color, display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{desc}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} style={{ flexShrink: 0, marginLeft: "auto" }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}

// ─── VIEW: Casual meetings ────────────────────────────────────────────────────

function CasualView({ casualMeetings }: { casualMeetings: CasualMeeting[] }) {
  const statusMeta: Record<string, string> = {
    pending: "通常 3営業日以内に連絡",
    company_contacted: "企業から連絡あり",
    scheduled: "",
    completed: "実施済",
    declined: "お断りの連絡",
  };

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-noto-serif)', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
        カジュアル面談
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.8 }}>
        あなたが申し込んだカジュアル面談の一覧と、それぞれのステータスを確認できます。
      </p>
      <SectionBlock
        title="申込一覧" titleEn="All Applications"
        right={<span style={{ fontSize: 11, color: "var(--ink-mute)" }}>全 {casualMeetings.length} 件</span>}
      >
        {casualMeetings.length === 0 ? (
          <div style={{ padding: "8px 0" }}>
            <EmptyState
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>}
              title="申し込みはまだありません"
              desc="気になる企業にカジュアル面談を申し込んでみましょう"
            />
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <Link href="/companies" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 20px", borderRadius: 8,
                background: "linear-gradient(135deg, var(--warm), #FBBF24)",
                color: "#fff", fontSize: 12, fontWeight: 700,
                textDecoration: "none", boxShadow: "0 2px 8px rgba(245,158,11,0.25)",
              }}>
                企業を探す →
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {casualMeetings.map((m: CasualMeeting) => (
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
        )}
      </SectionBlock>
    </div>
  );
}

// ─── VIEW: Mentor reservations ────────────────────────────────────────────────

function MentorReserveView({ mentorReservations }: { mentorReservations: MentorReservation[] }) {
  const statusMeta: Record<string, string> = {
    pending_review: "編集部が内容確認中（2〜5営業日）",
    approved: "承認済み · 日程調整へ",
    scheduled: "日程確定",
    completed: "実施済",
    cancelled: "キャンセル済み",
  };

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-noto-serif)', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
        メンター相談
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.8 }}>
        あなたが申し込んだメンター相談の一覧と、それぞれのステータスを確認できます。
      </p>
      <SectionBlock
        title="相談予約一覧" titleEn="Consultation Requests"
        right={<span style={{ fontSize: 11, color: "var(--ink-mute)" }}>全 {mentorReservations.length} 件</span>}
      >
        {mentorReservations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--ink-mute)" }}>
            <p style={{ fontSize: 14, marginBottom: 8 }}>まだメンター相談の申込はありません</p>
            <a href="/mentors" style={{ fontSize: 13, color: "var(--royal)", textDecoration: "none" }}>
              メンターを探す →
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mentorReservations.map((r: MentorReservation) => (
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
        )}
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

function BookmarksView({ companyBookmarks, jobBookmarks, mentorBookmarks }: { companyBookmarks: Bookmark[]; jobBookmarks: Bookmark[]; mentorBookmarks: Bookmark[] }) {
  const sections = [
    { title: "企業", titleEn: "Companies", items: companyBookmarks },
    { title: "求人", titleEn: "Jobs", items: jobBookmarks },
    { title: "メンター", titleEn: "Mentors", items: mentorBookmarks },
  ];
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-noto-serif)', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
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
          {sec.items.length === 0 ? (
            <EmptyState
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>}
              title={`ブックマークした${sec.title}はありません`}
            />
          ) : (
            <BookmarkGrid items={sec.items} />
          )}
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
      <h1 style={{ fontFamily: 'var(--font-noto-serif)', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
        受けた相談
        <span style={{
          fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
          color: "var(--warm)", background: "var(--warm-soft)",
          padding: "4px 10px", borderRadius: 100, letterSpacing: "0.1em",
          marginLeft: 10, verticalAlign: "middle",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          MENTOR
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
      <h1 style={{ fontFamily: 'var(--font-noto-serif)', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
        スケジュール
        <span style={{
          fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
          color: "var(--warm)", background: "var(--warm-soft)",
          padding: "4px 10px", borderRadius: 100, letterSpacing: "0.1em",
          marginLeft: 10, verticalAlign: "middle",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          MENTOR
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MypageClient({
  owUser,
  skillTags = [],
  educations = [],
  certifications = [],
  timelineCareers = [],
  companyBookmarks,
  jobBookmarks,
  mentorBookmarks,
  casualMeetings,
  mentorReservations,
  receivedRequests: receivedRequestsProp = [],
  conversationsBadge,
  applicationsBadge,
  hasCareerPreferences = false,
}: {
  owUser: OwUser;
  skillTags?: { id: string; label: string; sort_order: number }[];
  educations?: {
    id: string; school: string; school_id: string | null;
    school_master: { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
    faculty: string | null; degree: string | null;
    enrolled_at: string | null; graduated_at: string | null; is_current: boolean; sort_order: number;
  }[];
  certifications?: { id: string; name: string; sort_order: number }[];
  timelineCareers?: CareerEntry[];
  companyBookmarks: Bookmark[];
  jobBookmarks: Bookmark[];
  mentorBookmarks: Bookmark[];
  casualMeetings: CasualMeeting[];
  mentorReservations: MentorReservation[];
  receivedRequests?: ReceivedRequest[];
  conversationsBadge?: number;
  applicationsBadge?: number;
  hasCareerPreferences?: boolean;
}) {
  const userName = owUser?.name ?? "ユーザー";
  const userInitial = userName.charAt(0);
  const userAvatar = owUser?.avatar_color ?? "linear-gradient(135deg, #002366, #3B5FD9)";

  // currentRole: 現職の careerEntry から動的に生成（MOCK_USER.currentRole を置き換え）
  const currentCareer = timelineCareers.find((c) => c.is_current);
  const currentRole = currentCareer
    ? `${currentCareer.company_name} · ${currentCareer.role_title ?? currentCareer.role_label}`
    : null;

  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  // isMentor: owUser.is_mentor が真実のソース。開発環境ではモックトグルで上書き可能。
  const { isMentor: isMentorMock } = useMypageMock();
  const isMentor = (owUser?.is_mentor === true) || isMentorMock;
  const [receivedRequests, setReceivedRequests] = useState<ReceivedRequest[]>(receivedRequestsProp);

  const navigate = useCallback((v: ActiveView) => {
    setActiveView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const pendingCasualCount = casualMeetings.filter(
    (m) => m.status === "pending" || m.status === "scheduled"
  ).length;
  const pendingMentorCount = mentorReservations.filter(
    (r) => r.status === "pending_review"
  ).length;
  const pendingReceivedCount = receivedRequests.filter((r) => r.status === "pending").length;

  const totalBookmarks =
    companyBookmarks.length +
    jobBookmarks.length +
    mentorBookmarks.length;

  // Build recentActivity from real Supabase data (sorted by applied_at desc, top 3)
  const recentActivity: {
    id: string;
    avatar: React.ReactNode;
    companyName: string;
    jobTitle: string;
    kind: string;
    appliedAt: string;
    statusKey: string;
  }[] = [
    ...casualMeetings.map((m) => ({
      id: `cm-${m.id}`,
      avatar: <CompanyAvatar initial={m.company_initial} gradient={m.company_gradient} />,
      companyName: m.company_name,
      jobTitle: m.job_title,
      kind: "カジュアル面談",
      appliedAt: `${m.applied_at} 申込`,
      statusKey: m.status,
    })),
    ...mentorReservations.map((r) => ({
      id: `mr-${r.id}`,
      avatar: <PersonAvatar initial={r.mentor_initial} gradient={r.mentor_gradient} hasMentorBadge />,
      companyName: `${r.mentor_name}さん`,
      jobTitle: r.mentor_role,
      kind: "メンター相談",
      appliedAt: `${r.applied_at} 申込`,
      statusKey: r.status,
    })),
  ]
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
    .slice(0, 3);

  const statCards = [
    {
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/></svg>,
      iconBg: "var(--warm-soft)", iconColor: "#B45309",
      value: pendingCasualCount, label: "カジュアル面談\n申込中",
      onClick: () => navigate("casual"),
    },
    {
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
      iconBg: "var(--royal-50)", iconColor: "var(--royal)",
      value: pendingMentorCount, label: "メンター相談\n審査中",
      onClick: () => navigate("mentor-reserve"),
    },
    {
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
      iconBg: "var(--pink-soft, #FCE7F3)", iconColor: "var(--pink)",
      value: totalBookmarks, label: "ブックマーク\n合計",
      onClick: () => navigate("bookmarks"),
    },
    {
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
      iconBg: "var(--purple-soft)", iconColor: "var(--purple)",
      value: mentorBookmarks.length, label: "メンター\nブックマーク",
      onClick: () => navigate("bookmarks"),
    },
  ];

  const dashboardRightColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 最近の申込 */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>最近の申込</span>
          <button
            onClick={() => navigate("casual")}
            style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, border: "none", background: "none", cursor: "pointer" }}
          >
            すべて見る →
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--warm-soft)", color: "#B45309",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 8px",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 4 }}>まだ申込はありません</div>
            <Link href="/companies" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
              企業を探す →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentActivity.map((item) => (
              <RecentActivityItem
                key={item.id}
                avatar={item.avatar}
                companyName={item.companyName}
                jobTitle={item.jobTitle}
                kind={item.kind}
                appliedAt={item.appliedAt}
                statusKey={item.statusKey}
              />
            ))}
          </div>
        )}
      </div>

      {/* ブックマーク */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>ブックマーク</span>
          <button
            onClick={() => navigate("bookmarks")}
            style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, border: "none", background: "none", cursor: "pointer" }}
          >
            すべて見る →
          </button>
        </div>
        {companyBookmarks.length === 0 ? (
          <div style={{ padding: "12px 0", textAlign: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--bg-tint)", color: "var(--ink-mute)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 8px",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 4 }}>まだブックマークがありません</div>
            <Link href="/companies" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
              企業を見る →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {companyBookmarks.slice(0, 3).map((bk) => (
              <Link key={bk.id} href={bk.href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    background: "#fff", border: "1px solid var(--line)",
                    borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  className="bookmark-card-hover"
                >
                  <div style={{
                    fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700,
                    color: "var(--ink-mute)", letterSpacing: "0.1em",
                    textTransform: "uppercase", marginBottom: 4,
                  }}>
                    {bk.badge_label}
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "var(--ink)",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  } as React.CSSProperties}>
                    {bk.title}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* マイアクティビティ */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>マイアクティビティ</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {statCards.map((card, i) => (
            <div
              key={i}
              onClick={card.onClick}
              style={{
                background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
                padding: "14px", cursor: "pointer",
                transition: "all 0.2s",
              }}
              className="stat-card-hover"
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: card.iconBg, color: card.iconColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 8,
              }}>
                {card.icon}
              </div>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 700,
                color: "var(--ink)", marginBottom: 2,
              }}>
                {card.value}
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-soft)", fontWeight: 500, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

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

  return (
    <MypageLayout
      activeKey={activeView}
      onNavigate={(key: MypageActiveKey) => navigate(key as ActiveView)}
      onIsMentorChange={(v) => {
        // isMentor が false に戻ったときメンター専用ビューを解除する
        if (!v && (activeView === "mentor-requests" || activeView === "mentor-schedule")) {
          setActiveView("dashboard");
        }
      }}
      pendingReceivedCount={pendingReceivedCount}
      conversationsBadge={conversationsBadge}
      applicationsBadge={applicationsBadge}
      rightColumn={activeView === "dashboard" ? dashboardRightColumn : undefined}
    >
      {activeView === "dashboard" && (
        <DashboardView
          userId={owUser?.id ?? ""}
          isMentor={isMentor}
          userName={userName}
          userInitial={userInitial}
          userAvatar={userAvatar}
          currentRole={currentRole}
          userLocation={owUser?.location}
          userAboutMe={owUser?.about_me}
          userBirthDate={owUser?.birth_date}
          userFutureAspirations={owUser?.future_aspirations}
          userSocialLinks={owUser?.social_links}
          userSkillTags={skillTags}
          userEducations={educations}
          userCertifications={certifications}
          timelineCareers={timelineCareers}
          hasCareerPreferences={hasCareerPreferences}
        />
      )}
      {activeView === "casual" && <CasualView casualMeetings={casualMeetings} />}
      {activeView === "mentor-reserve" && <MentorReserveView mentorReservations={mentorReservations} />}
      {activeView === "bookmarks" && <BookmarksView companyBookmarks={companyBookmarks} jobBookmarks={jobBookmarks} mentorBookmarks={mentorBookmarks} />}
      {activeView === "mentor-requests" && (
        <MentorRequestsView
          requests={receivedRequests}
          onApprove={handleApprove}
          onDecline={handleDecline}
        />
      )}
      {activeView === "mentor-schedule" && <MentorScheduleView />}

      <style>{`
        .request-item-row:hover { border-color: var(--royal-100) !important; background: #fff !important; }
        .stat-card-hover:hover { border-color: var(--royal-100) !important; box-shadow: 0 4px 14px rgba(15,23,42,0.06) !important; transform: translateY(-1px); }
        .bookmark-card-hover:hover { border-color: var(--royal-100) !important; box-shadow: 0 4px 12px rgba(15,23,42,0.05) !important; }
      `}</style>
    </MypageLayout>
  );
}
