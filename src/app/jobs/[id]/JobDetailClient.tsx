"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatSalaryRange } from "@/lib/utils/formatSalary";
import { getMatchReason } from "@/lib/utils/matchReason";

// ─── Types ───────────────────────────────────────────
type Props = {
  job: any;
  company: any;
  matchScore: any;
  isFavorited: boolean;
  isLoggedIn: boolean;
  mustReqs: any[];
  wantReqs: any[];
  similarJobs: any[];
};

// ─── Helpers ─────────────────────────────────────────

function getLogoUrl(company: any): string | null {
  if (!company) return null;
  if (company.logo_url) return company.logo_url;
  if (company.url) {
    try {
      return `https://logo.clearbit.com/${new URL(company.url).hostname}`;
    } catch {}
  }
  return null;
}

function getEmployeeDisplay(company: any): string {
  const v = company?.employees_jp || company?.employee_count;
  if (!v) return "非公開";
  if (/^\d+$/.test(v)) return `${Number(v).toLocaleString()}名`;
  return v;
}

// ─── Logo Component ──────────────────────────────────

function CompanyLogo({
  company,
  size = 52,
  bgOpacity = false,
}: {
  company: any;
  size?: number;
  bgOpacity?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = getLogoUrl(company);
  const brandColor = company?.brand_color ?? "#1D9E75";

  if (imgError || !logoUrl) {
    return (
      <div
        className="flex items-center justify-center font-bold text-white flex-shrink-0"
        style={{
          width: size,
          height: size,
          borderRadius: 14,
          backgroundColor: bgOpacity ? `${brandColor}26` : brandColor,
          color: bgOpacity ? brandColor : "#fff",
          fontSize: size * 0.35,
        }}
      >
        {company?.name?.[0] ?? "?"}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: bgOpacity ? `${brandColor}26` : "#f5f5f4",
      }}
    >
      <img
        src={logoUrl}
        alt={company?.name}
        onError={() => setImgError(true)}
        className="object-contain"
        style={{ width: size * 0.7, height: size * 0.7 }}
      />
    </div>
  );
}

// ─── Score Bar ────────────────────────────────────────

function MatchBar({ score }: { score: number }) {
  return (
    <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${score}%`,
          background:
            score >= 70 ? "#1D9E75" : score >= 40 ? "#F59E0B" : "#EF4444",
        }}
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────

export default function JobDetailClient({
  job,
  company,
  matchScore,
  isFavorited: initialFavorited,
  isLoggedIn,
  mustReqs,
  wantReqs,
  similarJobs,
}: Props) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [favLoading, setFavLoading] = useState(false);

  const brandColor = company?.brand_color ?? "#1D9E75";
  const salaryDisplay = formatSalaryRange(job.salary_min, job.salary_max);
  const score = matchScore?.overall_score ?? null;
  const matchReason =
    matchScore?.match_reasons?.[0] ?? getMatchReason(job, score ?? 70);

  // 選考フロー
  const selectionSteps: string[] =
    job.selection_flow && job.selection_flow.length > 0
      ? job.selection_flow
      : job.selection_process && Array.isArray(job.selection_process)
      ? job.selection_process.map((s: any) =>
          typeof s === "string" ? s : s.name
        )
      : ["書類選考", "カジュアル面談", "一次面接", "最終面接"];

  // タグ一覧
  const tags = [
    job.job_category,
    job.work_style,
    job.employment_type,
    job.location,
  ].filter(Boolean);

  // 勤務条件グリッド
  const conditionItems = [
    {
      label: "年収",
      value: salaryDisplay !== "応相談" ? salaryDisplay : null,
    },
    { label: "雇用形態", value: job.employment_type },
    { label: "勤務地", value: job.location },
    { label: "勤務スタイル", value: job.work_style },
    { label: "勤務時間", value: job.work_hours },
    {
      label: "平均残業",
      value: job.avg_overtime
        ? job.avg_overtime.includes("時間")
          ? job.avg_overtime
          : `月${job.avg_overtime}時間`
        : null,
    },
    { label: "試用期間", value: job.trial_period },
    { label: "休日", value: job.holidays },
    { label: "諸手当", value: job.benefits },
  ].filter((item) => item.value);

  // ─── Favorite Toggle ────────────────────────────────
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (favLoading) return;

    if (!isLoggedIn) {
      router.push("/auth/signup");
      return;
    }

    setFavLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (favorited) {
      await supabase
        .from("ow_job_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("job_id", job.id);
    } else {
      await supabase
        .from("ow_job_favorites")
        .insert({ user_id: user.id, job_id: job.id });
    }
    setFavorited(!favorited);
    setFavLoading(false);
  };

  // ─── Apply / Casual ─────────────────────────────────
  const handleApply = () => {
    if (!isLoggedIn) {
      router.push("/auth/signup");
      return;
    }
    // TODO: implement application flow
    alert("応募機能は準備中です");
  };

  const handleCasual = async () => {
    if (!isLoggedIn) {
      router.push("/auth/signup");
      return;
    }
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !company) return;

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

      const { data: thread } = await supabase
        .from("ow_threads")
        .insert({
          company_id: company.id,
          candidate_id: user.id,
          status: "casual_requested",
        })
        .select()
        .single();

      if (thread) {
        await supabase.from("ow_messages").insert({
          thread_id: thread.id,
          sender_id: user.id,
          content: `${company.name}へのカジュアル面談リクエストが送信されました`,
        });
        router.push(`/messages?thread=${thread.id}`);
      } else {
        alert("カジュアル面談リクエストを送信しました");
      }
    } catch {
      alert("カジュアル面談リクエストを送信しました");
    }
  };

  return (
    <>
      {/* ─── Breadcrumb ─── */}
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <nav className="flex items-center gap-1.5 text-[12px]">
          <Link
            href="/jobs"
            className="text-gray-400 hover:text-[#1D9E75] transition-colors"
          >
            求人一覧
          </Link>
          <svg
            className="w-3 h-3 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-gray-600 font-medium truncate max-w-[300px]">
            {job.title}
          </span>
        </nav>
      </div>

      {/* ─── 2-Column Layout ─── */}
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex gap-6 items-start">
          {/* ═══ Left Column ═══ */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* ─── Hero Card ─── */}
            <div
              className="bg-white rounded-xl overflow-hidden"
              style={{ border: "0.5px solid #e5e7eb" }}
            >
              {/* Brand color cover */}
              <div style={{ height: 8, background: brandColor }} />

              <div className="p-6 relative">
                {/* Favorite button (top-right) */}
                <button
                  onClick={toggleFavorite}
                  disabled={favLoading}
                  className="absolute top-5 right-5 flex items-center justify-center w-9 h-9 rounded-full transition-all"
                  style={{
                    background: favorited ? "#FCEBEB" : "transparent",
                    border: `0.5px solid ${favorited ? "#F09595" : "#e5e7eb"}`,
                    cursor: "pointer",
                  }}
                  title={favorited ? "気になるを解除" : "気になる"}
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="15"
                    height="15"
                    fill={favorited ? "#E24B4A" : "none"}
                    stroke={favorited ? "#E24B4A" : "#9ca3af"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 13.5S2 9.5 2 5.5C2 3.5 3.5 2 5.5 2c1 0 2 .5 2.5 1.5C8.5 2.5 9.5 2 10.5 2 12.5 2 14 3.5 14 5.5c0 4-6 8-6 8z" />
                  </svg>
                </button>

                {/* Company logo + name */}
                <div className="flex items-center gap-3 mb-3">
                  <CompanyLogo company={company} size={52} bgOpacity />
                  <div>
                    {company && (
                      <Link
                        href={`/companies/${company.id}`}
                        className="text-[13px] text-gray-500 hover:text-[#1D9E75] transition-colors"
                      >
                        {company.name}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Job title */}
                <h1
                  className="mb-4 text-gray-900 leading-snug"
                  style={{ fontSize: 22, fontWeight: 500 }}
                >
                  {job.title}
                </h1>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2.5 py-1 rounded-full"
                        style={{
                          background: i === 0 ? "#E1F5EE" : "#f5f5f4",
                          color: i === 0 ? "#0F6E56" : "#78716c",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Match banner */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "#E1F5EE" }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 text-center">
                      <div
                        className="font-bold"
                        style={{ fontSize: 28, color: "#1D9E75" }}
                      >
                        {score !== null ? `${score}%` : "—"}
                      </div>
                      <div
                        className="text-[10px] font-medium"
                        style={{ color: "#0F6E56" }}
                      >
                        マッチ度
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[12px] leading-relaxed mb-2"
                        style={{ color: "#0F6E56" }}
                      >
                        {score !== null
                          ? matchReason
                          : isLoggedIn
                          ? "プロフィールを入力するとマッチ度が表示されます"
                          : "会員登録してマッチ度を確認しましょう"}
                      </p>
                      {score !== null && <MatchBar score={score} />}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── 仕事内容 ─── */}
            <div
              className="bg-white rounded-xl p-6"
              style={{ border: "0.5px solid #e5e7eb" }}
            >
              <h2 className="text-[15px] font-bold text-gray-800 mb-4">
                仕事内容
              </h2>
              {job.description ? (
                <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {job.description}
                </p>
              ) : (
                <p className="text-[13px] text-gray-400 text-center py-6">
                  準備中
                </p>
              )}
            </div>

            {/* ─── 求める人材 ─── */}
            {(job.requirements ||
              job.preferred ||
              mustReqs.length > 0 ||
              wantReqs.length > 0) && (
              <div
                className="bg-white rounded-xl p-6"
                style={{ border: "0.5px solid #e5e7eb" }}
              >
                <h2 className="text-[15px] font-bold text-gray-800 mb-4">
                  求める人材
                </h2>

                {/* Text-based requirements */}
                {job.requirements && (
                  <div className="mb-5">
                    <h3 className="text-[12px] font-semibold mb-2 flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 text-[10px] rounded"
                        style={{ background: "#FEE2E2", color: "#DC2626" }}
                      >
                        必須
                      </span>
                    </h3>
                    <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {job.requirements}
                    </p>
                  </div>
                )}
                {job.preferred && (
                  <div className="mb-5">
                    <h3 className="text-[12px] font-semibold mb-2 flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 text-[10px] rounded"
                        style={{ background: "#DBEAFE", color: "#2563EB" }}
                      >
                        歓迎
                      </span>
                    </h3>
                    <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {job.preferred}
                    </p>
                  </div>
                )}

                {/* List-based requirements (ow_job_requirements) */}
                {mustReqs.length > 0 && !job.requirements && (
                  <div className="mb-5">
                    <h3 className="text-[12px] font-semibold mb-2 flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 text-[10px] rounded"
                        style={{ background: "#FEE2E2", color: "#DC2626" }}
                      >
                        必須
                      </span>
                    </h3>
                    <ul className="space-y-1.5">
                      {mustReqs.map((r: any) => (
                        <li
                          key={r.id}
                          className="flex items-start gap-2 text-[13px] text-gray-600"
                        >
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                          {r.content}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {wantReqs.length > 0 && !job.preferred && (
                  <div>
                    <h3 className="text-[12px] font-semibold mb-2 flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 text-[10px] rounded"
                        style={{ background: "#DBEAFE", color: "#2563EB" }}
                      >
                        歓迎
                      </span>
                    </h3>
                    <ul className="space-y-1.5">
                      {wantReqs.map((r: any) => (
                        <li
                          key={r.id}
                          className="flex items-start gap-2 text-[13px] text-gray-600"
                        >
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                          {r.content}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ─── 勤務条件 ─── */}
            {conditionItems.length > 0 && (
              <div
                className="bg-white rounded-xl p-6"
                style={{ border: "0.5px solid #e5e7eb" }}
              >
                <h2 className="text-[15px] font-bold text-gray-800 mb-4">
                  勤務条件
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px 24px",
                  }}
                >
                  {conditionItems.map((item) => (
                    <div key={item.label}>
                      <div
                        style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}
                      >
                        {item.label}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── 選考フロー ─── */}
            <div
              className="bg-white rounded-xl p-6"
              style={{ border: "0.5px solid #e5e7eb" }}
            >
              <h2 className="text-[15px] font-bold text-gray-800 mb-4">
                選考フロー
              </h2>
              <div className="space-y-0">
                {selectionSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                        style={{ background: "#1D9E75" }}
                      >
                        {i + 1}
                      </div>
                      {i < selectionSteps.length - 1 && (
                        <div
                          className="w-[1.5px] flex-1 min-h-[24px]"
                          style={{ background: "#d1d5db" }}
                        />
                      )}
                    </div>
                    <div className="pb-5">
                      <p className="text-[13px] font-medium text-gray-700 pt-1">
                        {step}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ Right Column (Sidebar) ═══ */}
          <aside
            className="hidden lg:block flex-shrink-0"
            style={{ width: 320 }}
          >
            <div className="sticky top-[80px] space-y-5">
              {/* ─── 応募カード ─── */}
              <div
                className="bg-white rounded-xl p-5"
                style={{ border: "0.5px solid #e5e7eb" }}
              >
                {/* Salary */}
                <div className="mb-4 text-center">
                  <div
                    style={{ fontSize: 22, fontWeight: 700, color: "#1D9E75" }}
                  >
                    {salaryDisplay}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">年収</div>
                </div>

                {/* CTA Buttons */}
                <button
                  onClick={handleApply}
                  className="w-full py-3 rounded-lg text-[13px] font-medium text-white transition-colors mb-2"
                  style={{ background: "#1D9E75" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#0F6E56")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#1D9E75")
                  }
                >
                  この求人に応募する
                </button>
                <button
                  onClick={handleCasual}
                  className="w-full py-3 rounded-lg text-[13px] font-medium transition-colors"
                  style={{
                    border: "1px solid #1D9E75",
                    color: "#1D9E75",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#E1F5EE";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  カジュアル面談を申し込む
                </button>

                {/* Note */}
                <p className="text-[11px] text-gray-400 text-center mt-3 mb-4">
                  応募後3営業日以内にご連絡いたします
                </p>

                {/* Divider */}
                <div
                  style={{
                    height: "0.5px",
                    background: "#e5e7eb",
                    margin: "0 -4px 12px",
                  }}
                />

                {/* Info list */}
                <div className="space-y-2.5">
                  {[
                    {
                      label: "掲載日",
                      value: job.created_at
                        ? new Date(job.created_at).toLocaleDateString("ja-JP")
                        : null,
                    },
                    { label: "職種", value: job.job_category },
                    { label: "勤務形態", value: job.work_style },
                    { label: "雇用形態", value: job.employment_type },
                  ]
                    .filter((item) => item.value)
                    .map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[11px] text-gray-400">
                          {item.label}
                        </span>
                        <span className="text-[12px] font-medium text-gray-700">
                          {item.value}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* ─── 企業カード ─── */}
              {company && (
                <div
                  className="bg-white rounded-xl p-5"
                  style={{ border: "0.5px solid #e5e7eb" }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <CompanyLogo company={company} size={40} bgOpacity />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 truncate">
                        {company.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        {company.industry && <span>{company.industry}</span>}
                        {company.phase && (
                          <span
                            className="px-1.5 py-0.5 rounded"
                            style={{ background: "#f5f5f4" }}
                          >
                            {company.phase}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div
                    className="grid grid-cols-3 gap-0 py-3 mb-4"
                    style={{
                      borderTop: "0.5px solid #f0f0f0",
                      borderBottom: "0.5px solid #f0f0f0",
                    }}
                  >
                    {[
                      { value: getEmployeeDisplay(company), label: "社員数" },
                      {
                        value: company.funding_total
                          ? company.funding_total
                          : company.founded_year
                          ? `${company.founded_year}年`
                          : "—",
                        label: company.funding_total ? "調達額" : "設立",
                      },
                      { value: "4.2", label: "社員評価" },
                    ].map((s, i) => (
                      <div key={i} className="text-center">
                        <div className="text-[14px] font-bold text-gray-800">
                          {s.value}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Link
                    href={`/companies/${company.id}`}
                    className="block text-center text-[12px] font-medium transition-colors"
                    style={{ color: "#1D9E75" }}
                  >
                    企業詳細を見る →
                  </Link>
                </div>
              )}

              {/* ─── 関連求人カード ─── */}
              {similarJobs.length > 0 && (
                <div
                  className="bg-white rounded-xl p-5"
                  style={{ border: "0.5px solid #e5e7eb" }}
                >
                  <h3 className="text-[13px] font-bold text-gray-800 mb-3">
                    関連求人
                  </h3>
                  <div className="space-y-3">
                    {similarJobs.map((sj: any) => {
                      const sjCompany = sj.ow_companies as any;
                      const sjSalary = formatSalaryRange(
                        sj.salary_min,
                        sj.salary_max
                      );
                      return (
                        <Link
                          key={sj.id}
                          href={`/jobs/${sj.id}`}
                          className="block p-3 rounded-lg transition-all"
                          style={{ border: "0.5px solid #f0f0f0" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.borderColor = "#1D9E75")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.borderColor = "#f0f0f0")
                          }
                        >
                          <div className="flex items-start gap-2.5">
                            {sjCompany && (
                              <CompanyLogo
                                company={sjCompany}
                                size={32}
                                bgOpacity
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-medium text-gray-800 truncate mb-0.5">
                                {sj.title}
                              </p>
                              <p className="text-[11px] text-gray-400 truncate">
                                {sjCompany?.name}
                              </p>
                              <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[11px] text-gray-500">
                                  {sjSalary}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
