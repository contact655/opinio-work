import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMentors, type MentorData } from "@/lib/supabase/queries";
import { fetchCategoriesWithMentors } from "@/lib/mentors";
import { ConsultationSection } from "@/components/mentors/ConsultationSection";
import MentorFilterBar from "./MentorFilterBar";

// 5分間ページキャッシュ（ISR）
export const revalidate = 300;

export const metadata: Metadata = {
  title: "先輩に相談する — OPINIO",
  description:
    "IT/SaaS業界の先輩社員・元社員に30分の無料キャリア相談。OPINIO編集部が最適なメンターをご紹介します。",
  keywords: ["メンター", "キャリア相談", "IT転職相談", "SaaS業界", "30分相談", "無料", "OPINIO"],
  alternates: { canonical: "/mentors" },
  openGraph: {
    title: "IT/SaaS業界の先輩に相談する | OPINIO",
    description: "IT/SaaS業界の先輩社員・元社員に30分の無料キャリア相談。OPINIO編集部が最適なメンターをご紹介します。",
    type: "website",
    url: "/mentors",
    images: [{ url: "/api/og?type=list&title=%E3%83%A1%E3%83%B3%E3%82%BF%E3%83%BC%E3%81%AB%E7%9B%B8%E8%AB%87&sub=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E5%85%88%E8%BC%A9%E3%81%AB30%E5%88%86%E7%84%A1%E6%96%99%E7%9B%B8%E8%AB%87", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

// ─── Mentor Card（全一覧グリッド用・既存デザイン維持） ────────────────────────

function MentorCard({ mentor }: { mentor: MentorData }) {
  return (
    <article
      style={{
        display: "flex", flexDirection: "column",
        background: "#fff",
        border: "none",
        borderRadius: 18,
        padding: "22px 22px 20px",
        boxShadow: "0 1px 3px rgba(15,23,42,0.05), 0 6px 20px rgba(15,23,42,0.07)",
        transition: "box-shadow 0.24s cubic-bezier(0.22,1,0.36,1), transform 0.24s cubic-bezier(0.22,1,0.36,1)",
        willChange: "transform",
      }}
      className="mentor-card"
    >
      {/* Head: avatar + name/role */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: mentor.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 18, fontWeight: 700,
            boxShadow: mentor.is_available
              ? "0 0 0 2.5px var(--royal), 0 0 0 5px rgba(0,35,102,0.12)"
              : "0 0 0 2.5px var(--line), 0 0 0 5px rgba(0,0,0,0.04)",
            opacity: mentor.is_available ? 1 : 0.7,
          }}>
            {mentor.initial}
          </div>
          <div style={{
            position: "absolute", bottom: -3, right: -3,
            width: 18, height: 18, borderRadius: 6,
            background: mentor.is_available ? "var(--royal)" : "var(--ink-mute)",
            border: "2px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: mentor.is_available ? "var(--ink)" : "var(--ink-mute)" }}>
              {mentor.name}さん
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
              background: mentor.is_available ? "var(--success-soft)" : "var(--bg-tint)",
              color: mentor.is_available ? "var(--success)" : "var(--ink-mute)",
              border: `1px solid ${mentor.is_available ? "#A7F3D0" : "var(--line)"}`,
              letterSpacing: "0.04em",
            }}>
              <span
                className={mentor.is_available ? "pulse-dot" : undefined}
                style={{
                  width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                  background: mentor.is_available ? "var(--success)" : "var(--ink-mute)",
                }}
              />
              {mentor.is_available ? "相談受付中" : "一時停止中"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--ink)" }}>{mentor.current_company || "（非公開）"}</strong>
            {mentor.current_role && ` · ${mentor.current_role}`}
          </div>
        </div>
      </div>

      {/* Catchphrase */}
      {mentor.catchphrase && (
        <div style={{
          fontSize: 13,
          color: "#334155",
          lineHeight: 1.7,
          fontStyle: "italic",
          padding: "10px 14px",
          background: "linear-gradient(135deg, var(--royal-50) 0%, #f0f4ff 100%)",
          borderLeft: "3px solid var(--royal)",
          borderRadius: "0 8px 8px 0",
          marginBottom: 12,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
        }}>
          「{mentor.catchphrase}」
        </div>
      )}

      {/* Career chain */}
      {mentor.career_chain.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4,
          fontSize: 11.5, color: "var(--ink-mute)",
          marginBottom: 12, lineHeight: 1.6,
        }}>
          {mentor.career_chain.map((step, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
              <span style={{
                color: step.is_current ? "var(--royal)" : "var(--ink-mute)",
                fontWeight: step.is_current ? 700 : 400,
              }}>
                {step.label}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Theme tags */}
      {mentor.themes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
          {mentor.themes.slice(0, 3).map((theme) => (
            <span key={theme} style={{
              fontSize: 10.5, padding: "4px 10px", borderRadius: 100,
              background: "#fff", border: "1px solid var(--royal-100)",
              color: "var(--royal)", fontWeight: 600,
            }}>
              {theme}
            </span>
          ))}
        </div>
      )}

      {/* Session count badge */}
      {(mentor.success_count ?? 0) > 0 && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          marginBottom: 12, padding: "5px 10px", borderRadius: 8,
          background: "var(--success-soft)", border: "1px solid #A7F3D0",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success)" }}>
            相談実績{" "}
            <span style={{ fontFamily: "Inter, sans-serif" }}>{mentor.success_count}</span>
            件
          </span>
        </div>
      )}

      {/* CTA — 左：詳細を見る  右：相談する */}
      <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--line-soft, #F1F5F9)", display: "flex", gap: 8 }}>
        {/* 左：プロフィール詳細 */}
        <Link
          href={`/mentors/${mentor.id}`}
          prefetch={true}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            flex: "0 0 auto", padding: "10px 14px",
            background: "transparent",
            color: "var(--ink-soft)",
            border: "1px solid var(--line)",
            borderRadius: 8, textDecoration: "none",
            fontSize: 12, fontWeight: 500,
            transition: "border-color 0.15s, color 0.15s",
            whiteSpace: "nowrap",
          }}
          className="mentor-profile-link"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          詳細を見る
        </Link>
        {/* 右：相談する → 予約ページへ */}
        <Link
          href={`/mentors/${mentor.id}/reserve`}
          prefetch={true}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            flex: 1, padding: "10px",
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            color: "#fff",
            border: "none",
            borderRadius: 8, textDecoration: "none",
            fontSize: 13, fontWeight: 700,
            transition: "opacity 0.2s, transform 0.15s",
            boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
          }}
          className="mentor-cta"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          相談する
        </Link>
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function MentorsPage({ searchParams }: { searchParams: SearchParams }) {
  const dept  = typeof searchParams.dept  === "string" ? searchParams.dept  : undefined;
  const theme = typeof searchParams.theme === "string" ? searchParams.theme : undefined;
  const sort  = typeof searchParams.sort  === "string" ? searchParams.sort  : undefined;
  const q     = typeof searchParams.q     === "string" ? searchParams.q     : undefined;

  // 全メンター（フィルタ付き） + カテゴリ別（フィルタなし）を並列取得
  const [allMentors, categoriesWithMentors] = await Promise.all([
    getMentors({ dept, theme, sort, q }),
    fetchCategoriesWithMentors(),
  ]);

  const hasMentors = allMentors.length > 0;
  // アバタープレビューは 5 名以上いるときのみ表示（1〜2名の重なりデザイン崩れ防止）
  const hasEnoughMentorsForPreview = allMentors.length >= 5;

  // カテゴリ中、メンターが 1 名以上いるものだけ表示（0名カテゴリは ConsultationSection 内で null）
  const hasAnyCategory = categoriesWithMentors.some((c) => c.mentors.length > 0);

  return (
    <>
      {/* ── Gradient hero header ── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, var(--royal) 55%, #1e3a8a 100%)",
        padding: "44px 0 40px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background decorations */}
        <div style={{ position: "absolute", right: -100, top: -100, width: 480, height: 480, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -60, bottom: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.025)", pointerEvents: "none" }} />

        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", padding: "0 20px", textAlign: "center", position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.65)", marginBottom: 12, textTransform: "uppercase" as const }}>
            MENTORS
          </div>

          {/* Avatar stack */}
          {hasEnoughMentorsForPreview && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0, marginBottom: 20 }}>
              {allMentors.slice(0, 8).map((m, i) => (
                <div key={m.id} style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: m.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 14, fontWeight: 700,
                  border: "2.5px solid rgba(255,255,255,0.9)",
                  marginLeft: i === 0 ? 0 : -10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  position: "relative", zIndex: 10 - i,
                }}>
                  {m.initial}
                </div>
              ))}
              {allMentors.length > 8 && (
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: "rgba(255,255,255,0.15)", border: "2.5px solid rgba(255,255,255,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.9)",
                  marginLeft: -10, position: "relative", zIndex: 1,
                }}>
                  +{allMentors.length - 8}
                </div>
              )}
            </div>
          )}

          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700,
            color: "#fff", margin: "0 0 12px", lineHeight: 1.4,
          }}>
            先輩に、相談する。
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, marginBottom: 24 }}>
            30分の無料相談 · OPINIO 編集部が最適な先輩をご紹介します
          </p>

          {/* Trust chips */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            {["編集部が個別に声がけした厳選メンター", "申請フォームなし", "完全無料"].map((label) => (
              <span key={label} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.88)",
                padding: "5px 13px", borderRadius: 999,
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* メンターが 1 名以上いる場合のみ [2][3] を表示 */}
      {hasMentors && (
        <>
          {/* [2] 悩みカテゴリ別カルーセル */}
          {hasAnyCategory && (
            <div style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
              <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
                {categoriesWithMentors.map((category) => (
                  <ConsultationSection key={category.id} category={category} />
                ))}
              </div>
            </div>
          )}

          {/* [3] 全メンター一覧 */}
          <>
            {/* フィルタバー */}
            <Suspense fallback={<div style={{ height: 52, background: "#fff", borderBottom: "1px solid var(--line)" }} />}>
              <MentorFilterBar total={allMentors.length} />
            </Suspense>

            {/* グリッド */}
            <main style={{ background: "#f0f4f8" }}>
              <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
                {allMentors.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--ink-mute)" }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: "50%",
                      background: "var(--royal-50)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      margin: "0 auto 20px",
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}>
                      条件に合うメンターが見つかりませんでした
                    </p>
                    <p style={{ fontSize: 14, lineHeight: 1.7 }}>フィルターを変更するか、すべてのメンターを表示してみてください</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {allMentors.map((mentor) => (
                      <MentorCard key={mentor.id} mentor={mentor} />
                    ))}
                  </div>
                )}
              </div>
            </main>
          </>
        </>
      )}

      {/* ── 企業・求人への誘導 CTA ── */}
      <div style={{ background: "#f0f4f8", padding: "48px 24px 56px" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-mute)", textTransform: "uppercase" as const, marginBottom: 8 }}>
              EXPLORE MORE
            </p>
            <p style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(16px,2vw,20px)", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              相談テーマを見つけるために
            </p>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/companies" style={{
              flex: 1, minWidth: 260, textDecoration: "none",
              background: "#fff",
              borderRadius: 16, padding: "28px 32px",
              display: "flex", flexDirection: "column", gap: 10,
              boxShadow: "0 1px 3px rgba(15,23,42,0.05), 0 6px 20px rgba(15,23,42,0.07)",
              transition: "box-shadow 0.2s, transform 0.2s",
            }} className="cta-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", textTransform: "uppercase" as const }}>
                  COMPANIES
                </div>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
              </div>
              <p style={{ fontFamily: "var(--font-noto-serif)", fontSize: 18, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5, margin: 0 }}>
                先輩が働く企業を<br />詳しく見てみよう
              </p>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "var(--royal)" }}>
                企業一覧を見る
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M9 18l6-6-6-6"/></svg>
              </span>
            </Link>
            <Link href="/jobs" style={{
              flex: 1, minWidth: 260, textDecoration: "none",
              background: "#fff",
              borderRadius: 16, padding: "28px 32px",
              display: "flex", flexDirection: "column", gap: 10,
              boxShadow: "0 1px 3px rgba(15,23,42,0.05), 0 6px 20px rgba(15,23,42,0.07)",
              transition: "box-shadow 0.2s, transform 0.2s",
            }} className="cta-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent)", textTransform: "uppercase" as const }}>
                  JOBS
                </div>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8l-2 4h12z"/></svg>
                </div>
              </div>
              <p style={{ fontFamily: "var(--font-noto-serif)", fontSize: 18, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5, margin: 0 }}>
                気になる求人を見つけて<br />相談テーマを絞り込もう
              </p>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
                求人一覧を見る
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M9 18l6-6-6-6"/></svg>
              </span>
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.5); }
        }
        .pulse-dot { animation: pulseDot 1.8s ease-in-out infinite; }
        .mentor-card:hover {
          box-shadow: 0 12px 36px rgba(0,35,102,0.18), 0 2px 8px rgba(0,35,102,0.08) !important;
          transform: translateY(-5px) !important;
        }
        .mentor-card:active {
          box-shadow: 0 4px 12px rgba(15,23,42,0.10) !important;
          transform: translateY(-2px) !important;
          transition-duration: 0.06s !important;
        }
        .mentor-cta:hover {
          opacity: 0.88 !important;
          transform: translateY(-1px) !important;
        }
        .mentor-profile-link:hover {
          border-color: var(--royal-100) !important;
          color: var(--royal) !important;
        }
        .cta-card:hover {
          box-shadow: 0 12px 36px rgba(0,35,102,0.14), 0 2px 8px rgba(0,35,102,0.07) !important;
          transform: translateY(-3px) !important;
        }
        /* carousel-arrow は GenreCarousel の CSS を流用 */
        .carousel-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(calc(-50% - 4px));
          z-index: 10;
          width: 36px; height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.96);
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(15,23,42,0.12);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--ink);
          font-size: 18px; line-height: 1; padding: 0;
          transition: opacity 0.18s ease, box-shadow 0.18s ease;
          pointer-events: auto; user-select: none;
        }
        .carousel-arrow:hover {
          box-shadow: 0 4px 14px rgba(15,23,42,0.16);
          border-color: #cbd5e1;
        }
        .carousel-arrow-left  { left: 8px; }
        .carousel-arrow-right { right: 8px; }
        .carousel-arrow-hidden { opacity: 0; pointer-events: none; }
        @media (max-width: 640px) { .carousel-arrow { display: none; } }
        .mentor-theme-pills::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}
