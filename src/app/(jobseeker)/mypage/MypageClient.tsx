"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import MypageLayout, { type MypageActiveKey } from "./_components/MypageLayout";
import { useMypageMock } from "./_components/MypageMockContext";
import UserProfileCard from "@/components/profile/UserProfileCard";
import MergedTimeline, { type CareerEntry } from "@/components/profile/MergedTimeline";
import { PostComposer } from "@/components/profile/PostComposer";
import {
  toTimelineEducationEntries,
  type RawEducation,
} from "@/lib/utils/timeline";
import {
  STATUS_LABEL,
  type CasualMeeting,
  type Bookmark,
} from "@/app/mypage/mockMypageData";
import { StatusPill } from "@/components/common/StatusPill";

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
// 共通 StatusPill を使用。STATUS_LABEL でドメイン固有ラベルを上書きする。

function MypageStatusPill({
  statusKey,
  label,
}: {
  statusKey: string;
  label?: string;
}) {
  const text = label ?? STATUS_LABEL[statusKey] ?? undefined;
  return (
    <StatusPill variant={statusKey}>
      {text}
    </StatusPill>
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
      <MypageStatusPill statusKey={statusKey} label={statusLabel} />
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
        <MypageStatusPill statusKey={statusKey} />
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

// ─── Profile completeness widget (マイルストーン式) ──────────────────────────

type StageItem = { label: string; done: boolean; href: string };

function getProfileStage(
  userName: string,
  userAboutMe?: string | null,
  userSkillTags?: { id: string }[],
  timelineCareers?: CareerEntry[],
  hasCareerPreferences?: boolean,
  _userCertifications?: { id: string }[],
): 1 | 2 | 3 {
  const hasName   = !!userName && userName !== "ユーザー";
  const hasAbout  = !!userAboutMe && userAboutMe.trim().length > 0;
  const hasSkills = (userSkillTags?.length ?? 0) > 0;
  if (!hasName || !hasAbout || !hasSkills) return 1;

  const hasCareer = (timelineCareers?.length ?? 0) > 0;
  const hasPrefs  = !!hasCareerPreferences;
  if (!hasCareer || !hasPrefs) return 2;

  return 3;
}

const STAGES = [
  {
    id: 1 as const,
    label: "公開できる",
    unlock: "企業一覧に表示される状態",
    color: "var(--royal)",
    bg: "var(--royal-50)",
    border: "var(--royal-100)",
  },
  {
    id: 2 as const,
    label: "見つけてもらえる",
    unlock: "条件マッチで企業に気づかれる状態",
    color: "#7C3AED",
    bg: "#F3E8FF",
    border: "#DDD6FE",
  },
  {
    id: 3 as const,
    label: "声がかかる",
    unlock: "メンターからの声かけ対象になる",
    color: "var(--success)",
    bg: "var(--success-soft)",
    border: "#A7F3D0",
  },
];

function CheckIcon({ done, next }: { done: boolean; next: boolean }) {
  if (done) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" fill="#D1FAE5" stroke="#6EE7B7"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
  if (next) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" fill="#FEF3C7" stroke="#FCD34D"/>
      <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  );
}

function ProfileCompletenessCard({
  userName, userAboutMe, userSkillTags, timelineCareers, hasCareerPreferences, userCertifications,
}: {
  userName: string;
  userAboutMe?: string | null;
  userSkillTags?: { id: string; label: string; sort_order: number }[];
  timelineCareers?: CareerEntry[];
  hasCareerPreferences?: boolean;
  userCertifications?: { id: string; name: string; sort_order: number }[];
}) {
  const stage = getProfileStage(userName, userAboutMe, userSkillTags, timelineCareers, hasCareerPreferences, userCertifications);

  if (stage === 3 && (userCertifications?.length ?? 0) > 0) return null; // 全完了なら非表示

  const currentStage = STAGES[stage - 1];
  const nextStage    = stage < 3 ? STAGES[stage] : null;

  const stage1Items: StageItem[] = [
    { label: "名前",      done: !!userName && userName !== "ユーザー",               href: "/profile/edit" },
    { label: "自己紹介",  done: !!userAboutMe && userAboutMe.trim().length > 0,       href: "/profile/edit" },
    { label: "スキルタグ", done: (userSkillTags?.length ?? 0) > 0,                   href: "/profile/edit" },
  ];
  const stage2Items: StageItem[] = [
    { label: "職歴",      done: (timelineCareers?.length ?? 0) > 0,                  href: "/profile/edit" },
    { label: "希望条件",  done: !!hasCareerPreferences,                               href: "/profile/edit" },
  ];
  const stage3Items: StageItem[] = [
    { label: "資格・実績", done: (userCertifications?.length ?? 0) > 0,              href: "/profile/edit" },
  ];

  const allItems = [...stage1Items, ...stage2Items, ...stage3Items];
  const nextItem = allItems.find((i) => !i.done);

  return (
    <section style={{
      background: "#fff",
      border: "1.5px solid var(--royal-100)",
      borderRadius: 16, padding: "20px 22px",
      marginBottom: 20,
    }}>
      {/* ── ヘッダー ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.06em", marginBottom: 6 }}>
            プロフィール状態
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: currentStage.bg, border: `1.5px solid ${currentStage.border}`,
            borderRadius: 10, padding: "6px 12px",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={currentStage.color} strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 800, color: currentStage.color }}>
              {currentStage.label}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 7, lineHeight: 1.5 }}>
            いま「<strong style={{ color: "var(--ink)" }}>{currentStage.unlock}</strong>」です
          </div>
        </div>

        {/* ステージドット */}
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0, paddingTop: 4 }}>
          {STAGES.map((s) => (
            <div key={s.id} style={{
              width: s.id === stage ? 20 : 8,
              height: 8, borderRadius: 100,
              background: s.id <= stage ? s.color : "var(--line)",
              transition: "all 0.3s",
            }} />
          ))}
        </div>
      </div>

      {/* ── チェックリスト ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {/* Stage 1 */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.05em", marginBottom: 2 }}>
          STEP 1 — {STAGES[0].label}
        </div>
        {stage1Items.map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckIcon done={item.done} next={!item.done && item === nextItem} />
              <span style={{ fontSize: 12, color: item.done ? "var(--ink-soft)" : "var(--ink)", fontWeight: item.done ? 400 : 600, flex: 1 }}>
                {item.label}
              </span>
              {!item.done && (
                <Link href={item.href} style={{
                  fontSize: 10, fontWeight: 700, color: "#D97706", textDecoration: "none",
                  background: "#FEF3C7", padding: "2px 8px", borderRadius: 100,
                }}>追加 →</Link>
              )}
            </div>
        ))}

        {/* Stage 2 */}
        <div style={{ fontSize: 10, fontWeight: 700, color: stage >= 2 ? "var(--ink-mute)" : "var(--line)", letterSpacing: "0.05em", marginTop: 6, marginBottom: 2 }}>
          STEP 2 — {STAGES[1].label}
        </div>
        {stage2Items.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, opacity: stage < 2 ? 0.45 : 1 }}>
            <CheckIcon done={item.done} next={!item.done && item === nextItem} />
            <span style={{ fontSize: 12, color: item.done ? "var(--ink-soft)" : "var(--ink)", fontWeight: item.done ? 400 : 600, flex: 1 }}>
              {item.label}
            </span>
            {!item.done && stage >= 1 && (
              <Link href={item.href} style={{
                fontSize: 10, fontWeight: 700, color: "#7C3AED", textDecoration: "none",
                background: "#F3E8FF", padding: "2px 8px", borderRadius: 100,
              }}>追加 →</Link>
            )}
          </div>
        ))}

        {/* Stage 3 */}
        <div style={{ fontSize: 10, fontWeight: 700, color: stage >= 3 ? "var(--ink-mute)" : "var(--line)", letterSpacing: "0.05em", marginTop: 6, marginBottom: 2 }}>
          STEP 3 — {STAGES[2].label}
        </div>
        {stage3Items.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, opacity: stage < 3 ? 0.45 : 1 }}>
            <CheckIcon done={item.done} next={!item.done && item === nextItem} />
            <span style={{ fontSize: 12, color: item.done ? "var(--ink-soft)" : "var(--ink)", fontWeight: item.done ? 400 : 600, flex: 1 }}>
              {item.label}
            </span>
            {!item.done && stage >= 2 && (
              <Link href={item.href} style={{
                fontSize: 10, fontWeight: 700, color: "var(--success)", textDecoration: "none",
                background: "var(--success-soft)", padding: "2px 8px", borderRadius: 100,
              }}>追加 →</Link>
            )}
          </div>
        ))}
      </div>

      {/* ── 次の段階へのナッジ ── */}
      {nextStage && nextItem && (
        <div style={{
          background: nextStage.bg, border: `1px solid ${nextStage.border}`,
          borderRadius: 10, padding: "10px 14px",
          fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 700, color: "var(--ink)" }}>あと「{nextItem.label}」を追加</span>すると
          「<strong style={{ color: nextStage.color }}>{nextStage.unlock}</strong>」になります
        </div>
      )}
    </section>
  );
}

// ─── VIEW: Dashboard ──────────────────────────────────────────────────────────

function DashboardView({
  userId, userName, userInitial, userAvatar,
  currentRole,
  userLocation, userAboutMe, userBirthDate, userSocialLinks,
  userSkillTags, userEducations, userCertifications, timelineCareers,
}: {
  userId: string;
  userName: string; userInitial: string; userAvatar: string;
  currentRole?: string | null;
  userLocation?: string | null; userAboutMe?: string | null;
  userBirthDate?: string | null;
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
}) {
  // MergedTimeline 用データ整形（/mypage は常に本人なので viewerIsOwner = true）
  const timelineEdus = toTimelineEducationEntries((userEducations ?? []) as RawEducation[]);
  const hasMergedTimeline =
    (timelineCareers?.length ?? 0) > 0 || timelineEdus.length > 0;

  return (
    <div>
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
        
        userSocialLinks={userSocialLinks}
        userSkillTags={userSkillTags}
        userCertifications={userCertifications}
        isMentor={false}
      />

      {/* 経歴タイムライン（キャリア + 学歴を統合表示） */}
      {hasMergedTimeline && (
        <SectionBlock title="経歴" titleEn="TIMELINE">
          <MergedTimeline
            careers={timelineCareers ?? []}
            educations={timelineEdus}
            future={null}
            viewerIsOwner={true}
          />
        </SectionBlock>
      )}

      {/* ── アクティビティ投稿フォーム ── */}
      <SectionBlock title="アクティビティ" titleEn="ACTIVITY">
        <PostComposer
          avatarColor={userAvatar ?? "linear-gradient(135deg, var(--royal), #3B5FD9)"}
          initial={userInitial}
          avatarUrl={null}
        />
        <div style={{ marginTop: 8 }}>
          <Link href={`/u/${userId}`} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none",
          }}>
            投稿を公開プロフィールで確認する →
          </Link>
        </div>
      </SectionBlock>

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
              desc: "掲載企業を一覧で見る",
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

      {/* ── 在籍経験企業に口コミ・給与を投稿 ── */}
      {(() => {
        const companies = Array.from(
          new Map(
            (timelineCareers ?? [])
              .filter((c) => c.company_id && c.company_name)
              .map((c) => [c.company_id as string, { id: c.company_id as string, name: c.company_name }])
          ).values()
        ).slice(0, 5);
        if (companies.length === 0) return null;
        return (
          <section style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 14, padding: "24px 28px", marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>口コミ・給与を投稿</span>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase" as const }}>CONTRIBUTE</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 16, lineHeight: 1.7 }}>
              在籍経験のある企業の口コミ・給与情報を投稿して、同じ職種を目指す人を助けましょう。投稿は運営が確認後に公開されます（匿名）。
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {companies.map(({ id, name }) => (
                <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg-tint)", borderRadius: 10, border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{name}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`/companies/${id}#reviews`} style={{
                      fontSize: 12, fontWeight: 600, color: "var(--royal)", textDecoration: "none",
                      padding: "5px 12px", borderRadius: 7, border: "1.5px solid var(--royal-100)",
                      background: "var(--royal-50)", whiteSpace: "nowrap" as const,
                    }}>
                      ★ 口コミを書く
                    </Link>
                    <Link href={`/companies/${id}#salary`} style={{
                      fontSize: 12, fontWeight: 600, color: "var(--success)", textDecoration: "none",
                      padding: "5px 12px", borderRadius: 7, border: "1.5px solid #A7F3D0",
                      background: "var(--success-soft)", whiteSpace: "nowrap" as const,
                    }}>
                      ¥ 給与を登録
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

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
  showSetupBanner = false,
  setupJustDone = false,
  isNewUser = false,
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
  showSetupBanner?: boolean;
  setupJustDone?: boolean;
  isNewUser?: boolean;
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
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
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
      {/* プロフィール完成度（マイルストーン式） */}
      <ProfileCompletenessCard
        userName={userName}
        userAboutMe={owUser?.about_me}
        userSkillTags={skillTags}
        timelineCareers={timelineCareers}
        hasCareerPreferences={hasCareerPreferences}
        userCertifications={certifications}
      />

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
        {statCards.every(c => c.value === 0) ? (
          <div style={{
            background: "var(--bg-tint)", border: "1px solid var(--line)",
            borderRadius: 12, padding: "16px", textAlign: "center",
          }}>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>まだ活動がありません</div>
            <Link href="/companies" style={{
              fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none",
            }}>企業を探してみる →</Link>
          </div>
        ) : (
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
        )}
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
      {/* ウェルカムバナー（新規登録直後） */}
      {isNewUser && !welcomeDismissed && (
        <div style={{
          background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
          border: "1.5px solid #6EE7B7",
          borderRadius: 14,
          padding: "18px 20px",
          marginBottom: 20,
        }}>
          {/* ヘッダー行 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>🎉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#065F46" }}>
                OPINIOへようこそ！登録が完了しました。
              </div>
              <div style={{ fontSize: 12, color: "#047857", marginTop: 2 }}>
                まずは以下の3ステップをやってみましょう
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWelcomeDismissed(true)}
              aria-label="閉じる"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#6EE7B7", fontSize: 20, lineHeight: 1,
                padding: "4px 6px", borderRadius: 6, flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* 3ステップ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { step: 1, label: "企業を1社お気に入りに追加する", href: "/companies", cta: "企業一覧を見る →" },
              { step: 2, label: "求人を1件確認する", href: "/jobs", cta: "求人を見る →" },
              { step: 3, label: "話せる人を探してみる", href: "/people", cta: "話せる人を見る →" },
            ].map(({ step, label, href, cta }) => (
              <div key={step} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "rgba(255,255,255,0.65)", borderRadius: 10,
                padding: "10px 14px",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: "var(--success)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800,
                }}>
                  {step}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#065F46" }}>
                  {label}
                </span>
                <Link href={href} style={{
                  fontSize: 11, fontWeight: 700, color: "#047857",
                  background: "#D1FAE5", padding: "4px 10px",
                  borderRadius: 100, textDecoration: "none", flexShrink: 0,
                  border: "1px solid #A7F3D0",
                }}>
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 公開完了バナー（/profile/start から遷移直後） */}
      {setupJustDone && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
          border: "1.5px solid #6EE7B7", borderRadius: 12,
          padding: "14px 18px", marginBottom: 16,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--success)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#065F46" }}>プロフィールを公開しました！</div>
            <div style={{ fontSize: 12, color: "#047857", marginTop: 2 }}>
              企業やメンターに見つけてもらえる状態になりました。
              <a href="/profile/edit" style={{ color: "#065F46", fontWeight: 700, marginLeft: 6 }}>さらに詳しく編集する →</a>
            </div>
          </div>
        </div>
      )}

      {/* セットアップ促進バナー（未完了ユーザー向け） */}
      {showSetupBanner && !setupJustDone && (
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          background: "linear-gradient(135deg, #EFF3FC 0%, #E8EDFB 100%)",
          border: "1.5px solid var(--royal-100)", borderRadius: 12,
          padding: "16px 20px", marginBottom: 16,
          flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
              プロフィールを公開して、企業に見つけてもらいましょう
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              名前・自己紹介・スキルの3つを入力するだけで完了です。
            </div>
          </div>
          <a href="/profile/start" style={{
            display: "inline-block", padding: "10px 20px",
            background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 700,
            textDecoration: "none", flexShrink: 0,
            boxShadow: "0 2px 8px rgba(0,35,102,0.2)",
          }}>
            3ステップで公開する →
          </a>
        </div>
      )}

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
          
          userSocialLinks={owUser?.social_links}
          userSkillTags={skillTags}
          userEducations={educations}
          userCertifications={certifications}
          timelineCareers={timelineCareers}
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
