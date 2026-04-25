"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FavoriteJobButton from "@/components/FavoriteJobButton";
import { getJobCategoryStyle } from "@/lib/utils/jobCategoryStyle";
import { getCompanyLogoSources } from "@/lib/utils/companyLogo";
import { getMentorAvatarProps } from "@/lib/utils/mentorAvatar";
import { getCompanyPerspective, formatUpdatedAt } from "@/lib/companyPerspective";
import { CompanyActionButtons } from "@/components/CompanyActionButtons";
import { CompanyLinks } from "@/components/CompanyLinks";
import { SelectionProcess } from "@/components/SelectionProcess";
import { HiringPolicy } from "@/components/HiringPolicy";

// ─── Types ────────────────────────────────────────────

type Company = any;
type Job = any;
type CultureTag = { id: string; tag_category: string; tag_value: string };
type Member = { id: string; name: string; role: string; background?: string; photo_url?: string };
type Review = { id: string; reviewer_name: string; role: string; content: string; rating: number };
type MatchScore = {
  overall_score: number;
  culture_score: number;
  skill_score: number;
  career_score: number;
  workstyle_score: number;
  match_reasons: string[];
} | null;

type Tab = "overview" | "jobs" | "members" | "culture" | "articles" | "match";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "概要" },
  { id: "jobs", label: "求人" },
  { id: "members", label: "メンバー" },
  { id: "culture", label: "カルチャー" },
  { id: "articles", label: "記事" },
  { id: "match", label: "マッチ度" },
];

// ─── Constants ────────────────────────────────────────

// ─── (LOGO_COLORS/getLogoColor removed — no longer needed) ───

// ─── Hero Logo ────────────────────────────────────────

function HeroLogo({ company, coverColor, size = 64 }: { company: Company; coverColor: string; size?: number }) {
  const sources = getCompanyLogoSources(company);
  const [srcIndex, setSrcIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const currentSrc = sources[srcIndex] ?? null;
  const showInitial = !currentSrc || (!loaded && srcIndex >= sources.length);

  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: showInitial ? "#f3f4f6" : "#fff", border: showInitial ? "0.5px solid #e5e7eb" : "none", padding: showInitial ? 0 : 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
      {currentSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentSrc}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", display: loaded ? "block" : "none" }}
          onLoad={(e) => {
            const img = e.target as HTMLImageElement;
            if (img.naturalWidth === 0) {
              setSrcIndex((i) => i + 1);
            } else {
              setLoaded(true);
            }
          }}
          onError={() => { setLoaded(false); setSrcIndex((i) => i + 1); }}
        />
      )}
      {!loaded && (
        <span style={{ fontSize: size * 0.35, fontWeight: 700, color: coverColor || '#1e3a5f' }}>{company.name?.[0] ?? "?"}</span>
      )}
    </div>
  );
}

// ─── Score Bar ─────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-gray-500 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: score >= 70 ? "#1D9E75" : score >= 40 ? "#F59E0B" : "#EF4444" }} />
      </div>
      <span className="text-[13px] font-semibold text-gray-700 w-10 text-right">{score}</span>
    </div>
  );
}

// ─── (ShareButton removed — decluttered header) ───

// ─── Main Component ───────────────────────────────────

type PostHireReport = {
  id: string;
  months_after: number;
  culture_match: number | null;
  workstyle_match: number | null;
  salary_match: number | null;
  overall_satisfaction: number | null;
  good_points: string | null;
  concerns: string | null;
  gap_from_expectation: string | null;
  would_recommend: boolean | null;
  created_at: string;
};

export default function CompanyDetailClient({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  company, jobs, members, cultureTags, reviews, matchScore, isLoggedIn, hasProfile, postHireReports, isFavorited: initialFavorited, relatedMentors = [], companyMembers = [], positionCategories = [], companyArticles = [], myWorkHistory = null,
}: {
  company: Company;
  jobs: Job[];
  members: Member[];
  cultureTags: CultureTag[];
  reviews: Review[];
  matchScore: MatchScore;
  isLoggedIn: boolean;
  hasProfile?: boolean;
  postHireReports?: PostHireReport[];
  isFavorited?: boolean;
  relatedMentors?: any[];
  companyMembers?: any[];
  positionCategories?: any[];
  companyArticles?: any[];
  myWorkHistory?: any;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [jobsPage, setJobsPage] = useState(1);
  const [isSticky, setIsSticky] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const tabRef = useRef<HTMLDivElement>(null);
  // modalMember removed — members now navigate to detail page
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [obFilter, setObFilter] = useState<string>("all");
  const [articleTag, setArticleTag] = useState<string>("すべて");
  const [favorited, setFavorited] = useState(initialFavorited ?? false);
  const [favLoading, setFavLoading] = useState(false);

  const cultureCatTags = cultureTags.filter((t) => t.tag_category === "culture");

  // カルチャーデータ有無チェック
  const hasCultureData = !!(
    cultureTags.length > 0 ||
    company.culture_description ||
    company.paid_leave_rate != null ||
    company.flex_time === true ||
    company.side_job_ok === true ||
    company.core_time ||
    company.annual_holiday_days ||
    company.office_days_per_week ||
    company.bonus_times != null ||
    company.salary_raise_frequency ||
    company.salary_review_times ||
    company.evaluation_cycle ||
    company.has_stock_option === true ||
    company.has_incentive === true ||
    company.has_book_allowance === true ||
    company.has_learning_support === true ||
    company.has_internal_transfer === true ||
    company.avg_tenure_years || company.avg_tenure ||
    company.turnover_rate ||
    company.mid_career_ratio != null ||
    company.female_ratio || company.female_manager_ratio != null ||
    company.childcare_leave_rate || company.maternity_leave_female != null || company.maternity_leave_male != null ||
    company.has_housing_allowance === true ||
    company.has_meal_allowance === true
  );
  const hasArticles = companyArticles.length > 0;

  // ヒーローカラー: brand_color 優先 → cover_color → null (→ ライトグレーのプレースホルダー)
  const customColor = company.brand_color || company.cover_color;
  const coverColor = customColor || "#6b7280"; // テキスト影のための参照値
  const hasBrandColor = !!customColor;
  // ヒーロー画像: cover_image_url → header_image_url（後方互換）
  const heroImageUrl = (company as any).cover_image_url || company.header_image_url;
  const jobCount = jobs.length;

  // Sticky tab detection
  useEffect(() => {
    const el = tabRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 修正4: カジュアル面談リクエスト（Supabase直接）
  const handleCasualRequest = async () => {
    if (!isLoggedIn) {
      router.push("/auth/signup");
      return;
    }
    setRequesting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/signup"); return; }

      // 既存スレッドを確認
      const { data: existing } = await supabase
        .from("ow_threads")
        .select("id")
        .eq("company_id", company.id)
        .eq("candidate_id", user.id)
        .maybeSingle();

      if (existing) {
        router.push(`/messages?thread=${existing.id}`);
        return;
      }

      // 新規スレッド作成
      const { data: thread, error } = await supabase
        .from("ow_threads")
        .insert({
          company_id: company.id,
          candidate_id: user.id,
          status: "casual_requested",
        })
        .select()
        .single();

      if (error || !thread) {
        console.error("Thread creation failed:", error);
        alert("カジュアル面談リクエストを送信しました");
        return;
      }

      // システムメッセージを自動投稿
      await supabase.from("ow_messages").insert({
        thread_id: thread.id,
        sender_id: user.id,
        content: `${company.name}へのカジュアル面談リクエストが送信されました`,
      });

      router.push(`/messages?thread=${thread.id}`);
    } catch {
      alert("カジュアル面談リクエストを送信しました");
    } finally {
      setRequesting(false);
    }
  };

  // 修正1: 「万万」「名名」の重複を修正
  const salaryDisplay = company.avg_salary ?? "応相談";
  const employeeDisplay = company.employee_count && company.employee_count !== "非公開"
    ? /^\d+$/.test(company.employee_count)
      ? `${Number(company.employee_count).toLocaleString()}名`
      : String(company.employee_count).includes("名")
        ? company.employee_count
        : `${company.employee_count}名`
    : null;

  const heroStats = [
    { value: salaryDisplay, label: "平均年収", primary: true, note: "※2026年4月時点・Opinio独自調査" },
    { value: company.remote_rate ? `${company.remote_rate}%` : "–", label: "リモート率", primary: true, note: "※企業公表値または取材ベース" },
    employeeDisplay ? { value: employeeDisplay, label: "社員数", primary: false, note: undefined } : null,
    jobCount > 0 ? { value: `${jobCount}件`, label: "求人数", primary: false, note: undefined } : null,
  ].filter(Boolean) as { value: string; label: string; primary: boolean; note?: string }[];

  return (
    <>
      {/* ─── Hero ─── */}
      {heroImageUrl ? (
        /* ── ヘッダー画像あり ── */
        <div style={{ position: "relative", height: 240, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt={company.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 w-full" style={{ paddingBottom: 28 }}>
              {/* Breadcrumb */}
              <nav style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12 }}>
                <Link href="/companies" style={{ color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>企業一覧</Link>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>›</span>
                <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{company.name}</span>
              </nav>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <HeroLogo company={company} coverColor={coverColor} size={72} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 500, color: "#fff", margin: 0 }}>{company.name}</h1>
                    {/* Heart */}
                    <button
                      style={{
                        width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: favorited ? "rgba(226,75,74,0.2)" : "rgba(255,255,255,0.15)",
                        border: favorited ? "1px solid rgba(226,75,74,0.5)" : "1px solid rgba(255,255,255,0.3)",
                        cursor: "pointer", flexShrink: 0,
                      }}
                      disabled={favLoading}
                      onClick={async () => {
                        if (!isLoggedIn) { router.push("/auth/login"); return; }
                        setFavLoading(true);
                        const supabase = createClient();
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) { setFavLoading(false); return; }
                        if (favorited) {
                          await supabase.from("ow_favorites").delete()
                            .eq("user_id", user.id).eq("target_type", "company").eq("target_id", company.id);
                        } else {
                          await supabase.from("ow_favorites").insert({
                            user_id: user.id, target_type: "company", target_id: company.id,
                          });
                        }
                        setFavorited(!favorited);
                        setFavLoading(false);
                      }}
                    >
                      <svg width="16" height="16" fill={favorited ? "#E24B4A" : "none"} stroke={favorited ? "#E24B4A" : "white"} viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                    </button>
                  </div>
                  {company.tagline && (
                    <p style={{ fontSize: 13, opacity: 0.8, color: "#fff", marginTop: 4, margin: 0 }}>{company.tagline}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── ヘッダー画像なし：ブランドカラーグラデーション or 薄いプレースホルダー ── */
        <div style={{
          position: "relative", height: 240, overflow: "hidden",
          background: hasBrandColor
            ? `linear-gradient(135deg, ${coverColor} 0%, ${coverColor}e6 50%, ${coverColor}b3 100%)`
            : "linear-gradient(135deg, #f5f5f5 0%, #ececec 50%, #e3e3e3 100%)",
        }}>
          {/* 装飾パターン（ブランドカラーありの場合のみ） */}
          {hasBrandColor && (
            <div style={{ position: "absolute", inset: 0, opacity: 0.08, background: "radial-gradient(circle at 20% 50%, #fff 0%, transparent 50%), radial-gradient(circle at 80% 20%, #fff 0%, transparent 40%)" }} />
          )}
          {hasBrandColor && (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 100%)" }} />
          )}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 w-full" style={{ paddingBottom: 28 }}>
              {/* Breadcrumb */}
              <nav style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12 }}>
                <Link href="/companies" style={{ color: hasBrandColor ? "rgba(255,255,255,0.65)" : "#6b7280", textDecoration: "none" }}>企業一覧</Link>
                <span style={{ color: hasBrandColor ? "rgba(255,255,255,0.4)" : "#d1d5db" }}>›</span>
                <span style={{ color: hasBrandColor ? "rgba(255,255,255,0.85)" : "#374151", fontWeight: 500 }}>{company.name}</span>
              </nav>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <HeroLogo company={company} coverColor={coverColor} size={72} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 500, color: hasBrandColor ? "#fff" : "#0f172a", margin: 0 }}>{company.name}</h1>
                    {/* Heart */}
                    <button
                      style={{
                        width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: favorited
                          ? (hasBrandColor ? "rgba(226,75,74,0.2)" : "#fee2e2")
                          : (hasBrandColor ? "rgba(255,255,255,0.15)" : "#fff"),
                        border: favorited
                          ? `1px solid ${hasBrandColor ? "rgba(226,75,74,0.5)" : "#fca5a5"}`
                          : `1px solid ${hasBrandColor ? "rgba(255,255,255,0.3)" : "#e5e7eb"}`,
                        cursor: "pointer", flexShrink: 0,
                      }}
                      disabled={favLoading}
                      onClick={async () => {
                        if (!isLoggedIn) { router.push("/auth/login"); return; }
                        setFavLoading(true);
                        const supabase = createClient();
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) { setFavLoading(false); return; }
                        if (favorited) {
                          await supabase.from("ow_favorites").delete()
                            .eq("user_id", user.id).eq("target_type", "company").eq("target_id", company.id);
                        } else {
                          await supabase.from("ow_favorites").insert({
                            user_id: user.id, target_type: "company", target_id: company.id,
                          });
                        }
                        setFavorited(!favorited);
                        setFavLoading(false);
                      }}
                    >
                      <svg width="16" height="16" fill={favorited ? "#E24B4A" : "none"} stroke={favorited ? "#E24B4A" : (hasBrandColor ? "white" : "#9ca3af")} viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                    </button>
                  </div>
                  {company.tagline && (
                    <p style={{ fontSize: 13, opacity: hasBrandColor ? 0.8 : 1, color: hasBrandColor ? "#fff" : "#6b7280", marginTop: 4, margin: 0 }}>{company.tagline}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Stats Bar (Fix 16: Responsive) ─── */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #e5e7eb" }}>
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop (lg+): 4-col */}
          <div className="hidden lg:grid lg:grid-cols-4" style={{ padding: "12px 0" }}>
            {heroStats.map((s, i) => (
              <div key={i} className={`text-center ${i < heroStats.length - 1 ? "lg:border-r" : ""}`}
                style={{ borderColor: "#e5e7eb", padding: "10px 8px" }}>
                <div style={{
                  fontSize: s.primary ? 24 : 16,
                  fontWeight: s.primary ? 700 : 500,
                  color: "#0f172a",
                  letterSpacing: s.primary ? "-0.01em" : "normal",
                  lineHeight: 1.2,
                }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{s.label}</div>
                {s.note && (
                  <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 3, lineHeight: 1.3 }}>{s.note}</div>
                )}
              </div>
            ))}
          </div>

          {/* Tablet (md - lg): 2x2 */}
          <div className="hidden md:grid md:grid-cols-2 lg:hidden" style={{ padding: "12px 0" }}>
            {heroStats.map((s, i) => (
              <div key={i} className="text-center"
                style={{
                  borderRight: i % 2 === 0 ? "0.5px solid #e5e7eb" : "none",
                  borderBottom: i < 2 ? "0.5px solid #e5e7eb" : "none",
                  padding: "12px 10px",
                }}>
                <div style={{
                  fontSize: s.primary ? 22 : 15,
                  fontWeight: s.primary ? 700 : 500,
                  color: "#0f172a",
                  letterSpacing: s.primary ? "-0.01em" : "normal",
                  lineHeight: 1.2,
                }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{s.label}</div>
                {s.note && (
                  <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2, lineHeight: 1.3 }}>{s.note}</div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile: 年収を大きく単独表示、他3つを1行 */}
          <div className="md:hidden" style={{ padding: "14px 0" }}>
            {(() => {
              const primary = heroStats.find((s) => s.label === "平均年収");
              const secondary = heroStats.filter((s) => s.label !== "平均年収");
              return (
                <>
                  {primary && (
                    <div style={{ textAlign: "center", paddingBottom: 14, borderBottom: "0.5px solid #e5e7eb", marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{primary.label}</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.015em", lineHeight: 1.1 }}>
                        {primary.value}
                      </div>
                      {primary.note && (
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 5 }}>{primary.note}</div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-3" style={{ gap: 0 }}>
                    {secondary.map((s, i) => (
                      <div key={i} className="text-center"
                        style={{
                          borderRight: i < secondary.length - 1 ? "0.5px solid #e5e7eb" : "none",
                          padding: "4px 4px",
                        }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", lineHeight: 1.2 }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ─── Tab Bar (sticky) ─── */}
      <div ref={tabRef} className="h-0" />
      <div style={{
        background: "#fff",
        position: "sticky", top: 64, zIndex: 40,
        boxShadow: isSticky ? "0 1px 4px rgba(0,0,0,0.06)" : undefined,
        borderBottom: "0.5px solid #e5e7eb",
      }}>
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ display: "flex", alignItems: "center" }}>
            {TABS.filter((tab) => {
              // Hide articles tab when no articles
              if (tab.id === "articles" && !hasArticles) return false;
              return true;
            }).map((tab) => {
              const isActive = activeTab === tab.id;
              const isPending =
                (tab.id === "culture" && !hasCultureData);
              const isLockedMatch = tab.id === "match" && !isLoggedIn;
              const badgeCount =
                tab.id === "jobs" ? (jobCount > 0 ? jobCount : 0) :
                tab.id === "members" ? (members.length + relatedMentors.length + companyMembers.filter((m: any) => m.is_public !== false && (m.is_anonymous !== true && m.is_anonymous !== "true") && !!m.name && m.name !== "非公開" && m.name !== "?" && m.name !== "？").length) :
                tab.id === "articles" ? companyArticles.length :
                0;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (isLockedMatch) {
                      router.push("/auth/login");
                      return;
                    }
                    setActiveTab(tab.id);
                  }}
                  title={isLockedMatch ? "ログインして確認" : undefined}
                  style={{
                    fontSize: 14, fontWeight: isActive ? 700 : 500,
                    color: isLockedMatch ? "#9ca3af" : isPending ? "#9ca3af" : isActive ? "#1a6fd4" : "#6b7280",
                    padding: "13px 18px", border: "none",
                    borderBottom: isActive ? "2.5px solid #1a6fd4" : "2.5px solid transparent",
                    background: "transparent", cursor: "pointer",
                    transition: "color .15s",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  {isLockedMatch && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                  {tab.label}
                  {isPending && (
                    <span style={{
                      marginLeft: 4, fontSize: 10,
                      padding: "1px 5px", borderRadius: 20,
                      background: "#f3f4f6", color: "#9ca3af",
                      verticalAlign: "middle",
                    }}>
                      準備中
                    </span>
                  )}
                  {!isPending && !isLockedMatch && badgeCount > 0 && (
                    <span style={{
                      marginLeft: 5, fontSize: 10, fontWeight: 700,
                      padding: "1px 6px", borderRadius: 999,
                      background: isActive ? "#1a6fd4" : "#94a3b8",
                      color: "#fff", verticalAlign: "middle",
                    }}>
                      {badgeCount}
                    </span>
                  )}
                  {tab.id === "match" && matchScore && !isLockedMatch && (
                    <span style={{
                      marginLeft: 5, fontSize: 10, fontWeight: 700,
                      padding: "1px 6px", borderRadius: 999,
                      background: isActive ? "#1a6fd4" : "#94a3b8",
                      color: "#fff", verticalAlign: "middle",
                    }}>
                      {matchScore.overall_score}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div style={{ background: "var(--color-background-tertiary, #f5f5f4)" }}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 24, paddingBottom: 40 }}>

        {/* ══ Overview Tab ══ */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* カード① Opinioの見解（統一デザイン） */}
            {(() => {
              const perspective = getCompanyPerspective(company);
              if (!perspective) return null;

              return (
                <section style={{ background: "#fafaf7", borderRadius: 16, padding: 24, border: "1.5px solid #e8e4dc" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#0f172a", padding: "3px 10px", borderRadius: 6 }}>Opinio</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Opinioの見解</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px 0" }}>
                    {perspective.source || "Opinio独自調査"}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* フィットしやすい点（Fix 14: title + detail） */}
                    {perspective.fit_points.length > 0 && (
                      <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 16, borderLeft: "3px solid #10b981" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d", marginBottom: 10 }}>フィットしやすい点</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {perspective.fit_points.slice(0, 4).map((item, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", flexShrink: 0, marginTop: 6 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#14532d", lineHeight: 1.5 }}>{item.title}</div>
                                {item.detail && (
                                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, marginTop: 3 }}>{item.detail}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* 注意点 */}
                    {perspective.caution_points.length > 0 && (
                      <div style={{ background: "#fffbeb", borderRadius: 10, padding: 16, borderLeft: "3px solid #f59e0b" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>注意点</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {perspective.caution_points.slice(0, 4).map((item, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fbbf24", flexShrink: 0, marginTop: 6 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#78350f", lineHeight: 1.5 }}>{item.title}</div>
                                {item.detail && (
                                  <div style={{ fontSize: 12, color: "#78716c", lineHeight: 1.5, marginTop: 3 }}>{item.detail}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 情報ソース・更新日（Fix 14） */}
                  {(perspective.source || perspective.updated_at) && (
                    <div style={{ marginTop: 12, fontSize: 10, color: "#9ca3af", textAlign: "right" }}>
                      情報ソース: {perspective.source || "Opinio独自調査"}
                      {perspective.updated_at && ` / ${formatUpdatedAt(perspective.updated_at)}`}
                    </div>
                  )}

                  {/* Mentor thumbnails + CTA button (Fix 8 / Fix 8+) */}
                  {(() => {
                    const shownMentors = (relatedMentors || []).slice(0, 3);
                    const count = (relatedMentors || []).length;
                    const hasMentors = count > 0;
                    const buttonLabel = hasMentors
                      ? `${count}名のメンターに話を聞く`
                      : "近しい領域のメンターに相談する";
                    // Placeholder brand-color avatars when 0 mentors
                    const placeholderColor = customColor || "#1D9E75";
                    return (
                      <div style={{ marginTop: 16, padding: 14, background: "#fff", borderRadius: 10, border: "0.5px solid #e8e4dc" }}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                          {hasMentors ? (
                            <>
                              {shownMentors.map((m: any, i: number) => {
                                const ap = getMentorAvatarProps(m.name || "メンター", m.avatar_url);
                                return (
                                  <div
                                    key={m.id || i}
                                    style={{
                                      width: 40, height: 40, borderRadius: "50%",
                                      border: "2px solid #fff",
                                      marginLeft: i === 0 ? 0 : -10,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      background: "#f5f5f5",
                                      overflow: "hidden", flexShrink: 0, zIndex: 3 - i,
                                      position: "relative",
                                    }}
                                  >
                                    {ap.type === "image" ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={ap.src} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                      </svg>
                                    )}
                                  </div>
                                );
                              })}
                              <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 12 }}>
                                {shownMentors.map((m: any) => m.name).filter(Boolean).slice(0, 2).join(" · ")}
                                {count > 2 ? ` ほか${count - 2}名` : ""}
                              </span>
                            </>
                          ) : (
                            <>
                              {/* 0人のとき：ブランドカラーの仮プレースホルダー3つ */}
                              {[0, 1, 2].map((i) => (
                                <div
                                  key={i}
                                  style={{
                                    width: 40, height: 40, borderRadius: "50%",
                                    border: "2px solid #fff",
                                    marginLeft: i === 0 ? 0 : -10,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: placeholderColor,
                                    opacity: 1 - i * 0.2,
                                    overflow: "hidden", flexShrink: 0, zIndex: 3 - i,
                                    position: "relative",
                                  }}
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                  </svg>
                                </div>
                              ))}
                              <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 12 }}>
                                近しい領域の経験を持つメンター
                              </span>
                            </>
                          )}
                        </div>
                        <Link
                          href="/career-consultation"
                          style={{
                            display: "block", width: "100%",
                            padding: "12px 16px", borderRadius: 10,
                            fontSize: 14, fontWeight: 600, color: "#fff",
                            background: "#1D9E75", textAlign: "center",
                            textDecoration: "none",
                          }}
                        >
                          {buttonLabel} →
                        </Link>
                      </div>
                    );
                  })()}
                </section>
              );
            })()}

            {/* Fix 12: 上部登録CTA（未ログイン・未プロフィール時） */}
            {!isLoggedIn && (
              <section style={{
                border: "1.5px dashed #86efac", borderRadius: 12,
                padding: "20px 24px", background: "#f0fdf4",
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#15803d", marginBottom: 2 }}>
                    あなた専用のマッチ度を表示できます
                  </div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    プロフィール設定で、あなたに合った理由が分かります（1分）
                  </div>
                </div>
                <Link href="/auth/signup" style={{
                  display: "inline-block", fontSize: 13, fontWeight: 600,
                  padding: "10px 20px", borderRadius: 8, background: "#059669", color: "#fff", textDecoration: "none",
                  whiteSpace: "nowrap",
                }}>
                  プロフィールを設定する →
                </Link>
              </section>
            )}
            {isLoggedIn && !hasProfile && !matchScore && (
              <section style={{
                border: "1.5px dashed #86efac", borderRadius: 12,
                padding: "20px 24px", background: "#f0fdf4",
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#15803d", marginBottom: 2 }}>
                    あなた専用のマッチポイントを表示できます
                  </div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    プロフィール設定で、あなたに合った理由が分かります（1分）
                  </div>
                </div>
                <Link href="/dashboard/profile" style={{
                  display: "inline-block", fontSize: 13, fontWeight: 600,
                  padding: "10px 20px", borderRadius: 8, background: "#059669", color: "#fff", textDecoration: "none",
                  whiteSpace: "nowrap",
                }}>
                  プロフィールを設定する →
                </Link>
              </section>
            )}

            {/* カード② 企業について（Fix 9: MVV） */}
            {(company.mission || company.vision || company.value || company.description) && (
              <section style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>企業について</h2>
                {company.mission && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 6 }}>ミッション</div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", lineHeight: 1.5, margin: 0 }}>{company.mission}</p>
                  </div>
                )}
                {company.vision && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 6 }}>ビジョン</div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", lineHeight: 1.6, margin: 0 }}>{company.vision}</p>
                  </div>
                )}
                {company.value && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 6 }}>バリュー</div>
                    <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" as const }}>{company.value}</p>
                  </div>
                )}
                {company.description && (
                  <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" as const }}>{company.description}</p>
                )}
              </section>
            )}

            {/* Opinioのまとめ（AI要約） */}
            {company.ai_summary && (
              <section style={{ background: "#f0f9ff", borderRadius: 12, padding: 20, border: "0.5px solid #bae6fd" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0369a1" }}>Opinioのまとめ</span>
                </div>
                <p style={{ fontSize: 14, color: "#0c4a6e", lineHeight: 1.7, margin: 0 }}>{company.ai_summary}</p>
              </section>
            )}

            {/* カード③ 企業情報 (2列, 0.5pxボーダー) */}
            <section style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>企業情報</h2>
              {(() => {
                // Fix 10: 4カードで表示済みの 平均年収・従業員数・リモート率 は除外
                // 表示項目: 業界・所在地・フェーズ・設立・平均残業・平均年齢・公式サイト
                const leftCol: { label: string; value: string; isLink?: boolean; muted: boolean }[] = [
                  { label: "業界", value: company.industry || "—", muted: !company.industry },
                  { label: "所在地", value: company.location || "—", muted: !company.location },
                  { label: "設立", value: company.founded_year ? `${company.founded_year}年` : (company.founded_at || "—"), muted: !company.founded_year && !company.founded_at },
                  { label: "平均残業", value: company.avg_overtime != null ? `月${company.avg_overtime}時間` : "—", muted: company.avg_overtime == null },
                ];
                const rightCol: ({ label: string; value: string; isLink?: boolean; muted: boolean } | null)[] = [
                  { label: "フェーズ", value: company.phase || "—", muted: !company.phase },
                  { label: "平均年齢", value: company.avg_age ? `${company.avg_age}歳` : "—", muted: !company.avg_age },
                  { label: "公式サイト", value: company.url || "—", isLink: !!company.url, muted: !company.url },
                  null,
                ];
                // 固定5行ペア
                const pairedRows = leftCol.map((left, i) => ({ left, right: rightCol[i] }));
                // 追加カラム（値がある場合のみ末尾に追加）
                const extraItems = [
                  company.engineer_ratio ? { label: "エンジニア比率", value: company.engineer_ratio, muted: false } : null,
                  company.ceo_name ? { label: "代表者名", value: company.ceo_name, muted: false } : null,
                  company.funding_stage ? { label: "調達状況", value: company.funding_stage, muted: false } : null,
                  company.arr_scale ? { label: "ARR規模", value: company.arr_scale, muted: false } : null,
                  company.office_count ? { label: "拠点数", value: company.office_count, muted: false } : null,
                ].filter(Boolean) as { label: string; value: string; muted: boolean }[];
                for (let i = 0; i < extraItems.length; i += 2) {
                  pairedRows.push({ left: extraItems[i], right: extraItems[i + 1] || null as any });
                }
                return pairedRows.map((row, ri) => (
                  <div key={ri} style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr",
                    borderBottom: ri < pairedRows.length - 1 ? "0.5px solid #f0f0f0" : "none",
                  }}>
                    <div style={{ padding: "12px 0", borderRight: "0.5px solid #f0f0f0" }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{row.left.label}</div>
                      <div style={{ fontSize: 14, fontWeight: row.left.muted ? 400 : 600, color: row.left.muted ? "#9ca3af" : "#1f2937" }}>
                        {row.left.isLink
                          ? <a href={row.left.value} target="_blank" rel="noopener noreferrer" style={{ color: "#1a6fd4", textDecoration: "none" }}>公式サイト →</a>
                          : row.left.value}
                      </div>
                    </div>
                    {row.right ? (
                      <div style={{ padding: "12px 0", paddingLeft: 20 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{row.right.label}</div>
                        <div style={{ fontSize: 14, fontWeight: row.right.muted ? 400 : 600, color: row.right.muted ? "#9ca3af" : "#1f2937" }}>
                          {row.right.isLink
                            ? <a href={row.right.value} target="_blank" rel="noopener noreferrer" style={{ color: "#1a6fd4", textDecoration: "none" }}>公式サイト →</a>
                            : row.right.value}
                        </div>
                      </div>
                    ) : <div />}
                  </div>
                ));
              })()}
            </section>

            {/* Fix 21: 企業の発信リンク */}
            <CompanyLinks socialLinks={(company as any).social_links} companyName={company.name} />

            {/* Fix 17 + 18 + 20: Action buttons (scout / compare / follow) */}
            <section style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>
                この企業を追う
              </div>
              {/* Fix 11: 求人を見るボタン（求人がある場合のみ） */}
              {jobCount > 0 && (
                <button
                  onClick={() => { setActiveTab("jobs"); tabRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#fff",
                    background: "#1D9E75",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "center",
                    marginBottom: 10,
                  }}
                >
                  求人を見る（{jobCount}件）→
                </button>
              )}
              <CompanyActionButtons
                companyId={company.id}
                companyName={company.name}
                isLoggedIn={!!isLoggedIn}
              />
            </section>

            {/* Fix 19 (revised): 選考プロセスの透明化 */}
            <SelectionProcess data={(company as any).selection_process} />
            <HiringPolicy data={(company as any).hiring_policy} />

            {/* Fix 11: 全幅ボタン完全削除（上部タブと「この企業を追う」カードに集約） */}

            {/* Fix 12: 中盤CTA削除（上部のCTAに集約済み）。matchScoreのみ残す。 */}
            {isLoggedIn && matchScore && (
              <section style={{ border: "2px solid #22c55e", borderRadius: 12, padding: 24, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>あなたとのマッチポイント</span>
                    <span style={{ fontSize: 11, background: "#f0fdf4", color: "#15803d", padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>あなた専用</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: "#059669" }}>{matchScore.overall_score}%</span>
                    <div style={{ width: 80, height: 8, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 999, background: matchScore.overall_score >= 70 ? "#22c55e" : matchScore.overall_score >= 40 ? "#f59e0b" : "#ef4444", width: `${matchScore.overall_score}%` }} />
                    </div>
                  </div>
                </div>
                {matchScore.match_reasons && matchScore.match_reasons.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#15803d", marginBottom: 10 }}>あなたに合っている点</div>
                      {matchScore.match_reasons.slice(0, 3).map((reason: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                          <span style={{ color: "#22c55e", fontWeight: 700, flexShrink: 0, fontSize: 13 }}>✓</span>
                          <span style={{ fontSize: 13, color: "#14532d", lineHeight: 1.5 }}>{reason}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "#fffbeb", borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 10 }}>確認しておきたい点</div>
                      {(matchScore.match_reasons.length > 3 ? matchScore.match_reasons.slice(3, 6) : ["プロフィールを充実させるとより詳細な分析が表示されます"]).map((reason: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                          <span style={{ color: "#f59e0b", fontWeight: 700, flexShrink: 0, fontSize: 13 }}>!</span>
                          <span style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>プロフィールを充実させると精度が上がります</span>
                  <Link href="/career-consultation" style={{ fontSize: 13, color: "#059669", textDecoration: "none", fontWeight: 600 }}>メンターに相談する →</Link>
                </div>
              </section>
            )}

            {/* 採用情報カード */}
            {(company.annual_hire_count || company.mid_career_ratio != null || company.avg_tenure) && (
              <section style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>採用情報</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {company.annual_hire_count && (
                    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 6 }}>年間採用人数</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>{company.annual_hire_count}</div>
                    </div>
                  )}
                  {company.mid_career_ratio != null && (
                    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 6 }}>中途比率</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>{company.mid_career_ratio}%</div>
                    </div>
                  )}
                  {company.avg_tenure && (
                    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 6 }}>平均勤続年数</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>{company.avg_tenure}</div>
                    </div>
                  )}
                </div>
              </section>
            )}

          </div>
        )}

        {/* ══ Jobs Tab ══ */}
        {activeTab === "jobs" && (
          <div>
            {/* 選考についてカード */}
            {(company.avg_selection_weeks || company.selection_flow) && (
              <div className="bg-white rounded-xl p-6 mb-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
                <h3 className="text-[15px] font-bold text-gray-800 mb-4">選考について</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: company.selection_flow?.length ? "16px" : "0" }}>
                  {company.avg_selection_weeks && (
                    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 6 }}>平均選考期間</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>約{company.avg_selection_weeks}週間</div>
                    </div>
                  )}
                  {company.selection_count && (
                    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 6 }}>選考回数</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>{company.selection_count}回</div>
                    </div>
                  )}
                </div>
                {company.selection_flow && company.selection_flow.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 8 }}>選考フロー</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                      {company.selection_flow.map((step: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{
                            fontSize: "12px", background: "#E1F5EE", color: "#0F6E56",
                            padding: "6px 14px", borderRadius: "999px", whiteSpace: "nowrap",
                          }}>
                            {step}
                          </span>
                          {i < company.selection_flow.length - 1 && (
                            <span style={{ fontSize: "14px", color: "#94a3b8" }}>&rarr;</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-gray-800">求人一覧</h2>
              <span className="text-[13px] text-gray-600">{jobCount}件</span>
            </div>
            {jobCount > 0 ? (
              <>
                <div className="space-y-3">
                  {jobs.slice((jobsPage - 1) * 5, jobsPage * 5).map((j: Job) => (
                    <div key={j.id}
                      className="bg-white rounded-xl p-5 transition-all group" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.1)" }}>
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[16px] font-medium text-gray-900 mb-2">{j.title}</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            {j.job_category && <span className="text-[11px] px-2 py-0.5 rounded" style={getJobCategoryStyle(j.job_category)}>{j.job_category}</span>}
                            {j.work_style && <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: "#DBEAFE", color: "#1D4ED8" }}>{j.work_style}</span>}
                            {j.salary_min && j.salary_max && <span className="text-[11px] text-gray-700">{j.salary_min}〜{j.salary_max}万円</span>}
                            {j.location && (
                              <span className="text-[11px] text-gray-700">{j.location}</span>
                            )}
                          </div>
                          {j.created_at && (
                            <span className="text-[10px] text-gray-500 mt-2 block">
                              {new Date(j.created_at).toLocaleDateString("ja-JP")}掲載
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                          <FavoriteJobButton jobId={j.id} initialFavorited={false} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '120px' }}>
                            <div style={{
                              fontSize: '14px', fontWeight: 500,
                              color: matchScore && matchScore.overall_score > 0 ? '#1D9E75' : '#6b7280',
                              border: '0.5px solid #d1d5db', borderRadius: '8px',
                              padding: '9px 0', textAlign: 'center', background: 'white', width: '100%',
                            }}>
                              {matchScore && matchScore.overall_score > 0 ? `マッチ度 ${matchScore.overall_score}%` : 'マッチ度 --'}
                            </div>
                            <Link href={`/jobs/${j.id}`}
                              style={{
                                fontSize: '14px', padding: '9px 0', borderRadius: '8px',
                                background: '#1a6fd4', color: '#fff', textDecoration: 'none',
                                textAlign: 'center', display: 'block', width: '100%',
                              }}>
                              詳細→
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* ページネーション */}
                {Math.ceil(jobCount / 5) > 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 24 }}>
                    <button
                      onClick={() => setJobsPage(p => Math.max(1, p - 1))}
                      disabled={jobsPage === 1}
                      className="text-sm px-2.5 py-1 rounded border border-gray-200 text-gray-500 disabled:opacity-30"
                    >
                      ‹
                    </button>
                    {Array.from({ length: Math.ceil(jobCount / 5) }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setJobsPage(page)}
                        className={`text-sm px-2.5 py-1 rounded border ${jobsPage === page ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500"}`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setJobsPage(p => Math.min(Math.ceil(jobCount / 5), p + 1))}
                      disabled={jobsPage === Math.ceil(jobCount / 5)}
                      className="text-sm px-2.5 py-1 rounded border border-gray-200 text-gray-500 disabled:opacity-30"
                    >
                      ›
                    </button>
                    <span className="text-[12px] text-gray-400 ml-2">
                      {jobsPage} / {Math.ceil(jobCount / 5)}ページ
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl p-12 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
                <div className="text-3xl mb-3">📭</div>
                <p className="text-[13px] text-gray-600">現在募集中の求人はありません</p>
              </div>
            )}
          </div>
        )}

        {/* ══ Members Tab ══ */}
        {activeTab === "members" && (
          <div className="space-y-8">
            {/* 統一ヘッダー (Fix 13) */}
            <div style={{ paddingLeft: 4, marginBottom: -8 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0, marginBottom: 4 }}>この会社の話を聞ける人</h2>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                現役社員・OB/OG・メンターの3種類の情報源から、リアルな実態を知ることができます。
              </p>
            </div>

            {/* セクション1: 現役社員・OB/OG（アイコングリッド＋詳細パネル） */}
            <section style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", borderLeft: "3px solid #059669", paddingLeft: 12, marginBottom: 4 }}>
                  現役社員・OB/OG
                </h3>
                <p style={{ fontSize: 13, color: "#6b7280", paddingLeft: 15 }}>
                  この企業で働いた経験を持つメンバーの声です。
                </p>
              </div>

              {companyMembers.length > 0 ? (() => {
                // 非公開メンバーを除外する共通フィルター
                const isVisibleMember = (m: any): boolean => {
                  // is_public が false なら非表示
                  if (m.is_public === false) return false;
                  // is_anonymous が true / "true" なら非表示
                  if (m.is_anonymous === true || m.is_anonymous === "true") return false;
                  // name が null / undefined / 空文字 / "非公開" / "?" / "？" なら非表示
                  if (!m.name || m.name === "非公開" || m.name === "?" || m.name === "？") return false;
                  return true;
                };
                const publicMembers = companyMembers.filter(isVisibleMember);

                if (publicMembers.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
                        社員・OBの声は順次公開予定です
                      </p>
                      <Link
                        href="/career-consultation"
                        style={{ fontSize: 14, fontWeight: 500, color: "#1D9E75", textDecoration: "none" }}
                      >
                        メンターに直接聞いてみる →
                      </Link>
                    </div>
                  );
                }

                const activeMembers = publicMembers.filter((m: any) => m.status === "current");
                const obMembers = publicMembers.filter((m: any) => m.status === "alumni");

                const filteredActive = activeMembers.filter((m: any) =>
                  activeFilter === "all" || m.position_category_id === activeFilter
                );
                const filteredOb = obMembers.filter((m: any) =>
                  obFilter === "all" || m.position_category_id === obFilter
                );

                const renderPositionTabs = (currentFilter: string, onFilter: (id: string) => void) => {
                  if (positionCategories.length === 0) return null;
                  return (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {[{ id: 'all', name: 'すべて' }, ...positionCategories].map((cat: any) => (
                        <button
                          key={cat.id}
                          onClick={() => onFilter(cat.id)}
                          style={{
                            fontSize: '12px', padding: '5px 14px', borderRadius: '999px',
                            border: '0.5px solid',
                            borderColor: currentFilter === cat.id ? '#1D9E75' : '#d1d5db',
                            background: currentFilter === cat.id ? '#1D9E75' : 'white',
                            color: currentFilter === cat.id ? '#fff' : '#475569',
                            cursor: 'pointer',
                          }}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  );
                };

                const MemberCard = ({ cm }: { cm: any }) => {
                  const [hover, setHover] = useState(false);

                  return (
                    <div
                      style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", cursor: "pointer" }}
                      onMouseEnter={() => setHover(true)}
                      onMouseLeave={() => setHover(false)}
                      onClick={() => { router.push(`/members/${cm.id}`); }}
                    >
                      <div style={{
                        width: "72px", height: "72px", borderRadius: "12px",
                        background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center",
                        border: hover ? "2.5px solid #1D9E75" : "2.5px solid transparent",
                        boxShadow: hover ? "0 6px 20px rgba(0,0,0,0.18)" : "0 3px 10px rgba(0,0,0,0.10)",
                        transform: hover ? "translateY(-2px)" : "translateY(0)",
                        transition: "all 0.2s ease", overflow: "hidden",
                      }}>
                        {cm.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cm.photo_url} alt={cm.name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          /* 統一シルエットアイコン */
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        )}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 500, color: "#0f172a", textAlign: "center" }}>
                        {cm.name}
                      </div>
                      {cm.role && (
                        <div style={{ fontSize: "12px", color: "#64748b", textAlign: "center" }}>
                          {cm.role}
                        </div>
                      )}

                      {/* Hover Tooltip */}
                      {hover && (
                        <div style={{
                          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                          background: "#fff", borderRadius: "10px", padding: "12px 16px",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
                          zIndex: 50, minWidth: "200px", maxWidth: "280px",
                          pointerEvents: "none",
                        }}>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{cm.name}</div>
                          {(cm.department || cm.role) && (
                            <div style={{ fontSize: "12px", color: "#475569", marginBottom: 2 }}>
                              {[cm.department, cm.role].filter(Boolean).join(" / ")}
                            </div>
                          )}
                          {cm.status === "alumni" && cm.joined_year && (
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: 4 }}>
                              {cm.joined_year}年〜{cm.left_year ? `${cm.left_year}年` : "現在"}
                            </div>
                          )}
                          {cm.bio && (
                            <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5, marginTop: 4, borderTop: "0.5px solid #f0f0f0", paddingTop: 6 }}>
                              {cm.bio.length > 60 ? cm.bio.slice(0, 60) + "…" : cm.bio}
                            </div>
                          )}
                          {/* Arrow */}
                          <div style={{
                            position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)",
                            width: 10, height: 10, background: "#fff",
                            boxShadow: "2px 2px 4px rgba(0,0,0,0.05)",
                          }} />
                        </div>
                      )}
                    </div>
                  );
                };

                const renderGrid = (list: any[]) => (
                  <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", marginBottom: "8px" }}>
                    {list.map((cm: any) => (
                      <MemberCard key={cm.id} cm={cm} />
                    ))}
                  </div>
                );

                return (
                  <>
                    {activeMembers.length > 0 && (
                      <>
                        <h4 style={{ fontSize: "13px", color: "#374151", fontWeight: 600, letterSpacing: ".04em", marginBottom: "14px", borderLeft: "3px solid #10b981", paddingLeft: "8px" }}>
                          現役社員
                        </h4>
                        {renderPositionTabs(activeFilter, (id) => setActiveFilter(id))}
                        {renderGrid(filteredActive)}
                      </>
                    )}

                    {activeMembers.length > 0 && obMembers.length > 0 && (
                      <hr style={{ border: "none", borderTop: "0.5px solid #e2e8f0", margin: "20px 0" }} />
                    )}

                    {obMembers.length > 0 && (
                      <>
                        <h4 style={{ fontSize: "13px", color: "#374151", fontWeight: 600, letterSpacing: ".04em", marginBottom: "14px", borderLeft: "3px solid #10b981", paddingLeft: "8px" }}>
                          OB・OG
                        </h4>
                        {renderPositionTabs(obFilter, (id) => setObFilter(id))}
                        {renderGrid(filteredOb)}
                      </>
                    )}
                  </>
                );
              })() : (
                <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
                  <div className="text-sm text-gray-400 mb-1">まだ登録されていません</div>
                  <div className="text-xs text-gray-300 mb-5">
                    この会社で働いた経験をシェアしませんか？
                  </div>
                  {!isLoggedIn && (
                    <Link href="/auth/signup">
                      <button className="bg-gray-900 text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-gray-800 transition-colors">
                        登録してあなたの経験をシェアする
                      </button>
                    </Link>
                  )}
                  {isLoggedIn && !myWorkHistory && (
                    <Link href={`/mypage/work-history/new?company_id=${company.id}`}>
                      <button className="bg-gray-900 text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-gray-800 transition-colors">
                        この会社の職歴を追加する
                      </button>
                    </Link>
                  )}
                  {isLoggedIn && myWorkHistory && (
                    <div className="text-xs text-green-600">
                      あなたの職歴は登録済みです ✓
                    </div>
                  )}
                </div>
              )}

              {/* メンバーが1人以上いる場合も「追加」ボタンを小さく出す */}
              {companyMembers.length > 0 && isLoggedIn && !myWorkHistory && (
                <div className="mt-4 text-center">
                  <Link href={`/mypage/work-history/new?company_id=${company.id}`}>
                    <button className="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:border-gray-300 transition-colors">
                      + この会社の職歴を追加する
                    </button>
                  </Link>
                </div>
              )}
              {companyMembers.length > 0 && !isLoggedIn && (
                <div className="mt-4 text-center">
                  <Link href="/auth/signup">
                    <button className="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:border-gray-300 transition-colors">
                      + 登録してあなたの経験をシェアする
                    </button>
                  </Link>
                </div>
              )}
            </section>

            {/* セクション2: 社内メンバー */}
            {members.length > 0 && (
              <section style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 24, marginBottom: 16 }}>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0f172a",
                    borderLeft: "3px solid #059669",
                    paddingLeft: 12,
                    marginBottom: 16,
                  }}
                >
                  社内メンバー
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {members.map((m) => (
                    <Link
                      key={m.id}
                      href={`/members/${m.id}`}
                      className="flex items-center gap-3"
                      style={{
                        background: "#f9fafb",
                        border: "0.5px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 14,
                        textDecoration: "none",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1a9e75"; e.currentTarget.style.background = "#fff"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb"; }}
                    >
                      <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "#e8e4dc" }}>
                        {m.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          /* 統一シルエットアイコン（人物アイコン） */
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }} className="truncate">{m.name}</p>
                        <p style={{ fontSize: 12, color: "#6b7280" }} className="truncate">{m.role}</p>
                        {m.background && <p style={{ fontSize: 11, color: "#9ca3af" }} className="truncate">前職: {m.background}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* メンター（「この会社の話を聞ける人」のサブセクションとして統合） */}
            <section style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <div style={{ marginBottom: 20 }}>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0f172a",
                    borderLeft: "3px solid #059669",
                    paddingLeft: 12,
                    marginBottom: 4,
                  }}
                >
                  メンター
                </h3>
                <p style={{ fontSize: 13, color: "#6b7280", paddingLeft: 15 }}>
                  実際にこの企業で働いた経験を持つメンターです。
                </p>
              </div>

              {relatedMentors.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {relatedMentors.map((mentor: any) => {
                      const prevInfo = mentor.prev_company
                        ? `元 ${mentor.prev_company}${mentor.prev_role ? ` ${mentor.prev_role}` : ""}`
                        : null;

                      return (
                        <div
                          key={mentor.id}
                          className="flex items-center gap-3"
                          style={{
                            background: "#f9fafb",
                            border: "0.5px solid #e5e7eb",
                            borderRadius: 12,
                            padding: 14,
                          }}
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "#f5f5f5" }}>
                            {mentor.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={mentor.avatar_url} alt={mentor.name || ""} className="w-full h-full object-cover" />
                            ) : (
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }} className="truncate">{mentor.name}</p>
                            <p style={{ fontSize: 12, color: "#6b7280" }} className="truncate">{mentor.role || mentor.company}</p>
                            {prevInfo && (
                              <p style={{ fontSize: 11, color: "#9ca3af" }} className="truncate">{prevInfo}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 14, textAlign: "center" }}>
                    <Link
                      href="/career-consultation"
                      style={{
                        display: "inline-block",
                        padding: "10px 24px",
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#fff",
                        background: "#1D9E75",
                        textDecoration: "none",
                      }}
                    >
                      メンターに相談する →
                    </Link>
                  </div>
                </>
              ) : (
                /* メンターが0人の場合：フォールバックボタン */
                <div
                  className="text-center"
                  style={{
                    background: "#f9fafb",
                    border: "1px dashed #e5e7eb",
                    borderRadius: 12,
                    padding: "32px 20px",
                  }}
                >
                  <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16, lineHeight: 1.7 }}>
                    この企業の経験を持つメンターはまだ登録されていません。<br />
                    近しい領域のメンターから話を聞くことができます。
                  </p>
                  <Link
                    href="/career-consultation"
                    style={{
                      display: "inline-block",
                      padding: "10px 24px",
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      background: "#1D9E75",
                      textDecoration: "none",
                    }}
                  >
                    近しい領域のメンターに相談する →
                  </Link>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ══ Culture Tab ══ */}
        {activeTab === "culture" && !hasCultureData && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 20px" }}>
            <div style={{ fontSize: 40 }}>📊</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>現在データを収集中です</p>
            <p style={{ fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 1.7 }}>
              この企業のカルチャー情報はまだ十分に集まっていません。<br />
              メンターに直接聞くこともできます。
            </p>
            <Link
              href="/career-consultation"
              style={{
                display: "inline-block", padding: "10px 24px", borderRadius: 8,
                fontSize: 14, fontWeight: 600, background: "#10b981", color: "#fff",
                textDecoration: "none", marginTop: 4,
              }}
            >
              メンターに聞いてみる →
            </Link>
          </div>
        )}
        {activeTab === "culture" && hasCultureData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* カルチャー・制度（統合1枚カード・全項目常時表示） */}
            {(() => {
              // boolean値のヘルパー: true→badge, false/null→"—"
              const boolItem = (label: string, val: any) => val === true
                ? { label, value: "あり", badge: true }
                : { label, value: "—", muted: true };

              const allItems: { label: string; value: string; badge?: boolean; muted?: boolean }[] = [
                // ── 働き方 ──
                { label: "有給取得率", value: company.paid_leave_rate != null ? `${company.paid_leave_rate}%` : "—", muted: company.paid_leave_rate == null },
                company.flex_time === true
                  ? { label: "フレックス", value: company.core_time ? `あり（コア ${company.core_time}）` : "あり", badge: true }
                  : { label: "フレックス", value: "—", muted: true },
                company.side_job_ok === true
                  ? { label: "副業OK", value: "OK", badge: true }
                  : { label: "副業OK", value: "—", muted: true },
                { label: "コアタイム", value: company.core_time || "—", muted: !company.core_time },
                { label: "年間休日", value: company.annual_holiday_days ? `${company.annual_holiday_days}日` : "—", muted: !company.annual_holiday_days },
                { label: "週出社頻度", value: company.office_days_per_week || "—", muted: !company.office_days_per_week },
                // ── 報酬・評価 ──
                { label: "賞与回数", value: company.bonus_times != null ? `年${company.bonus_times}回` : "—", muted: company.bonus_times == null },
                { label: "昇給頻度", value: company.salary_raise_frequency || (company.salary_review_times ? `年${company.salary_review_times}回` : "—"), muted: !company.salary_raise_frequency && !company.salary_review_times },
                { label: "評価サイクル", value: company.evaluation_cycle || "—", muted: !company.evaluation_cycle },
                company.has_stock_option === true
                  ? { label: "ストックオプション", value: "あり", badge: true }
                  : { label: "ストックオプション", value: "—", muted: true },
                company.has_incentive === true
                  ? { label: "インセンティブ", value: company.incentive_detail ? `あり（${company.incentive_detail}）` : "あり", badge: true }
                  : { label: "インセンティブ", value: "—", muted: true },
                // ── 成長・育成 ──
                boolItem("書籍補助", company.has_book_allowance),
                boolItem("学習支援", company.has_learning_support),
                boolItem("社内公募", company.has_internal_transfer),
                { label: "平均勤続年数", value: company.avg_tenure_years || company.avg_tenure || "—", muted: !company.avg_tenure_years && !company.avg_tenure },
                { label: "離職率", value: company.turnover_rate || "—", muted: !company.turnover_rate },
                // ── 組織・多様性 ──
                { label: "中途比率", value: company.mid_career_ratio != null ? `${company.mid_career_ratio}%` : "—", muted: company.mid_career_ratio == null },
                { label: "女性比率", value: company.female_ratio || (company.female_manager_ratio != null ? `管理職${company.female_manager_ratio}%` : "—"), muted: !company.female_ratio && company.female_manager_ratio == null },
                { label: "育休取得率", value: company.childcare_leave_rate || ((company.maternity_leave_female != null || company.maternity_leave_male != null) ? [company.maternity_leave_female != null ? `女性${company.maternity_leave_female}%` : null, company.maternity_leave_male != null ? `男性${company.maternity_leave_male}%` : null].filter(Boolean).join(" / ") : "—"), muted: !company.childcare_leave_rate && company.maternity_leave_female == null && company.maternity_leave_male == null },
                boolItem("住宅手当", company.has_housing_allowance),
                boolItem("食事補助", company.has_meal_allowance),
              ];

              // 値がある項目のみ表示
              const visibleItems = allItems.filter((item) => !item.muted);
              const hasTags = cultureCatTags.length > 0 || company.culture_description;
              const hasVisibleData = visibleItems.length > 0 || hasTags;

              // データが何もない場合のフォールバック
              if (!hasVisibleData) {
                return (
                  <section style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>カルチャー・制度</h2>
                    <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.8, marginBottom: 16 }}>
                      カルチャーデータは順次収集中です。<br />
                      現役社員・OBに直接聞いてみましょう。
                    </p>
                    <Link
                      href="/career-consultation"
                      style={{ fontSize: 14, fontWeight: 500, color: "#1D9E75", textDecoration: "none" }}
                    >
                      メンターに無料相談する →
                    </Link>
                  </section>
                );
              }

              return (
                <section style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>カルチャー・制度</h2>

                  {/* カルチャータグ */}
                  {hasTags && (
                    <div style={{ marginBottom: 16 }}>
                      {cultureCatTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {cultureCatTags.map((t) => (
                            <span key={t.id} style={{ fontSize: 12, padding: "3px 12px", borderRadius: 999, fontWeight: 500, background: "#faf5ff", color: "#6b21a8", border: "1px solid #e9d5ff" }}>{t.tag_value}</span>
                          ))}
                        </div>
                      )}
                      {company.culture_description && (
                        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>{company.culture_description}</p>
                      )}
                    </div>
                  )}

                  {/* 値がある項目のみグリッド表示 */}
                  {visibleItems.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "0.5px solid #e5e7eb" }}>
                      {visibleItems.map((item, i) => {
                        const isLastOdd = visibleItems.length % 2 === 1 && i === visibleItems.length - 1;
                        return (
                          <div
                            key={item.label}
                            style={{
                              padding: "12px 0",
                              borderBottom: "0.5px solid #e5e7eb",
                              gridColumn: isLastOdd ? "1 / -1" : undefined,
                              borderRight: !isLastOdd && i % 2 === 0 ? "0.5px solid #e5e7eb" : "none",
                              paddingLeft: !isLastOdd && i % 2 === 1 ? 16 : 0,
                              paddingRight: !isLastOdd && i % 2 === 0 ? 16 : 0,
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{item.label}</div>
                            {item.badge ? (
                              <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#d1fae5", color: "#065f46" }}>{item.value}</span>
                            ) : (
                              <div style={{ fontSize: 14, fontWeight: 500, color: "#0f172a" }}>{item.value}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 評価制度テキスト */}
                  {company.evaluation_system && (
                    <div style={{ marginTop: 16, padding: 14, background: "#f8fafc", borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>評価制度</div>
                      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{company.evaluation_system}</div>
                    </div>
                  )}

                  {/* 意思決定スタイル */}
                  {company.top_down_ratio != null && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>意思決定スタイル</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: "#475569", width: 120 }}>トップダウン</span>
                        <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ width: `${company.top_down_ratio}%`, height: "100%", background: "#1D9E75", borderRadius: 999 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#0f172a", width: 36, textAlign: "right" as const }}>{company.top_down_ratio}%</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "#475569", width: 120 }}>ボトムアップ</span>
                        <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ width: `${100 - company.top_down_ratio}%`, height: "100%", background: "#1D9E75", borderRadius: 999 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#0f172a", width: 36, textAlign: "right" as const }}>{100 - company.top_down_ratio}%</span>
                      </div>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* 4. 入社後レポート */}
            {postHireReports && postHireReports.length > 0 && (
              <section style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>入社後レポート</h2>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{postHireReports.length}件</span>
                </div>

                {/* 平均スコア */}
                {(() => {
                  const reports = postHireReports;
                  const avg = (key: string) => {
                    const vals = reports.map((r: any) => r[key]).filter((v: any) => v != null);
                    return vals.length > 0 ? Math.round(vals.reduce((s: number, v: number) => s + v, 0) / vals.length * 10) / 10 : null;
                  };
                  const scores = [
                    { label: "カルチャー", score: avg("culture_match") },
                    { label: "働き方", score: avg("workstyle_match") },
                    { label: "年収・評価", score: avg("salary_match") },
                    { label: "総合満足度", score: avg("overall_satisfaction") },
                  ].filter(s => s.score !== null);

                  return scores.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${scores.length}, 1fr)`, gap: 12, marginBottom: 16, padding: 12, background: "#f8fafc", borderRadius: 8 }}>
                      {scores.map(item => (
                        <div key={item.label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 18, fontWeight: 600, color: "#1D9E75" }}>{item.score}</div>
                          <div style={{ fontSize: 10, color: "#6b7280" }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* 個別レポート */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {postHireReports.map((r: any) => (
                    <div key={r.id} style={{ borderLeft: "2px solid #1D9E75", paddingLeft: 12, paddingTop: 2, paddingBottom: 2 }}>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>
                        入社{r.months_after}ヶ月後{r.would_recommend != null ? ` · ${r.would_recommend ? "友人に薦める" : "薦めない"}` : ""}
                      </div>
                      {r.good_points && <p style={{ fontSize: 12, color: "#374151", marginBottom: 3, lineHeight: 1.6, margin: 0 }}>&#x2705; {r.good_points}</p>}
                      {r.concerns && <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>&#x26A0;&#xFE0F; {r.concerns}</p>}
                    </div>
                  ))}
                </div>

              </section>
            )}

            {/* 入社後レポートがない場合はセクション自体を非表示 */}
          </div>
        )}

        {/* ══ Articles Tab ══ */}
        {activeTab === "articles" && !hasArticles && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 20px" }}>
            <div style={{ fontSize: 40 }}>📝</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>現在データを収集中です</p>
            <p style={{ fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 1.7 }}>
              この企業に関する記事はまだありません。<br />
              メンターに直接聞くこともできます。
            </p>
            <Link
              href="/career-consultation"
              style={{
                display: "inline-block", padding: "10px 24px", borderRadius: 8,
                fontSize: 14, fontWeight: 600, background: "#10b981", color: "#fff",
                textDecoration: "none", marginTop: 4,
              }}
            >
              メンターに聞いてみる →
            </Link>
          </div>
        )}
        {activeTab === "articles" && hasArticles && (
          <div className="space-y-6">
            <section>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", borderLeft: "3px solid #059669", paddingLeft: 12, marginBottom: 4 }}>
                  記事
                </h3>
                <p style={{ fontSize: 13, color: "#6b7280", paddingLeft: 15 }}>
                  {company.name}に関する記事です。
                </p>
              </div>

              {/* タグフィルター */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {['すべて', 'インタビュー', 'カルチャー', '働き方', '制度紹介'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => setArticleTag(tag)}
                    style={{
                      fontSize: '12px', padding: '5px 14px', borderRadius: '999px',
                      border: '0.5px solid',
                      borderColor: articleTag === tag ? '#1D9E75' : '#d1d5db',
                      background: articleTag === tag ? '#1D9E75' : 'white',
                      color: articleTag === tag ? '#fff' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* 記事一覧 */}
              {(() => {
                const filtered = articleTag === 'すべて'
                  ? companyArticles
                  : companyArticles.filter((a: any) => a.tag === articleTag);

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '14px' }}>
                      まだ記事がありません
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    {filtered.map((article: any) => (
                      <Link
                        key={article.id}
                        href={`/companies/${company.id}/articles/${article.id}`}
                        style={{
                          background: 'white', border: '0.5px solid #e2e8f0',
                          borderRadius: '12px', overflow: 'hidden', textDecoration: 'none',
                          display: 'block',
                        }}
                      >
                        {article.thumbnail_url ? (
                          <img src={article.thumbnail_url} alt="" style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '140px', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#0F6E56' }}>
                            {article.tag || '記事'}
                          </div>
                        )}
                        <div style={{ padding: '16px' }}>
                          {article.tag && (
                            <span style={{
                              display: 'inline-block', fontSize: '11px', padding: '2px 8px',
                              borderRadius: '999px', background: '#E1F5EE', color: '#0F6E56', marginBottom: '8px',
                            }}>
                              {article.tag}
                            </span>
                          )}
                          <div style={{ fontSize: '15px', fontWeight: 500, color: '#0f172a', lineHeight: 1.5, marginBottom: '8px' }}>
                            {article.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {article.author_name && (
                              <>
                                <div style={{
                                  width: '22px', height: '22px', borderRadius: '6px',
                                  background: '#E1F5EE', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontSize: '10px', fontWeight: 500, color: '#0F6E56',
                                }}>
                                  {article.author_name[0]}
                                </div>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                  {article.author_name}
                                </span>
                              </>
                            )}
                            {article.published_at && (
                              <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto' }}>
                                {new Date(article.published_at).toLocaleDateString('ja-JP')}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                );
              })()}
            </section>
          </div>
        )}

        {/* ══ 修正3: Match Tab ══ */}
        {activeTab === "match" && (
          <div>
            {!isLoggedIn ? (
              <div className="bg-white rounded-xl p-12 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-[16px] font-bold text-gray-800 mb-2">マッチ度を確認しよう</h3>
                <p className="text-[13px] text-gray-600 mb-6 max-w-md mx-auto">
                  プロフィールを登録すると、あなたと{company.name}のマッチ度を4つの軸で分析します
                </p>
                <Link href="/auth/signup"
                  className="inline-flex items-center gap-2 text-[13px] font-medium px-6 py-3 rounded-lg text-white"
                  style={{ background: "#1D9E75" }}>
                  無料登録してマッチ度を見る
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ) : !matchScore ? (
              /* 修正3: プロフィール入力誘導UI */
              <div className="text-center py-8 bg-white rounded-xl" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#E1F5EE" }}>
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium mb-1">マッチ度を確認する</p>
                <p className="text-xs text-gray-600 mb-5 leading-relaxed">
                  プロフィールを入力すると、この企業との<br />
                  マッチ度と理由が自動で表示されます
                </p>
                <Link href="/mypage/profile"
                  className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                  style={{ background: "#1D9E75" }}>
                  プロフィールを入力する
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                <section className="bg-white rounded-xl p-8 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
                  <p className="text-[12px] text-gray-600 uppercase tracking-wider mb-2">総合マッチ度</p>
                  <div className="relative inline-flex items-center justify-center mb-4">
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r="60" fill="none" stroke="#f0f0f0" strokeWidth="8" />
                      <circle cx="70" cy="70" r="60" fill="none"
                        stroke={matchScore.overall_score >= 70 ? "#1D9E75" : matchScore.overall_score >= 40 ? "#F59E0B" : "#EF4444"}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${(matchScore.overall_score / 100) * 377} 377`}
                        transform="rotate(-90 70 70)" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[36px] font-bold text-gray-800">{matchScore.overall_score}</span>
                      <span className="text-[12px] text-gray-600 -mt-1">/ 100</span>
                    </div>
                  </div>
                  <p className="text-[13px] text-gray-500">あなたと{company.name}のマッチ度</p>
                </section>

                <section className="bg-white rounded-xl p-6" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
                  <h2 className="text-[15px] font-bold text-gray-800 mb-5">4軸スコア</h2>
                  <div className="space-y-4">
                    <ScoreBar label="カルチャー" score={matchScore.culture_score} />
                    <ScoreBar label="スキル" score={matchScore.skill_score} />
                    <ScoreBar label="キャリア" score={matchScore.career_score} />
                    <ScoreBar label="働き方" score={matchScore.workstyle_score} />
                  </div>
                </section>

                {matchScore.match_reasons && matchScore.match_reasons.length > 0 && (
                  <section className="bg-white rounded-xl p-6" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>
                    <h2 className="text-[15px] font-bold text-gray-800 mb-4">マッチ理由</h2>
                    <div className="space-y-3">
                      {matchScore.match_reasons.map((reason, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#E1F5EE" }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="#0F6E56" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-[13px] text-gray-600 leading-relaxed">{reason}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 採用担当者の顔出し */}
                {company.recruiter_name && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "#fafaf8", borderRadius: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: company.brand_color ?? "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                      {company.recruiter_name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
                        採用担当：{company.recruiter_name}{company.recruiter_role ? `（${company.recruiter_role}）` : ""}
                      </div>
                      {company.recruiter_message && (
                        <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                          &ldquo;{company.recruiter_message}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-center pt-2">
                  <button onClick={handleCasualRequest} disabled={requesting}
                    className="inline-flex items-center gap-2 text-[14px] font-medium px-8 py-3.5 rounded-lg text-white transition-colors disabled:opacity-60"
                    style={{ background: "#1D9E75" }}
                    onMouseEnter={(e) => { if (!requesting) e.currentTarget.style.background = "#0F6E56"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#1D9E75"; }}>
                    話を聞きに行く
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
                    カジュアルに30分話すだけ。選考には影響しません。
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </>
  );
}
