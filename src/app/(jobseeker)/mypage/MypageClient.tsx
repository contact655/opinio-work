"use client";

import { useState, useCallback } from "react";
import type { Json } from "@/lib/supabase/types";
import { useRouter } from "next/navigation";
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
import { ProfileCompletionBar, type CompletionInput } from "@/components/profile/ProfileCompletionBar";

type OwUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  avatar_url: string | null;
  cover_color: string | null;
  about_me: string | null;
  birth_date: string | null;
  location: string | null;
  social_links: Json | null;
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
              fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
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

// ─── VIEW: Dashboard ──────────────────────────────────────────────────────────

function AmbassadorWidget({ memberships }: { memberships: AmbassadorMembership[] }) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (memberships.length === 0) return null;

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      const res = await fetch("/api/mypage/ambassador-self-remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: id }),
      });
      if (res.ok) router.refresh();
    } catch {
      // silent
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 8, letterSpacing: "0.05em" }}>
        面談対応者の設定
      </div>
      {memberships.map((m) => (
        <div key={m.id} style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: m.display_consent ? "var(--success-soft)" : "var(--warm-soft)",
          border: `1px solid ${m.display_consent ? "#6ee7b7" : "#fcd34d"}`,
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 18 }}>{m.display_consent ? "✅" : "⏳"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
              {m.company_name}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)" }}>
              {m.role_title ?? "役職未設定"} ·{" "}
              {m.display_consent ? "話せる人として公開中" : "承認待ち（未公開）"}
            </div>
          </div>
          <button
            onClick={() => handleRemove(m.id)}
            disabled={removingId === m.id}
            style={{
              background: "none",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12, fontWeight: 500,
              color: "var(--ink-mute)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {removingId === m.id ? "..." : "解除"}
          </button>
        </div>
      ))}
    </div>
  );
}

function DashboardView({
  userId, userName, userInitial, userAvatar,
  currentRole,
  userLocation, userAboutMe, userBirthDate, userSocialLinks,
  followCounts,
  userEducations, timelineCareers,
  ambassadorMemberships = [],
  schoolPeerCounts = {},
}: {
  userId: string;
  userName: string; userInitial: string; userAvatar: string;
  currentRole?: string | null;
  userLocation?: string | null; userAboutMe?: string | null;
  userBirthDate?: string | null;
  userSocialLinks?: Record<string, string> | null;
  /** フォロワー数 / フォロー中の数。0 の項目は出ない */
  followCounts?: { followers: number; following: number };
  userEducations?: {
    id: string; school: string; school_id: string | null;
    school_master: { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
    faculty: string | null; degree: string | null;
    enrolled_at: string | null; graduated_at: string | null; is_current: boolean; sort_order: number;
  }[];
  timelineCareers?: CareerEntry[];
  ambassadorMemberships?: AmbassadorMembership[];
  schoolPeerCounts?: Record<string, number>;
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
        followCounts={followCounts}
        isMentor={false}
      />

      {/* ── あなたの母校 ── */}
      {(() => {
        const schoolEdus = (userEducations ?? []).filter(
          (e) => e.school_id && e.school_master
        );
        if (schoolEdus.length === 0) return null;
        const univ = schoolEdus.filter((e) => e.degree !== "高校卒");
        const hs = schoolEdus.filter((e) => e.degree === "高校卒");
        return (
          <section style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 14, padding: "24px 28px", marginBottom: 20,
          }}>
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line)",
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>
                  あなたの母校
                </span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase" as const }}>
                  ALUMNI
                </span>
              </div>
              <Link href="/people" style={{ fontSize: 12, color: "var(--royal)", textDecoration: "none", fontWeight: 600 }}>
                すべて見る →
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {univ.map((e) => {
                const sm = e.school_master!;
                const peerCount = schoolPeerCounts[e.school_id!] ?? 0;
                const sub = [e.faculty, e.degree, e.graduated_at ? `${e.graduated_at.slice(0, 4)}年卒` : null].filter(Boolean).join(" · ");
                return (
                  <Link key={e.id} href={`/schools/${e.school_id}`} style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px",
                    background: "var(--bg-tint)", border: "1px solid var(--line)",
                    borderRadius: 12, textDecoration: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }} className="request-item-row">
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      background: sm.logo_gradient ?? "linear-gradient(135deg, #7C3AED, #a855f7)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
                        {sm.logo_letter ?? sm.name.charAt(0)}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: sub ? 2 : 0 }}>
                        {sm.name}
                      </div>
                      {sub && (
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: peerCount > 0 ? 3 : 0 }}>
                          {sub}
                        </div>
                      )}
                      {peerCount > 0 && (
                        <div style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>
                          自分以外の同窓 {peerCount}名
                        </div>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </Link>
                );
              })}
              {hs.map((e) => {
                const sm = e.school_master!;
                const peerCount = schoolPeerCounts[e.school_id!] ?? 0;
                return (
                  <Link key={e.id} href={`/schools/${e.school_id}`} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 16px",
                    background: "var(--bg-tint)", border: "1px solid var(--line)",
                    borderRadius: 10, textDecoration: "none",
                    transition: "border-color 0.15s",
                  }} className="request-item-row">
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: sm.logo_gradient ?? "linear-gradient(135deg, #7C3AED, #a855f7)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                        {sm.logo_letter ?? sm.name.charAt(0)}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>
                        {sm.name}
                      </span>
                      {peerCount > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                          同窓 {peerCount}名
                        </span>
                      )}
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })()}

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

      {/* 面談対応者の設定（登録がある場合のみ表示） */}
      <AmbassadorWidget memberships={ambassadorMemberships} />

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
        fontSize: 12, fontWeight: 500, color: "var(--ink-mute)",
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
              fontSize: 12, color: i <= activeStep ? "var(--royal)" : "var(--ink-mute)",
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
        right={<span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>全 {casualMeetings.length} 件</span>}
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
              fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
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
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.5 }}>{bk.meta}</div>
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
          right={<span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>{sec.items.length} 件</span>}
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

type AmbassadorMembership = { id: string; company_id: string; company_name: string; role_title: string | null; display_consent: boolean };

export default function MypageClient({
  owUser,
  followCounts,
  educations = [],
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
  ambassadorMemberships = [],
  showScoutBanner = false,
  schoolPeerCounts = {},
}: {
  owUser: OwUser;
  /** フォロワー数 / フォロー中の数。0 の項目は出ない */
  followCounts?: { followers: number; following: number };
  educations?: {
    id: string; school: string; school_id: string | null;
    school_master: { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
    faculty: string | null; degree: string | null;
    enrolled_at: string | null; graduated_at: string | null; is_current: boolean; sort_order: number;
  }[];
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
  ambassadorMemberships?: AmbassadorMembership[];
  showScoutBanner?: boolean;
  schoolPeerCounts?: Record<string, number>;
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
  const [scoutBannerVisible, setScoutBannerVisible] = useState(showScoutBanner);
  const [scoutBannerSaving, setScoutBannerSaving] = useState(false);
  const { isMentor: _isMentorMock } = useMypageMock();

  const navigate = useCallback((v: ActiveView) => {
    setActiveView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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


  const dashboardRightColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* プロフィール公開促進 */}
      {showSetupBanner && !setupJustDone && (
        <div style={{
          background: "linear-gradient(135deg, #EFF3FC 0%, #E8EDFB 100%)",
          border: "1.5px solid var(--royal-100)", borderRadius: 12,
          padding: "14px 16px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
            プロフィールを公開して、企業に見つけてもらいましょう
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 10 }}>
            名前・自己紹介・職歴の3つを入力するだけで完了です。
          </div>
          <a href="/profile/start" style={{
            display: "inline-block", padding: "8px 16px",
            background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 12, fontWeight: 700,
            textDecoration: "none",
          }}>
            3ステップで公開する →
          </a>
        </div>
      )}

      {/* スカウト設定未完了 */}
      {scoutBannerVisible && (
        <div style={{
          background: "linear-gradient(135deg, #FEF9C3 0%, #FEF3C7 100%)",
          border: "1.5px solid #FCD34D", borderRadius: 12,
          padding: "14px 16px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
            📬 スカウト設定が未完了です
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#78350F", lineHeight: 1.6, marginBottom: 10 }}>
            企業からのスカウトを受け取るか設定してください。
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              disabled={scoutBannerSaving}
              onClick={async () => {
                setScoutBannerSaving(true);
                try {
                  await fetch("/api/jobseeker/scout-settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scout_enabled: true }),
                  });
                  setScoutBannerVisible(false);
                } finally { setScoutBannerSaving(false); }
              }}
              style={{
                padding: "7px 14px", background: "#D97706", color: "#fff",
                border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
                cursor: scoutBannerSaving ? "wait" : "pointer", fontFamily: "inherit",
              }}
            >受け取る</button>
            <button
              type="button"
              disabled={scoutBannerSaving}
              onClick={async () => {
                setScoutBannerSaving(true);
                try {
                  await fetch("/api/jobseeker/scout-settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scout_enabled: false }),
                  });
                  setScoutBannerVisible(false);
                } finally { setScoutBannerSaving(false); }
              }}
              style={{
                padding: "7px 14px", background: "none", color: "#92400E",
                border: "1.5px solid #FCD34D", borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: scoutBannerSaving ? "wait" : "pointer", fontFamily: "inherit",
              }}
            >受け取らない</button>
          </div>
        </div>
      )}

      {/* プロフィール完成度バー */}
      {(() => {
        const completionData: CompletionInput = {
          hasName:               !!userName && userName !== "ユーザー",
          hasAboutMe:            !!owUser?.about_me && owUser.about_me.trim().length > 0,
          hasLocation:           !!owUser?.location && owUser.location.trim().length > 0,
          hasBirthDate:          !!owUser?.birth_date,
          hasAvatar:             !!owUser?.avatar_url,
          experienceCount:       timelineCareers?.length ?? 0,
          educationCount:        educations?.length ?? 0,
          hasPreferences:        hasCareerPreferences,
          // 資格は 2026-08-04 に廃止。実績・受賞・メディア掲載は /mypage では未取得のため 0
          certOrAchievementCount: 0,
          socialOrContentCount:  Object.values((owUser?.social_links as Record<string, unknown>) ?? {}).filter(Boolean).length,
        };
        return <ProfileCompletionBar data={completionData} mode="mypage" />;
      })()}

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
            <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 4 }}>まだ申込はありません</div>
            <Link href="/companies" style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
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
            <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 4 }}>まだブックマークがありません</div>
            <Link href="/companies" style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
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
                    fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
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

      {/* 給与データ */}
      <Link
        href="/mypage/salary"
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", borderRadius: 10,
          background: "var(--bg-tint)", border: "1px solid var(--line)",
          textDecoration: "none",
        }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--success)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 1 }}>給与データ</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>匿名で給与情報を投稿・確認</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </Link>

      {/* 採用担当者・企業の方向け導線 */}
      <a
        href="/biz/auth"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px",
          background: "var(--royal-50)",
          border: "1px solid var(--royal-100)",
          borderRadius: 10, textDecoration: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
          <span style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600 }}>採用担当者・企業の方はこちら</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
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
              <div style={{ fontSize: 12, fontWeight: 500, color: "#047857", marginTop: 2 }}>
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
                  fontSize: 12, fontWeight: 800,
                }}>
                  {step}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#065F46" }}>
                  {label}
                </span>
                <Link href={href} style={{
                  fontSize: 12, fontWeight: 700, color: "#047857",
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
            <div style={{ fontSize: 12, fontWeight: 500, color: "#047857", marginTop: 2 }}>
              企業やメンターに見つけてもらえる状態になりました。
              <a href="/profile/edit" style={{ color: "#065F46", fontWeight: 700, marginLeft: 6 }}>さらに詳しく編集する →</a>
            </div>
          </div>
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

          userSocialLinks={owUser?.social_links as Record<string, string> | null}
          followCounts={followCounts}
          userEducations={educations}
          timelineCareers={timelineCareers}
          ambassadorMemberships={ambassadorMemberships}
          schoolPeerCounts={schoolPeerCounts}
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
