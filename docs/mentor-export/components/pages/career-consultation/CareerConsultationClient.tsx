"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  calcMentorScore,
  type MentorForMatching,
  type MatchUserProfile,
} from "@/lib/mentorMatching";
import { getMentorAvatarProps } from "@/lib/utils/mentorAvatar";

// ─── Types ──────────────────────────────────────────

type Mentor = {
  id: string;
  name: string;
  avatar_initial: string | null;
  avatar_color: string | null;
  current_company: string | null;
  current_role: string | null;
  previous_career: string | null;
  current_career: string | null;
  roles: string[] | null;
  worries: string[] | null;
  bio: string | null;
  concerns: string[] | null;
  catchphrase: string | null;
  question_tags: string[] | null;
  calendly_url: string | null;
  is_available: boolean;
  display_order: number;
  success_count: number | null;
  total_sessions: number | null;
  total_consultations?: number | null;
  prev_company?: string | null;
  avatar_url?: string | null;
};

type UserProfile = {
  job_type: string | null;
  experience_years: string | null;
  worry: string | null;
  // 以下は ow_profiles に存在しないカラム（将来追加予定）
  consultation_tags?: string[] | null;
  current_company_type?: string | null;
} | null;

type ScoredMentor = {
  mentor: Mentor;
  score: number;
  reasons: string[];
};

type Layout = "grid3" | "grid" | "list";

// ─── Constants ──────────────────────────────────────

const WORRY_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "転職タイミング", label: "転職タイミング" },
  { value: "年収交渉", label: "年収交渉" },
  { value: "キャリアチェンジ", label: "キャリアチェンジ" },
  { value: "外資転職", label: "外資転職" },
  { value: "スタートアップ", label: "スタートアップ" },
];

const COVER_COLORS: Record<string, string> = {
  "柴": "#0f172a",
  "田中": "#0070d2",
  "佐藤": "#ff7a59",
  "鈴木": "#2d1b4e",
  "伊藤": "#1a1a2e",
  "中村": "#003366",
  "小林": "#007aff",
  "加藤": "#0070d2",
  "渡辺": "#ff7a59",
};

function getCoverColor(name: string): string {
  for (const key of Object.keys(COVER_COLORS)) {
    if (name.startsWith(key)) return COVER_COLORS[key];
  }
  return "#1a2e44";
}

// ─── Scoring helper ────────────────────────────────

function scoreMentors(
  mentors: Mentor[],
  profile: UserProfile
): ScoredMentor[] {
  if (!profile) return [];

  const matchProfile: MatchUserProfile = {
    job_type: profile.job_type,
    experience_years: profile.experience_years,
    worry: profile.worry,
    consultation_tags: profile.consultation_tags ?? null,
    current_company_type: profile.current_company_type ?? null,
  };

  return mentors
    .map((mentor) => {
      const m: MentorForMatching = {
        id: mentor.id,
        name: mentor.name,
        roles: mentor.roles,
        worries: mentor.worries,
        concerns: mentor.concerns,
        previous_career: mentor.previous_career,
        current_career: mentor.current_career,
        current_company: mentor.current_company,
        current_role: mentor.current_role,
        total_consultations: mentor.total_consultations,
        total_sessions: mentor.total_sessions,
        display_order: mentor.display_order,
        prev_company: mentor.prev_company,
      };
      const result = calcMentorScore(m, matchProfile);
      return { mentor, score: result.score, reasons: result.reasons };
    })
    .filter((r) => r.score > 0 && r.reasons.length > 0)
    .sort((a, b) => b.score - a.score);
}

function hasMatchingProfile(profile: UserProfile): boolean {
  if (!profile) return false;
  return !!(
    profile.job_type ||
    (profile.consultation_tags && profile.consultation_tags.length > 0) ||
    profile.current_company_type
  );
}

// ─── Filter Chip ───────────────────────────────────

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const baseStyle: React.CSSProperties = selected
    ? { background: "#059669", color: "#fff", border: "1.5px solid #059669", fontSize: 14, fontWeight: 600 }
    : { background: hovered ? "#f0fdf4" : "#fff", color: "#1f2937", border: hovered ? "1.5px solid #059669" : "1.5px solid #d1d5db", fontSize: 14, fontWeight: 500 };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-full transition-all whitespace-nowrap"
      style={{ padding: "6px 16px", ...baseStyle }}
    >
      {label}
    </button>
  );
}

// ─── Avatar Component ────────────────────────────────
function MentorAvatar({ mentor, size, border }: { mentor: { avatar_url?: string | null; name: string }; size: number; border?: string }) {
  const props = getMentorAvatarProps(mentor.name, mentor.avatar_url);
  if (props.type === "image") {
    return (
      <Image src={props.src} alt={mentor.name} width={size} height={size} style={{ borderRadius: "50%", border: border || "none", objectFit: "cover", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: props.bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.37), fontWeight: 500, color: props.textColor, flexShrink: 0, border: border || "none" }}>
      {props.char}
    </div>
  );
}

// ─── Mentor Card ────────────────────────────────────

function MentorCard({
  mentor,
  matchReasons,
  isTopRecommended,
  layout = "grid3",
}: {
  mentor: Mentor;
  matchReasons?: string[];
  isTopRecommended?: boolean;
  layout?: Layout;
}) {
  const coverColor = getCoverColor(mentor.name);
  const is3col = layout === "grid3";
  const is1col = layout === "list";

  // Size tokens
  const headerH = is3col ? 70 : 80;
  const avatarSz = is3col ? 32 : 40;
  const nameFs = 15;
  const textFs = 12;
  const tagPad = "5px 12px";
  const catchFs = 13;
  const btnFs = 13;
  const btnPy = is3col ? 6 : 8;

  return (
    <Link
      href={`/career-consultation/${mentor.id}`}
      style={{
        display: "block",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        background: "#fff",
        textDecoration: "none",
        color: "inherit",
        transition: "box-shadow 0.2s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* ═══ 1列レイアウト ═══ */}
      {is1col ? (
        <div style={{ display: "flex" }}>
          {/* Left strip */}
          <div style={{
            width: 96, flexShrink: 0, background: coverColor,
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
          }}>
            {isTopRecommended && (
              <span style={{ position: "absolute", top: 8, left: 8, background: "#f59e0b", color: "#fff", fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 999 }}>おすすめ</span>
            )}
            <MentorAvatar mentor={mentor} size={avatarSz} border="2px solid rgba(255,255,255,0.8)" />
            <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, background: "rgba(255,255,255,0.2)", color: "#fff", padding: "2px 6px", borderRadius: 999 }}>
              {mentor.current_role || (mentor.roles && mentor.roles[0]) || ""}
            </span>
          </div>

          {/* Body row */}
          <div style={{ flex: 1, display: "flex", padding: 12, gap: 16 }}>
            {/* Left info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 2px 0" }}>{mentor.name}</p>
              {(mentor.current_company || mentor.current_role) && (
                <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 2px 0" }}>
                  {[mentor.current_company, mentor.current_role].filter(Boolean).join(" / ")}
                </p>
              )}
              {/* Before/After キャリアパス */}
              {mentor.previous_career && mentor.current_career && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 6px 0" }}>
                  <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: "#f3f4f6", color: "#6b7280", fontWeight: 500, whiteSpace: "nowrap" }}>元 {mentor.previous_career}</span>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>→</span>
                  <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: "#ecfdf5", color: "#059669", fontWeight: 500, whiteSpace: "nowrap" }}>現 {mentor.current_career}</span>
                </div>
              )}
              {/* こんな相談が得意です */}
              {(mentor.worries && mentor.worries.length > 0) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {mentor.worries.slice(0, 3).map((w) => (
                    <span key={w} style={{ fontSize: textFs, padding: tagPad, borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", display: "inline-block", width: "fit-content" }}>
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right column */}
            <div style={{ width: 200, flexShrink: 0, borderLeft: "1px solid #f3f4f6", paddingLeft: 16, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {/* 左ボーダーキャッチ */}
              {mentor.catchphrase && (
                <div style={{ borderLeft: "2.5px solid #1D9E75", paddingLeft: 10, marginBottom: 8 }}>
                  <p style={{ fontSize: catchFs, color: "#4b5563", lineHeight: 1.5, margin: 0 }}>{mentor.catchphrase}</p>
                </div>
              )}
              {!!(mentor.total_sessions || mentor.success_count || mentor.total_consultations) && (
                <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                  {!!mentor.total_sessions && (
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{mentor.total_sessions}</span>
                      <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 4 }}>相談実績</span>
                    </div>
                  )}
                  {!!mentor.success_count && (
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{mentor.success_count}名</span>
                      <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 4 }}>転職成功</span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ background: "#111827", color: "#fff", borderRadius: 8, padding: "7px 0", textAlign: "center", fontSize: btnFs, fontWeight: 600 }}>
                プロフィールを見る →
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ═══ 2列 / 3列 グリッドレイアウト ═══ */
        <>
          {/* Cover */}
          <div style={{
            height: headerH, background: coverColor,
            position: "relative", display: "flex", alignItems: "flex-end", padding: is3col ? 10 : 12,
          }}>
            {isTopRecommended && (
              <span style={{ position: "absolute", top: 8, left: 8, background: "#f59e0b", color: "#fff", fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 999 }}>おすすめ</span>
            )}
            <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, background: "rgba(255,255,255,0.2)", color: "#fff", padding: "2px 6px", borderRadius: 999 }}>
              {mentor.current_role || (mentor.roles && mentor.roles[0]) || ""}
            </span>
            <MentorAvatar mentor={mentor} size={avatarSz} border="2px solid rgba(255,255,255,0.8)" />
          </div>

          {/* Body */}
          <div style={{ padding: is3col ? 10 : 14 }}>
            <p style={{ fontSize: nameFs, fontWeight: 600, color: "#111827", margin: "0 0 1px 0" }}>{mentor.name}</p>
            {(mentor.current_company || mentor.current_role) && (
              <p style={{ fontSize: textFs, color: "#6b7280", margin: "0 0 2px 0" }}>
                {[mentor.current_company, mentor.current_role].filter(Boolean).join(" / ")}
              </p>
            )}
            {/* Before/After キャリアパス */}
            {mentor.previous_career && mentor.current_career && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 8px 0", flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: "#f3f4f6", color: "#6b7280", fontWeight: 500, whiteSpace: "nowrap" }}>元 {mentor.previous_career}</span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>→</span>
                <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: "#ecfdf5", color: "#059669", fontWeight: 500, whiteSpace: "nowrap" }}>現 {mentor.current_career}</span>
              </div>
            )}

            {/* こんな相談が得意です */}
            {(mentor.worries && mentor.worries.length > 0) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                {mentor.worries.slice(0, is3col ? 2 : 3).map((w) => (
                  <span key={w} style={{ fontSize: textFs, padding: tagPad, borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", display: "inline-block", width: "fit-content" }}>
                    {w}
                  </span>
                ))}
              </div>
            )}

            {/* 左ボーダーキャッチ */}
            {mentor.catchphrase && (
              <div style={{ borderLeft: "2.5px solid #1D9E75", paddingLeft: 10, marginBottom: 10 }}>
                <p style={{ fontSize: catchFs, color: "#4b5563", lineHeight: 1.5, margin: 0 }}>{mentor.catchphrase}</p>
              </div>
            )}

            {/* Stats */}
            {!!(mentor.total_sessions || mentor.success_count || mentor.total_consultations) && (
              <div style={{ display: "flex", gap: is3col ? 12 : 16, marginBottom: 8 }}>
                {!!mentor.total_sessions && (
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{mentor.total_sessions}</span>
                    <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 4 }}>相談実績</span>
                  </div>
                )}
                {!!mentor.success_count && (
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{mentor.success_count}名</span>
                    <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 4 }}>転職成功</span>
                  </div>
                )}
              </div>
            )}

            {/* Match reasons */}
            {matchReasons && matchReasons.length > 0 && (
              <div style={{ background: "#f0fdf4", borderLeft: "3px solid #059669", borderRadius: "0 8px 8px 0", padding: "8px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#166534", marginBottom: 4 }}>あなたに合う理由</div>
                {matchReasons.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151", lineHeight: 1.6 }}>
                    <span style={{ color: "#059669", fontWeight: 700 }}>✓</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 8 }}>
              <div style={{ textAlign: "center", background: "#111827", color: "#fff", borderRadius: 8, padding: `${btnPy}px 0`, fontSize: btnFs, fontWeight: 600 }}>
                プロフィールを見る →
              </div>
            </div>
          </div>
        </>
      )}
    </Link>
  );
}

// ─── Main Component ─────────────────────────────────

const LAYOUT_KEY = "mentor-list-layout";

export default function CareerConsultationClient({
  mentors,
  isLoggedIn = false,
  userProfile = null,
}: {
  mentors: Mentor[];
  isLoggedIn?: boolean;
  userProfile?: UserProfile;
}) {
  const [worryFilter, setWorryFilter] = useState("all");
  const [layout, setLayout] = useState<Layout>("grid3");

  useEffect(() => {
    const saved = localStorage.getItem(LAYOUT_KEY) as Layout;
    if (saved === "grid3" || saved === "grid" || saved === "list") setLayout(saved);
  }, []);

  const handleLayout = (l: Layout) => {
    setLayout(l);
    localStorage.setItem(LAYOUT_KEY, l);
  };

  const scored = useMemo(
    () => scoreMentors(mentors, userProfile),
    [mentors, userProfile]
  );

  const profileReady = hasMatchingProfile(userProfile);
  const recommendations = useMemo(() => scored.slice(0, 2), [scored]);

  const scoreMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of scored) map.set(s.mentor.id, s.score);
    return map;
  }, [scored]);

  const filtered = useMemo(() => {
    let list = mentors.filter((m) => {
      if (worryFilter !== "all" && !(m.worries || []).includes(worryFilter))
        return false;
      return true;
    });

    if (profileReady && worryFilter === "all") {
      list = [...list].sort((a, b) => {
        const sa = scoreMap.get(a.id) || 0;
        const sb = scoreMap.get(b.id) || 0;
        if (sb !== sa) return sb - sa;
        return (a.display_order || 0) - (b.display_order || 0);
      });
    }

    return list;
  }, [mentors, worryFilter, profileReady, scoreMap]);

  return (
    <>
      {/* ─── Hero ─── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 55%, #1a3569 100%)",
        padding: "44px 0 40px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", right: -80, top: -80, width: 360, height: 360, borderRadius: "50%", background: "rgba(59,95,217,0.1)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -40, bottom: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(245,158,11,0.06)", pointerEvents: "none" }} />
        <div className="max-w-[960px] mx-auto px-5 md:px-12" style={{ position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase" as const }}>
            CAREER CONSULTATION
          </div>
          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(22px, 3vw, 32px)",
            fontWeight: 700, color: "#fff",
            marginBottom: 12, lineHeight: 1.4,
          }}>
            先輩に、相談する。
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.85, maxWidth: 480, margin: "0 0 20px" }}>
            IT業界出身のメンターが、転職の本音を一緒に整理します。営業なし・完全無料・30分。
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
            {[
              { label: `${mentors.length}名のメンター`, icon: "👥" },
              { label: "30分・完全無料", icon: "✓" },
              { label: "編集部が個別声がけ", icon: "✓" },
            ].map(({ label, icon }) => (
              <span key={label} style={{
                fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 100,
                background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)",
                border: "1px solid rgba(255,255,255,0.2)",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                <span style={{ fontSize: 12 }}>{icon}</span>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Filter Bar (sticky) ─── */}
      <div
        id="mentors"
        className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm"
        style={{ borderBottom: "1px solid #e5e7eb" }}
      >
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 72 }} className="flex-shrink-0">
              悩みで絞る
            </span>
            <div className="flex flex-nowrap gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {WORRY_FILTERS.map((f) => (
                <FilterChip
                  key={f.value}
                  label={f.label}
                  selected={worryFilter === f.value}
                  onClick={() => setWorryFilter(f.value)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Recommended Section ─── */}
      {isLoggedIn &&
        profileReady &&
        recommendations.length > 0 &&
        worryFilter === "all" && (
          <section className="max-w-[960px] mx-auto px-4 sm:px-6 pt-8 pb-2">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>あなたにおすすめのメンター</h2>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>プロフィールに基づく</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ marginBottom: 8 }}>
              {recommendations.map((rec, idx) => (
                <MentorCard
                  key={rec.mentor.id}
                  mentor={rec.mentor}
                  matchReasons={rec.reasons}
                  isTopRecommended={idx === 0}
                  layout="grid"
                />
              ))}
            </div>
            <div style={{ borderBottom: "1px solid #e5e7eb", marginTop: 24 }} />
          </section>
        )}

      {/* ─── Profile / Signup Prompts ─── */}
      {isLoggedIn && !profileReady && (
        <section className="max-w-[960px] mx-auto px-4 sm:px-6 pt-8 pb-2">
          <div style={{ background: "#f8f9fa", border: "1.5px dashed #d1d5db", borderRadius: 12, padding: "20px 24px", textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: "#374151", marginBottom: 14, lineHeight: 1.7 }}>
              プロフィールを設定すると、あなたに合った<br />メンターが自動で表示されます
            </div>
            <Link href="/profile/edit" style={{ display: "inline-block", background: "#059669", color: "#fff", fontSize: 14, fontWeight: 600, padding: "10px 24px", borderRadius: 8, textDecoration: "none" }}>
              プロフィールを設定する（1分）
            </Link>
          </div>
        </section>
      )}

      {!isLoggedIn && (
        <section className="max-w-[960px] mx-auto px-4 sm:px-6 pt-8 pb-2">
          <div style={{ background: "#f8f9fa", border: "1.5px dashed #d1d5db", borderRadius: 12, padding: "20px 24px", textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: "#374151", marginBottom: 14, lineHeight: 1.7 }}>
              無料登録すると、あなたに合ったメンターが<br />自動で見つかります
            </div>
            <Link href="/auth/signup" style={{ display: "inline-block", background: "#059669", color: "#fff", fontSize: 14, fontWeight: 600, padding: "10px 24px", borderRadius: 8, textDecoration: "none" }}>
              無料で登録する
            </Link>
          </div>
        </section>
      )}

      {/* ─── Mentor Grid ─── */}
      <section className="max-w-[960px] mx-auto px-4 sm:px-6 py-8">
        {/* ツールバー */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              <span style={{ fontWeight: 600, color: "#1f2937" }}>{filtered.length}名</span>のメンター
            </span>
            {worryFilter !== "all" && (
              <button
                type="button"
                onClick={() => setWorryFilter("all")}
                style={{ fontSize: 12, fontWeight: 500, color: "#1D9E75", background: "none", border: "none", cursor: "pointer" }}
              >
                フィルターをクリア
              </button>
            )}
          </div>

          {/* レイアウト切り替え 3列・2列・1列 */}
          <div style={{ display: "flex", gap: 4 }}>
            {/* 3列 */}
            <button
              type="button"
              onClick={() => handleLayout("grid3")}
              aria-pressed={layout === "grid3"}
              aria-label="3列表示"
              style={{
                width: 32, height: 28, borderRadius: 6, cursor: "pointer",
                border: layout === "grid3" ? "1px solid #1D9E75" : "1px solid #e5e7eb",
                background: layout === "grid3" ? "#1D9E75" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ width: 3, height: 3, borderRadius: 0.5, background: layout === "grid3" ? "#fff" : "#9ca3af" }} />
                ))}
              </div>
            </button>
            {/* 2列 */}
            <button
              type="button"
              onClick={() => handleLayout("grid")}
              aria-pressed={layout === "grid"}
              aria-label="2列表示"
              style={{
                width: 32, height: 28, borderRadius: 6, cursor: "pointer",
                border: layout === "grid" ? "1px solid #1D9E75" : "1px solid #e5e7eb",
                background: layout === "grid" ? "#1D9E75" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ width: 4, height: 4, borderRadius: 0.5, background: layout === "grid" ? "#fff" : "#9ca3af" }} />
                ))}
              </div>
            </button>
            {/* 1列 */}
            <button
              type="button"
              onClick={() => handleLayout("list")}
              aria-pressed={layout === "list"}
              aria-label="1列表示"
              style={{
                width: 32, height: 28, borderRadius: 6, cursor: "pointer",
                border: layout === "list" ? "1px solid #1D9E75" : "1px solid #e5e7eb",
                background: layout === "list" ? "#1D9E75" : "#fff",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
              }}
            >
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 12, height: 2, borderRadius: 999, background: layout === "list" ? "#fff" : "#9ca3af" }} />
              ))}
            </button>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className={
            layout === "grid3" ? "grid grid-cols-1 sm:grid-cols-3 gap-3" :
            layout === "grid"  ? "grid grid-cols-1 sm:grid-cols-2 gap-4" :
                                 "grid grid-cols-1 gap-3"
          }>
            {filtered.map((m) => (
              <MentorCard
                key={m.id}
                mentor={m}
                layout={layout}
                isTopRecommended={!profileReady && m.name.startsWith("柴")}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "var(--royal-50)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <p className="text-gray-600 text-[14px] mb-2">該当するメンターが見つかりませんでした</p>
            <button
              type="button"
              onClick={() => setWorryFilter("all")}
              style={{ fontSize: 13, fontWeight: 500, color: "#1D9E75", background: "none", border: "none", cursor: "pointer" }}
            >
              フィルターをクリア
            </button>
          </div>
        )}
      </section>

      {/* ─── Bottom CTA ─── */}
      <section style={{ background: "var(--warm-soft)", borderTop: "1px solid #FDE68A", padding: "48px 0" }}>
        <div className="max-w-[960px] mx-auto px-4 sm:px-6" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#B45309", marginBottom: 10, textTransform: "uppercase" as const }}>
            OPINIO MENTOR
          </div>
          <h2 style={{ fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, color: "var(--ink)", marginBottom: 8, fontFamily: "var(--font-noto-serif)" }}>
            まずは気軽に30分、話してみませんか？
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 24, lineHeight: 1.8 }}>
            営業は一切なし。転職するかどうか決まっていなくてもOKです。
          </p>
          <a
            href="#mentors"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 14, fontWeight: 700, padding: "13px 28px", borderRadius: 8,
              background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
              color: "#fff", textDecoration: "none",
              boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            メンターを選んで予約する（無料）
          </a>
        </div>
      </section>
    </>
  );
}
