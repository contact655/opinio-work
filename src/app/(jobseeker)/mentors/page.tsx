import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMentors, type MentorData } from "@/lib/supabase/queries";
import { fetchCategoriesWithMentors } from "@/lib/mentors";
import { ConsultationSection } from "@/components/mentors/ConsultationSection";
import MentorFilterBar from "./MentorFilterBar";

export const metadata: Metadata = {
  title: "先輩に相談する — OPINIO",
  description:
    "IT/SaaS業界の先輩社員・元社員に30分の無料キャリア相談。Opinio編集部が最適なメンターをご紹介します。",
};

// ─── Mentor Card（全一覧グリッド用・既存デザイン維持） ────────────────────────

function MentorCard({ mentor }: { mentor: MentorData }) {
  return (
    <article
      style={{
        display: "flex", flexDirection: "column",
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "22px 22px 20px",
        boxShadow: "0 2px 8px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.06)",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
      }}
      className="mentor-card"
    >
      {/* Head: avatar + name/role */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
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
            position: "absolute", bottom: -2, right: -2,
            width: 18, height: 18, borderRadius: "50%",
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
              <span style={{
                width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                background: mentor.is_available ? "var(--success)" : "var(--ink-mute)",
              }} />
              {mentor.is_available ? "相談受付中" : "一時停止中"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--ink)" }}>{mentor.current_company || "（非公開）"}</strong>
            {mentor.current_role && ` · ${mentor.current_role}`}
          </div>
        </div>
      </div>

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

      {/* CTA */}
      <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--line-soft, #F1F5F9)" }}>
        <Link
          href={`/mentors/${mentor.id}`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            width: "100%", padding: "10px",
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

  // 全メンター（フィルタ付き） + カテゴリ別（フィルタなし）を並列取得
  const [allMentors, categoriesWithMentors] = await Promise.all([
    getMentors({ dept, theme }),
    fetchCategoriesWithMentors(),
  ]);

  const hasMentors = allMentors.length > 0;
  // アバタープレビューは 5 名以上いるときのみ表示（1〜2名の重なりデザイン崩れ防止）
  const hasEnoughMentorsForPreview = allMentors.length >= 5;

  // カテゴリ中、メンターが 1 名以上いるものだけ表示（0名カテゴリは ConsultationSection 内で null）
  const hasAnyCategory = categoriesWithMentors.some((c) => c.mentors.length > 0);

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>OPINIO</Link>
            <span>/</span>
            <span style={{ color: "var(--ink-soft)" }}>先輩に相談</span>
          </div>
        </div>
      </div>

      {/* ヒーロー */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "48px 0 40px" }}>
        <div style={{ maxWidth: "var(--max-w-text)", margin: "0 auto", textAlign: "center" }} className="px-5">

          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 500,
            color: "var(--ink)", letterSpacing: "0.04em",
            marginBottom: 16, lineHeight: 1.4,
          }}>
            先輩に、相談する。
          </h1>

          <p style={{
            fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8,
            marginBottom: hasMentors ? 24 : 16,
          }}>
            30分の無料相談 · Opinio 編集部が最適な先輩をご紹介します
          </p>

          {/* アバタープレビュー（5 名以上いる場合のみ表示） */}
          {hasEnoughMentorsForPreview && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0, marginBottom: 20 }}>
              {allMentors.slice(0, 8).map((m, i) => (
                <div key={m.id} style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: m.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  border: "2.5px solid #fff",
                  marginLeft: i === 0 ? 0 : -10,
                  boxShadow: "0 0 0 2px var(--royal), 0 0 0 4px rgba(0,35,102,0.1)",
                  position: "relative", zIndex: 10 - i,
                }}>
                  {m.initial}
                </div>
              ))}
              {allMentors.length > 8 && (
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "var(--bg-tint)", border: "2px solid var(--line)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
                  marginLeft: -10, position: "relative", zIndex: 1,
                }}>
                  +{allMentors.length - 8}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            {["編集部が個別に声がけした厳選メンター", "申請フォームなし", "完全無料"].map((label) => (
              <span key={label} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 600, color: "var(--ink-soft)",
                padding: "5px 12px", borderRadius: 100,
                background: "var(--bg-tint)", border: "1px solid var(--line)",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
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
            <main style={{ background: "var(--bg-tint)" }}>
              <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
                {allMentors.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-mute)" }}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
                    <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--ink-soft)" }}>
                      条件に合うメンターが見つかりませんでした
                    </p>
                    <p style={{ fontSize: 14 }}>フィルターを変更してみてください</p>
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

      <style>{`
        .mentor-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 6px 16px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.08) !important;
          transform: translateY(-2px) !important;
        }
        .mentor-cta:hover {
          opacity: 0.88 !important;
          transform: translateY(-1px) !important;
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
          color: #1a1d24;
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
      `}</style>
    </>
  );
}
