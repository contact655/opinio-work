"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MypageLayout from "./_components/MypageLayout";
/* ⚠️ プロフィール編集の本体。2026-08-16 に `/profile/edit` からここへ移した。
      **中身は書き換えていない**（置き場所を変えただけ）。 */
import ProfileEditor from "@/components/profile/editor/ProfileEditor";
import type { ComponentProps } from "react";
import UserProfileCard from "@/components/profile/UserProfileCard";
/* ⚠️ 型だけ使う。経歴タイムラインの描画は 2026-08-16 にここから外した
      （職歴・学歴カードと重複するため）。`MergedTimeline` 本体は `/u/[id]` が使う。 */
import { type CareerEntry } from "@/components/profile/MergedTimeline";
import { PostComposer } from "@/components/profile/PostComposer";
import {
  STATUS_LABEL,
  type CasualMeeting,
  type Bookmark,
} from "@/app/mypage/mockMypageData";
import { StatusPill } from "@/components/common/StatusPill";

/* ⚠️ **`ProfileEditor` の OwUser と同じ形にすること**（2026-08-16）。
      `/mypage` が編集フォームにそのまま渡すので、片方に列を足してもう片方に
      足し忘れると、その列が編集画面で空になり**保存した瞬間に消える**。
      型が別々に2つあるのは、片方をアプリ側の import で汚さないため。 */
type OwUser = ComponentProps<typeof ProfileEditor>["owUser"];

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
  userEducations,
  ambassadorMemberships = [],
  schoolPeerCounts = {},
  canPost,
  profileEditorWith,
  onEditAboutMe,
  onEditSocials,
}: {
  /** 投稿してよい人か（lib/feed/canPost）。false なら「アクティビティ」を出さない */
  canPost: boolean;
  /** プロフィール編集（3タブ＋7枚のカード）を描く。
      引数に渡したものは**プロフィールタブの一番下**に入る（母校・アクティビティ） */
  profileEditorWith: (extra: React.ReactNode) => React.ReactNode;
  /** ヘッダーカードの促しから、該当カードを編集モードで開く */
  onEditAboutMe: () => void;
  onEditSocials: () => void;
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
  ambassadorMemberships?: AmbassadorMembership[];
  schoolPeerCounts?: Record<string, number>;
}) {
  /* ⚠️ **経歴タイムライン（MergedTimeline）はここから外した**（2026-08-16）。
        職歴カード・学歴カードが同じ内容を出しており、そちらは編集もできる上位互換。
        同じものを2箇所に出さない（`.claude/rules/ui-debugging.md` ⑧と同じ話）。
        ⚠️ `MergedTimeline` 自体は消していない。`/u/[id]`（公開プロフィール）が使う。 */

  return (
    <div>
      {/* コンパクトプロフィールカード — Phase ν-6 段階3: 全フィールドインライン編集対応 */}
      <UserProfileCard
        onEditAboutMe={onEditAboutMe}
        onEditSocials={onEditSocials}
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

      {/* ★プロフィール編集（3タブ＋7枚のカード）。
             母校とアクティビティは**プロフィールタブの中**に入れる。
             タブの外に出すと「転職の希望」「設定」でも出てしまう。 */}
      {profileEditorWith(
        <>
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

      {/* ── アクティビティ投稿フォーム ──
          ⚠️ 投稿できない人にはセクションごと出さない（2026-08-05）。
             コンポーザーがセクションの中身そのものなので、コンポーザーだけ消すと
             見出しだけが残って空欄になる。 */}
      {canPost && (
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
      )}

      {/* 面談対応者の設定（登録がある場合のみ表示） */}
      <AmbassadorWidget memberships={ambassadorMemberships} />
        </>
      )}

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

/** `ProfileEditor` にそのまま渡すプロップ。★親で1つずつ数え直さない */
type ProfileEditorProps = Omit<ComponentProps<typeof ProfileEditor>, "owUser">;

export default function MypageClient({
  canPost,
  owUser,
  followCounts,
  educations = [],
  timelineCareers = [],
  companyBookmarks,
  jobBookmarks,
  casualMeetings,
  conversationsBadge,
  applicationsBadge,
  scoutsBadge,
  isNewUser = false,
  ambassadorMemberships = [],
  showScoutBanner = false,
  schoolPeerCounts = {},
  ...editorProps
}: {
  /** 投稿してよい人か（lib/feed/canPost）。false なら「アクティビティ」を出さない */
  canPost: boolean;
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
  scoutsBadge?: number;
  isNewUser?: boolean;
  ambassadorMemberships?: AmbassadorMembership[];
  showScoutBanner?: boolean;
  schoolPeerCounts?: Record<string, number>;
} & ProfileEditorProps) {
  const userName = owUser?.name ?? "ユーザー";
  const userInitial = userName.charAt(0);
  const userAvatar = owUser?.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9)";

  // currentRole: 現職の careerEntry から動的に生成（MOCK_USER.currentRole を置き換え）
  const currentCareer = timelineCareers.find((c) => c.is_current);
  const currentRole = currentCareer
    ? `${currentCareer.company_name} · ${currentCareer.role_title ?? currentCareer.role_label}`
    : null;

  const [activeView] = useState<ActiveView>("dashboard");

  /* ── 促しから「該当カードを編集モードで開く」ための合図 ──────────────────
        ⚠️ **`openAddNonce` と同じ形**（nonce を +1 して受け側の useEffect で開く）。
           新しい仕組みを作らない。
        ⚠️ 押しても何も起きないリンクにしないこと。移設前は `/profile/edit` へ
           飛ばしていたが、移設後は**同じページ**なので無反応になった（2026-08-16）。 */
  const [openBasicNonce, setOpenBasicNonce] = useState(0);
  const [openSocialNonce, setOpenSocialNonce] = useState(0);
  const [openCareerNonce, setOpenCareerNonce] = useState(0);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [scoutBannerVisible, setScoutBannerVisible] = useState(showScoutBanner);
  const [scoutBannerSaving, setScoutBannerSaving] = useState(false);
  // ⚠️ モックの isMentor は使わない。実データ（owUser.is_mentor）で判定する

  /* ⚠️ **`activeView` を切り替える導線が無くなった**（2026-08-16）。
        `casual` / `bookmarks` ビューへ入る唯一の入口は右カラムの
        「最近の申込」「ブックマーク」の**すべて見る →**で、そのカードごと外したため。
        同じ内容は左メニューの `/mypage/applications` `/mypage/bookmarks` にあり、
        そちらが本体。**ビューの実装は指示により残している**（消すかどうかは別途判断）。 */
  /* 公開に必要な3点のうち、まだ埋まっていないもの。
     ⚠️ バナー本文と同じ3つを見る。文言と条件がズレると、
        「あと1つ」と書いてあるのに何を入れればいいか分からない状態になる。
     ⚠️ tab はすべて /profile/edit の VALID_TABS に実在するキー。 */
  const setupMissing: { label: string; key: "name" | "aboutMe" | "career" }[] = [
    { key: "name" as const,    label: "名前",     done: !!userName && userName !== "ユーザー" },
    { key: "aboutMe" as const, label: "自己紹介", done: !!owUser?.about_me && owUser.about_me.trim().length > 0 },
    { key: "career" as const,  label: "職歴",     done: (timelineCareers?.length ?? 0) > 0 },
  ].filter((x) => !x.done).map(({ label, key }) => ({ label, key }));

  const dashboardRightColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* プロフィール公開促進
          ⚠️ 2026-08-10 まで `/profile/start` を指していたが、**そのページは存在せず 404** だった。
             しかも表示条件の `ow_users.profile_setup_at` は**書くコードがどこにも無く**
             （API は受け付けるが送るクライアントが無い）、26人中22人に永久に出続けていた。
          ⚠️ 表示条件は「本文で約束している3つが埋まっているか」から導く。
             書かれない列に依存すると、また消えないバナーに戻る。 */}
      {setupMissing.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, #EFF3FC 0%, #E8EDFB 100%)",
          border: "1.5px solid var(--royal-100)", borderRadius: 12,
          padding: "14px 16px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
            プロフィールを公開して、企業に見つけてもらいましょう
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 10 }}>
            あと{setupMissing.length}つ、{setupMissing.map((m) => m.label).join("・")}を入力すると公開できます。
          </div>
          {/* ⚠️ **リンクにしない。** 移設後は同じページなので `href` では何も起きない。
                 足りていない項目の**先頭**に対応するカードを開く。 */}
          <button
            type="button"
            onClick={() => {
              if (setupMissing[0].key === "career") setOpenCareerNonce((n) => n + 1);
              else setOpenBasicNonce((n) => n + 1); // 名前・自己紹介はどちらも基本情報カード
            }}
            style={{
            display: "inline-block", padding: "8px 16px",
            background: "var(--royal)", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {setupMissing[0].label}を入力する →
          </button>
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

      {/* ⚠️ 「プロフィール完成度」「最近の申込」「ブックマーク」を外した（2026-08-16）。
             ・完成度 … プロフィール本体が同じページに出るようになり、
                        タブの「未設定」バッジが同じ役割を果たす
             ・最近の申込 / ブックマーク … 左メニューの「応募管理」「ブックマーク」と
                        同じ場所へ行くだけだった（`.claude/rules/ui-debugging.md` ⑧）
             ⚠️ **`ow_bookmarks` / `ow_casual_meetings` の取得は消していない。**
                本文の「申込」「ブックマーク」ビュー（activeView）が使う。 */}
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
      conversationsBadge={conversationsBadge}
      applicationsBadge={applicationsBadge}
      scoutsBadge={scoutsBadge}
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
          canPost={canPost}
          ambassadorMemberships={ambassadorMemberships}
          schoolPeerCounts={schoolPeerCounts}
          onEditAboutMe={() => setOpenBasicNonce((n) => n + 1)}
          onEditSocials={() => setOpenSocialNonce((n) => n + 1)}
          profileEditorWith={(extra) => (
            <ProfileEditor
              {...editorProps}
              owUser={owUser}
              profileTabExtra={extra}
              openBasicNonce={openBasicNonce}
              openSocialNonce={openSocialNonce}
              openCareerNonce={openCareerNonce}
            />
          )}
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
