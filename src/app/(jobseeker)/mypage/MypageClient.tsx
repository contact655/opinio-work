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
  type Bookmark,
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
} | null;

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveView =
  | "dashboard"
  | "casual"
  | "bookmarks";

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
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", lineHeight: 1.5 }}>{meta}</div>
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
      fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "var(--text-md)", flexShrink: 0,
    }}>
      {initial}
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
          <div style={{ ...truncStyle, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
            {companyName}
          </div>
          <div style={{ ...truncStyle, fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 2 }}>
            {jobTitle}
          </div>
          <div style={{ ...truncStyle, fontSize: "var(--text-xs)", color: "var(--ink-mute)" }}>
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
    <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--ink-mute)", fontSize: "var(--text-sm)" }}>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
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
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "var(--text-sm)", fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>%</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 10, borderRadius: 100, background: "rgba(0,35,102,0.08)",
        overflow: "hidden", marginBottom: "var(--space-4)",
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
            fontSize: "var(--text-xs)", fontWeight: 600,
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

      {/* 面談承認率UPバナー */}
      <div style={{
        fontSize: 12, color: "var(--ink-soft)",
        background: "var(--royal-50)", borderRadius: 8,
        padding: "8px 12px", marginTop: 8, marginBottom: 14,
        lineHeight: 1.6,
      }}>
        プロフィールを完成させると、企業担当者からの面談承認率が上がります
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
  userId, userName, userInitial, userAvatar,
  currentRole,
  userLocation, userAboutMe, userBirthDate, userFutureAspirations, userSocialLinks,
  userSkillTags, userEducations, userCertifications, timelineCareers,
  hasCareerPreferences,
}: {
  userId: string;
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
        isMentor={false}
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

// ─── Casual meeting step indicator ────────────────────────────────────────────

const CASUAL_STEPS = ["申込完了", "企業確認中", "日程調整", "面談実施"] as const;

function getStepIndex(status: string): number {
  if (status === "pending") return 0;
  if (status === "company_contacted") return 1;
  if (status === "scheduled") return 2;
  if (status === "completed") return 3;
  return -1; // declined or unknown
}

function CasualMeetingSteps({ status }: { status: string }) {
  if (status === "declined") {
    return (
      <div style={{
        paddingLeft: 54, paddingTop: 4, paddingBottom: 2,
        fontSize: 9, color: "var(--ink-mute)",
        fontFamily: "Inter, sans-serif",
      }}>
        見送り
      </div>
    );
  }
  const activeStep = getStepIndex(status);
  if (activeStep < 0) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 0,
      paddingLeft: 54, paddingTop: 5, paddingBottom: 2,
    }}>
      {CASUAL_STEPS.map((label, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: i <= activeStep ? "var(--royal)" : "var(--line)",
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 9, color: i <= activeStep ? "var(--royal)" : "var(--ink-mute)",
              fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
              fontWeight: i === activeStep ? 700 : 400,
            }}>
              {label}
            </span>
          </div>
          {i < CASUAL_STEPS.length - 1 && (
            <div style={{
              width: 18, height: 1,
              background: i < activeStep ? "var(--royal)" : "var(--line)",
              marginBottom: 14, flexShrink: 0,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

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
          <div style={{ padding: "var(--space-2) 0" }}>
            <EmptyState
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>}
              title="申し込みはまだありません"
              desc="気になる企業にカジュアル面談を申し込んでみましょう"
            />
            <div style={{ textAlign: "center", marginTop: "var(--space-3)" }}>
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
              <div key={m.id}>
                <RequestItem
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
                <CasualMeetingSteps status={m.status} />
              </div>
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-3)" }}>
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

function BookmarksView({ companyBookmarks, jobBookmarks }: { companyBookmarks: Bookmark[]; jobBookmarks: Bookmark[] }) {
  const sections = [
    { title: "企業", titleEn: "Companies", items: companyBookmarks },
    { title: "求人", titleEn: "Jobs", items: jobBookmarks },
  ];
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-noto-serif)', fontWeight: 500, fontSize: 26, color: "var(--ink)", marginBottom: 8, letterSpacing: "0.02em" }}>
        ブックマーク
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.8 }}>
        あなたがブックマークした企業・求人を一覧できます。
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MypageClient({
  owUser,
  skillTags = [],
  educations = [],
  certifications = [],
  timelineCareers = [],
  companyBookmarks,
  jobBookmarks,
  casualMeetings,
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
  casualMeetings: CasualMeeting[];
  conversationsBadge?: number;
  applicationsBadge?: number;
  hasCareerPreferences?: boolean;
}) {
  const userName = owUser?.name ?? "ユーザー";
  const userInitial = userName.charAt(0);
  const userAvatar = owUser?.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9)";

  // currentRole: 現職の careerEntry から動的に生成（MOCK_USER.currentRole を置き換え）
  const currentCareer = timelineCareers.find((c) => c.is_current);
  const currentRole = currentCareer
    ? `${currentCareer.company_name} · ${currentCareer.role_title ?? currentCareer.role_label}`
    : null;

  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const { isMentor: _isMentorMock } = useMypageMock();

  const navigate = useCallback((v: ActiveView) => {
    setActiveView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const pendingCasualCount = casualMeetings.filter(
    (m) => m.status === "pending" || m.status === "scheduled"
  ).length;

  const totalBookmarks =
    companyBookmarks.length +
    jobBookmarks.length;

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
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
      iconBg: "var(--pink-soft, #FCE7F3)", iconColor: "var(--pink)",
      value: totalBookmarks, label: "ブックマーク\n合計",
      onClick: () => navigate("bookmarks"),
    },
  ];

  const dashboardRightColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* 最近の申込 */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>最近の申込</span>
          <button
            type="button"
            onClick={() => navigate("casual")}
            style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, border: "none", background: "none", cursor: "pointer" }}
          >
            すべて見る →
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <div style={{ padding: "var(--space-4) 0", textAlign: "center" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
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
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>ブックマーク</span>
          <button
            type="button"
            onClick={() => navigate("bookmarks")}
            style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, border: "none", background: "none", cursor: "pointer" }}
          >
            すべて見る →
          </button>
        </div>
        {companyBookmarks.length === 0 ? (
          <div style={{ padding: "var(--space-3) 0", textAlign: "center" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
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
        <div style={{ marginBottom: "var(--space-3)" }}>
          <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>マイアクティビティ</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-2)" }}>
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
                marginBottom: "var(--space-2)",
              }}>
                {card.icon}
              </div>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: "var(--text-lg)", fontWeight: 700,
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

  return (
    <MypageLayout
      activeKey={activeView}
      onNavigate={(key: MypageActiveKey) => navigate(key as ActiveView)}
      onIsMentorChange={() => {}}
      conversationsBadge={conversationsBadge}
      applicationsBadge={applicationsBadge}
      rightColumn={activeView === "dashboard" ? dashboardRightColumn : undefined}
    >
      {activeView === "dashboard" && (
        <DashboardView
          userId={owUser?.id ?? ""}
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
      {activeView === "bookmarks" && <BookmarksView companyBookmarks={companyBookmarks} jobBookmarks={jobBookmarks} />}

      <style>{`
        .request-item-row:hover { border-color: var(--royal-100) !important; background: #fff !important; }
        .stat-card-hover:hover { border-color: var(--royal-100) !important; box-shadow: 0 4px 14px rgba(15,23,42,0.06) !important; transform: translateY(-1px); }
        .bookmark-card-hover:hover { border-color: var(--royal-100) !important; box-shadow: 0 4px 12px rgba(15,23,42,0.05) !important; }
      `}</style>
    </MypageLayout>
  );
}
