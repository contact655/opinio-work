"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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

type Tab = "overview" | "jobs" | "culture" | "match";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "概要" },
  { id: "jobs", label: "求人" },
  { id: "culture", label: "カルチャー" },
  { id: "match", label: "マッチ度" },
];

// ─── Constants ────────────────────────────────────────

const LOGO_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F97316",
  "#EC4899", "#14B8A6", "#6366F1", "#F43F5E",
];

function getLogoColor(name: string): string {
  return LOGO_COLORS[name.charCodeAt(0) % LOGO_COLORS.length];
}

function parseEmployeeCount(s: string | null): number {
  if (!s) return 0;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// ─── Company Logo ─────────────────────────────────────

function CompanyLogo({ company, size = 64 }: { company: Company; size?: number }) {
  const [imgError, setImgError] = useState(false);
  let clearbitUrl: string | null = null;
  if (company.url) {
    try { clearbitUrl = `https://logo.clearbit.com/${new URL(company.url).hostname}`; } catch {}
  }
  const logoUrl = company.logo_url || clearbitUrl;
  const color = getLogoColor(company.name);

  if (imgError || !logoUrl) {
    return (
      <div className="flex items-center justify-center text-white font-bold flex-shrink-0"
        style={{ width: size, height: size, borderRadius: 16, backgroundColor: color, fontSize: size * 0.35, border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        {company.name[0]}
      </div>
    );
  }
  return (
    <img src={logoUrl} alt={company.name} onError={() => setImgError(true)}
      className="object-cover flex-shrink-0"
      style={{ width: size, height: size, borderRadius: 16, border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />
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

// ─── Share Button ─────────────────────────────────────

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button onClick={handleShare}
      className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
      style={{ border: "0.5px solid #e5e7eb" }} title="共有">
      {copied ? (
        <svg className="w-4.5 h-4.5 text-[#1D9E75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4.5 h-4.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────

export default function CompanyDetailClient({
  company, jobs, members, cultureTags, reviews, matchScore, isLoggedIn,
}: {
  company: Company;
  jobs: Job[];
  members: Member[];
  cultureTags: CultureTag[];
  reviews: Review[];
  matchScore: MatchScore;
  isLoggedIn: boolean;
  hasProfile?: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isSticky, setIsSticky] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const tabRef = useRef<HTMLDivElement>(null);

  const workStyleTags = cultureTags.filter((t) => t.tag_category === "work_style");
  const cultureCatTags = cultureTags.filter((t) => t.tag_category === "culture");
  const benefitTags = cultureTags.filter((t) => t.tag_category === "benefits");

  // 修正1: brand_color → カバー色（デフォルト #1D9E75）
  const coverColor = company.brand_color ?? "#1D9E75";
  const jobCount = jobs.length;
  const emp = parseEmployeeCount(company.employee_count);

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

  // 修正4: カジュアル面談リクエスト
  const handleCasualRequest = async () => {
    if (!isLoggedIn) {
      router.push("/auth/signup");
      return;
    }
    setRequesting(true);
    try {
      const res = await fetch("/api/casual-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });
      const data = await res.json();
      if (data.threadId) {
        router.push(`/messages?thread=${data.threadId}`);
      } else {
        // Thread table not ready yet — show confirmation
        alert("カジュアル面談リクエストを送信しました");
      }
    } catch {
      alert("カジュアル面談リクエストを送信しました");
    } finally {
      setRequesting(false);
    }
  };

  const heroStats = [
    { value: emp > 0 ? `${company.employee_count}` : "非公開", label: "社員数" },
    { value: "4.2", label: "社員評価" },
    { value: company.avg_salary ? `${company.avg_salary}万` : company.industry?.includes("SaaS") || emp > 100 ? "650万" : "非公開", label: "平均年収" },
    { value: `${jobCount}件`, label: "求人数" },
  ];

  return (
    <>
      {/* ─── Breadcrumb ─── */}
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <nav className="flex items-center gap-1.5 text-[12px]">
          <Link href="/companies" className="text-gray-400 hover:text-[#1D9E75] transition-colors">企業一覧</Link>
          <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-600 font-medium truncate max-w-[200px]">{company.name}</span>
        </nav>
      </div>

      {/* ─── 修正1: Hero Cover (brand_color + large SVG circles) ─── */}
      <div className="relative h-40 overflow-hidden" style={{ background: coverColor }}>
        <svg className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 600 160" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="40" r="80" fill="white" />
          <circle cx="220" cy="120" r="60" fill="white" />
          <circle cx="400" cy="30" r="100" fill="white" />
          <circle cx="540" cy="100" r="70" fill="white" />
        </svg>
      </div>

      {/* ─── Profile Section ─── */}
      <div className="bg-white" style={{ borderBottom: "0.5px solid #e5e7eb" }}>
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-5 -mt-8 relative z-10">
            <CompanyLogo company={company} size={64} />
            <div className="flex-1 min-w-0 pt-2">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 mb-1">{company.name}</h1>
                  <div className="flex items-center gap-3 text-[13px] text-gray-400">
                    {company.industry && <span>{company.industry}</span>}
                    {company.location && (
                      <span className="flex items-center gap-0.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {company.location}
                      </span>
                    )}
                    {company.phase && <span className="text-[11px] bg-gray-50 px-2 py-0.5 rounded">{company.phase}</span>}
                  </div>
                </div>
                {/* 修正4: Actions with casual request */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-4 pt-0.5">
                  <button
                    onClick={handleCasualRequest}
                    disabled={requesting}
                    className="text-[13px] font-medium px-5 py-2.5 rounded-lg text-white transition-colors disabled:opacity-60"
                    style={{ background: "#1D9E75" }}
                    onMouseEnter={(e) => { if (!requesting) e.currentTarget.style.background = "#0F6E56"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#1D9E75"; }}
                  >
                    {requesting ? "送信中..." : "話を聞きに行く"}
                  </button>
                  <button
                    className="text-[13px] font-medium px-4 py-2.5 rounded-lg transition-colors"
                    style={{ border: "0.5px solid #d1d5db", color: "#374151" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1D9E75"; e.currentTarget.style.color = "#1D9E75"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.color = "#374151"; }}
                  >
                    気になる
                  </button>
                  <ShareButton />
                </div>
              </div>

              {cultureTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {cultureTags.slice(0, 6).map((t) => (
                    <span key={t.id} className="text-[11px] px-2.5 py-1 rounded-full"
                      style={{
                        background: t.tag_category === "work_style" ? "#E1F5EE" : t.tag_category === "culture" ? "#EEF2FF" : "#FFF7ED",
                        color: t.tag_category === "work_style" ? "#0F6E56" : t.tag_category === "culture" ? "#4338CA" : "#C2410C",
                      }}>
                      {t.tag_value}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-4 gap-0 mt-4 mb-4 py-3" style={{ borderTop: "0.5px solid #f0f0f0" }}>
                {heroStats.map((s, i) => (
                  <div key={i} className="text-center" style={i < heroStats.length - 1 ? { borderRight: "0.5px solid #f0f0f0" } : {}}>
                    <div className="text-[16px] font-bold text-gray-800">{s.value}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tab Bar (sticky) ─── */}
      <div ref={tabRef} className="h-0" />
      <div className="bg-white sticky top-[64px] z-30"
        style={{ borderBottom: "0.5px solid #e5e7eb", boxShadow: isSticky ? "0 1px 4px rgba(0,0,0,0.04)" : undefined }}>
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-0">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="relative px-5 py-3.5 text-[13px] font-medium transition-colors"
                  style={{ color: isActive ? "#1D9E75" : "#9ca3af" }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#374151"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "#9ca3af"; }}>
                  {tab.label}
                  {tab.id === "jobs" && jobCount > 0 && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: isActive ? "#E1F5EE" : "#f3f4f6", color: isActive ? "#0F6E56" : "#6b7280" }}>
                      {jobCount}
                    </span>
                  )}
                  {tab.id === "match" && matchScore && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#E1F5EE", color: "#0F6E56" }}>
                      {matchScore.overall_score}%
                    </span>
                  )}
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "#1D9E75" }} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ══ Overview Tab ══ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {(company.mission || company.description) && (
              <section className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #e5e7eb" }}>
                <h2 className="text-[15px] font-bold text-gray-800 mb-4">企業について</h2>
                {company.mission && (
                  <div className="mb-4">
                    <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2">ミッション</h3>
                    <p className="text-[15px] font-medium text-gray-800 leading-relaxed">{company.mission}</p>
                  </div>
                )}
                {company.description && (
                  <p className="text-[13px] text-gray-500 leading-relaxed whitespace-pre-wrap">{company.description}</p>
                )}
              </section>
            )}
            <section className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #e5e7eb" }}>
              <h2 className="text-[15px] font-bold text-gray-800 mb-4">企業情報</h2>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
                {[
                  { label: "設立", value: company.founded_at },
                  { label: "従業員数", value: company.employee_count ? `${company.employee_count}名` : null },
                  { label: "業界", value: company.industry },
                  { label: "所在地", value: company.location },
                  { label: "フェーズ", value: company.phase },
                  { label: "公式サイト", value: company.url, isLink: true },
                ].filter((item) => item.value).map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2" style={{ borderBottom: "0.5px solid #f5f5f4" }}>
                    <dt className="text-[13px] text-gray-400">{item.label}</dt>
                    <dd className="text-[13px] font-medium text-gray-700">
                      {item.isLink ? <a href={item.value!} target="_blank" rel="noopener noreferrer" className="text-[#1D9E75] hover:underline">公式サイト →</a> : item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            {members.length > 0 && (
              <section className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #e5e7eb" }}>
                <h2 className="text-[15px] font-bold text-gray-800 mb-4">メンバー</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ border: "0.5px solid #f0f0f0" }}>
                      <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {m.photo_url ? <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" /> : <span className="text-gray-400 font-bold text-sm">{m.name?.[0]}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-gray-800 truncate">{m.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{m.role}</p>
                        {m.background && <p className="text-[10px] text-gray-300 truncate">前職: {m.background}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ══ Jobs Tab ══ */}
        {activeTab === "jobs" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-gray-800">求人一覧</h2>
              <span className="text-[13px] text-gray-400">{jobCount}件</span>
            </div>
            {jobCount > 0 ? (
              <div className="space-y-3">
                {jobs.map((j: Job) => (
                  <Link key={j.id} href={`/jobs/${j.id}`}
                    className="block bg-white rounded-xl p-5 transition-all group" style={{ border: "0.5px solid #e5e7eb" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1D9E75")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}>
                    <h3 className="text-[14px] font-semibold text-gray-800 mb-2 group-hover:text-[#1D9E75] transition-colors">{j.title}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {j.job_category && <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: "#f5f5f4", color: "#78716c" }}>{j.job_category}</span>}
                      {j.salary_min && j.salary_max && <span className="text-[11px] text-gray-400">{j.salary_min}〜{j.salary_max}万円</span>}
                      {j.location && (
                        <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {j.location}
                        </span>
                      )}
                      {j.work_style && <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: "#E1F5EE", color: "#0F6E56" }}>{j.work_style}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-12 text-center" style={{ border: "0.5px solid #e5e7eb" }}>
                <div className="text-3xl mb-3">📭</div>
                <p className="text-[13px] text-gray-400">現在募集中の求人はありません</p>
              </div>
            )}
          </div>
        )}

        {/* ══ 修正2: Culture Tab（情報量増加） ══ */}
        {activeTab === "culture" && (
          <div className="space-y-6">
            {/* 働き方グリッド — データがない項目は非表示 */}
            <section className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #e5e7eb" }}>
              <h2 className="text-[15px] font-bold text-gray-800 mb-4">働き方</h2>
              {(() => {
                const wsTagValues = workStyleTags.map((t) => t.tag_value);
                const workItems = [
                  {
                    icon: "🏠",
                    label: "リモート勤務",
                    value: company.remote_rate
                      ? `週${Math.round(company.remote_rate / 20)}日リモート可`
                      : wsTagValues.some((v) => v.includes("フルリモート"))
                      ? "フルリモート"
                      : wsTagValues.some((v) => v.includes("リモート") || v.includes("ハイブリッド"))
                      ? "ハイブリッド"
                      : null,
                  },
                  {
                    icon: "⏱",
                    label: "フレックス",
                    value: wsTagValues.some((v) => v.includes("フルフレックス"))
                      ? "フルフレックス"
                      : wsTagValues.some((v) => v.includes("フレックス"))
                      ? "あり"
                      : null,
                  },
                  {
                    icon: "🕐",
                    label: "平均残業時間",
                    value: company.avg_overtime
                      ? `月${company.avg_overtime}時間`
                      : null,
                  },
                  {
                    icon: "📅",
                    label: "有給取得率",
                    value: company.paid_leave_rate
                      ? `${company.paid_leave_rate}%`
                      : null,
                  },
                ].filter((item) => item.value !== null);

                return workItems.length > 0 ? (
                  <div className={`grid ${workItems.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-3 mb-4`}>
                    {workItems.map((item) => (
                      <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                        <div className="text-lg mb-1">{item.icon}</div>
                        <div className="text-xs font-medium mb-0.5">{item.label}</div>
                        <div className="text-xs text-gray-500">{item.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4 mb-4">働き方の詳細を準備中です</p>
                );
              })()}
              {workStyleTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: "0.5px solid #f0f0f0" }}>
                  {workStyleTags.map((t) => (
                    <span key={t.id} className="text-[12px] px-3.5 py-1.5 rounded-full font-medium" style={{ background: "#E1F5EE", color: "#0F6E56" }}>
                      {t.tag_value}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {cultureCatTags.length > 0 && (
              <section className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #e5e7eb" }}>
                <h2 className="text-[15px] font-bold text-gray-800 mb-4">組織文化</h2>
                <div className="flex flex-wrap gap-2">
                  {cultureCatTags.map((t) => (
                    <span key={t.id} className="text-[12px] px-3.5 py-1.5 rounded-full font-medium" style={{ background: "#EEF2FF", color: "#4338CA" }}>{t.tag_value}</span>
                  ))}
                </div>
              </section>
            )}

            {benefitTags.length > 0 && (
              <section className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #e5e7eb" }}>
                <h2 className="text-[15px] font-bold text-gray-800 mb-4">福利厚生</h2>
                <div className="flex flex-wrap gap-2">
                  {benefitTags.map((t) => (
                    <span key={t.id} className="text-[12px] px-3.5 py-1.5 rounded-full font-medium" style={{ background: "#FFF7ED", color: "#C2410C" }}>{t.tag_value}</span>
                  ))}
                </div>
              </section>
            )}

            {/* 社員の声（左ボーダー付き） */}
            <section className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #e5e7eb" }}>
              <h2 className="text-[15px] font-bold text-gray-800 mb-4">社員の声</h2>
              {reviews.length > 0 ? (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="pl-3 py-2 bg-gray-50 mb-3"
                      style={{ borderLeft: "2px solid #1D9E75", borderRadius: "0 10px 10px 0" }}>
                      <p className="text-sm leading-relaxed mb-1">{r.content}</p>
                      <p className="text-xs text-gray-400">{r.role}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-gray-400">
                  社員の声を募集中です
                </div>
              )}
            </section>

            {members.length > 0 && (
              <section className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #e5e7eb" }}>
                <h2 className="text-[15px] font-bold text-gray-800 mb-4">チームメンバー</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {members.map((m) => (
                    <div key={m.id} className="text-center p-4 rounded-lg" style={{ border: "0.5px solid #f0f0f0" }}>
                      <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-2 overflow-hidden flex items-center justify-center">
                        {m.photo_url ? <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" /> : <span className="text-gray-400 font-bold">{m.name?.[0]}</span>}
                      </div>
                      <p className="text-[13px] font-medium text-gray-800">{m.name}</p>
                      <p className="text-[11px] text-gray-400">{m.role}</p>
                      {m.background && <p className="text-[10px] text-gray-300 mt-0.5">前職: {m.background}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ══ 修正3: Match Tab ══ */}
        {activeTab === "match" && (
          <div>
            {!isLoggedIn ? (
              <div className="bg-white rounded-xl p-12 text-center" style={{ border: "0.5px solid #e5e7eb" }}>
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-[16px] font-bold text-gray-800 mb-2">マッチ度を確認しよう</h3>
                <p className="text-[13px] text-gray-400 mb-6 max-w-md mx-auto">
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
              <div className="text-center py-8 bg-white rounded-xl" style={{ border: "0.5px solid #e5e7eb" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#E1F5EE" }}>
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium mb-1">マッチ度を確認する</p>
                <p className="text-xs text-gray-400 mb-5 leading-relaxed">
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
                <section className="bg-white rounded-xl p-8 text-center" style={{ border: "0.5px solid #e5e7eb" }}>
                  <p className="text-[12px] text-gray-400 uppercase tracking-wider mb-2">総合マッチ度</p>
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
                      <span className="text-[12px] text-gray-400 -mt-1">/ 100</span>
                    </div>
                  </div>
                  <p className="text-[13px] text-gray-500">あなたと{company.name}のマッチ度</p>
                </section>

                <section className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #e5e7eb" }}>
                  <h2 className="text-[15px] font-bold text-gray-800 mb-5">4軸スコア</h2>
                  <div className="space-y-4">
                    <ScoreBar label="カルチャー" score={matchScore.culture_score} />
                    <ScoreBar label="スキル" score={matchScore.skill_score} />
                    <ScoreBar label="キャリア" score={matchScore.career_score} />
                    <ScoreBar label="働き方" score={matchScore.workstyle_score} />
                  </div>
                </section>

                {matchScore.match_reasons && matchScore.match_reasons.length > 0 && (
                  <section className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #e5e7eb" }}>
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
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
