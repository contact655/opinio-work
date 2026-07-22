"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { Job } from "@/app/jobs/mockJobData";
import { showToast } from "@/lib/toast";
import type { CompanyReviewSummary } from "@/lib/supabase/queries";
import type { RecommendedJob } from "@/lib/matching/scoreJob";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { createClient } from "@/lib/supabase/client";
import { getVisibleRoles } from "@/lib/constants/jobTypes";
import { BUSINESS_MODELS, getBusinessModelLabel } from "@/lib/constants/businessModels";
import { TECH_STACK_CATEGORIES } from "@/lib/techStack";
import { isSalesJob, getSalesSegmentLabel } from "@/lib/constants/salesFields";
const SALARY_PILL_TIERS = [
  { value: "400",  label: "400万〜" },
  { value: "500",  label: "500万〜" },
  { value: "600",  label: "600万〜" },
  { value: "700",  label: "700万〜" },
  { value: "800",  label: "800万〜" },
  { value: "1000", label: "1000万〜" },
  { value: "1200", label: "1200万〜" },
  { value: "1500", label: "1500万〜" },
] as const;
import type { Company } from "@/app/companies/mockCompanies";
import { extractPrefecture, PREFECTURES } from "@/lib/utils/location";

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// freshLabel is now only used as fallback; badge rendering is inline
function freshBadge(days: number): { label: string; bg: string; color: string; border: string } | null {
  if (days === 0) return { label: "🔥 今日", bg: "#FEE2E2", color: "#DC2626", border: "#FECACA" };
  if (days <= 3) return { label: "NEW", bg: "var(--success)", color: "#fff", border: "transparent" };
  if (days <= 7) return { label: "今週", bg: "var(--royal-50)", color: "var(--royal)", border: "var(--royal-100)" };
  return null;
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return "給与非公開";
  if (min && max) return `${min}〜${max}万円`;
  if (max) return `〜${max}万円`;
  return `${min}万円〜`;
}
function hasSalaryData(min: number | null, max: number | null): boolean {
  return !!(min || max);
}


// ⑧ 相対時間表示
// ③ フェーズバッジ
const PHASE_BADGE_MAP: Record<string, { bg: string; color: string; label: string }> = {
  "Pre-seed":      { bg: "#F1F5F9", color: "#475569", label: "プレシード" },
  "Seed":          { bg: "#FEF3C7", color: "#92400E", label: "シード" },
  "Series A":      { bg: "#D1FAE5", color: "#065F46", label: "シリーズA" },
  "Series B":      { bg: "#DBEAFE", color: "#1E40AF", label: "シリーズB" },
  "Series C":      { bg: "#EDE9FE", color: "#5B21B6", label: "シリーズC" },
  "Series D":      { bg: "#FEE2E2", color: "#991B1B", label: "シリーズD+" },
  "Series E":      { bg: "#FEE2E2", color: "#991B1B", label: "シリーズD+" },
  "東証グロース":  { bg: "#D1FAE5", color: "#065F46", label: "グロース上場" },
  "東証プライム":  { bg: "#ECFDF5", color: "#065F46", label: "プライム上場" },
  "上場 (NASDAQ)": { bg: "#ECFDF5", color: "#065F46", label: "NASDAQ上場" },
  "上場 (NYSE)":   { bg: "#ECFDF5", color: "#065F46", label: "NYSE上場" },
  "上場":          { bg: "#ECFDF5", color: "#065F46", label: "上場" },
  "シード":        { bg: "#FEF3C7", color: "#92400E", label: "シード" },
  "シリーズA":     { bg: "#D1FAE5", color: "#065F46", label: "シリーズA" },
  "シリーズB":     { bg: "#DBEAFE", color: "#1E40AF", label: "シリーズB" },
  "シリーズC":     { bg: "#EDE9FE", color: "#5B21B6", label: "シリーズC" },
  "シリーズD以降": { bg: "#FEE2E2", color: "#991B1B", label: "シリーズD+" },
  "IPO準備中":     { bg: "#FFEDD5", color: "#9A3412", label: "IPO準備中" },
  "ユニコーン":    { bg: "#F3E8FF", color: "#7C3AED", label: "🦄 ユニコーン" },
  "unicorn":       { bg: "#F3E8FF", color: "#7C3AED", label: "🦄 ユニコーン" },
  "listed":        { bg: "#ECFDF5", color: "#065F46", label: "上場" },
};
function getPhaseBadge(phase: string | null | undefined) {
  if (!phase) return null;
  return PHASE_BADGE_MAP[phase] ?? { bg: "#F1F5F9", color: "#475569", label: phase };
}

// ow_profiles.job_type → ow_roles.name のマッピング（パーソナライズ用）
const JOB_TYPE_TO_ROLE_NAME: Record<string, string> = {
  "フィールドセールス":    "営業",
  "SDR":                  "営業",
  "BDR":                  "営業",
  "インサイドセールス":    "営業",
  "カスタマーサクセス":    "カスタマーサクセス",
  "カスタマーサポート":    "カスタマーサクセス",
  "マーケティング":        "マーケティング",
  "プロダクトマーケティング": "マーケティング",
  "バックエンド":          "エンジニア",
  "フロントエンド":        "エンジニア",
  "フルスタック":          "エンジニア",
  "SRE/インフラ":          "エンジニア",
  "iOS/Android":           "エンジニア",
  "エンジニア":            "エンジニア",
  "データサイエンティスト": "エンジニア",
  "プロダクトマネージャー": "プロダクト",
  "デザイナー":            "デザイナー",
  "コーポレート":          "コーポレート",
  "HR・人事":              "コーポレート",
  "財務・経理":            "コーポレート",
  "経営・CxO":             "事業開発",
  "事業開発":              "事業開発",
  "事業開発・BizDev":      "事業開発",
};

// ─── Dept color map ───────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "エンジニア":         { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  "デザイン":           { bg: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  "PdM / PM":           { bg: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  "プロダクト":         { bg: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  "営業":               { bg: "#ECFDF5", color: "#15803D", border: "#A7F3D0" },
  "カスタマーサクセス": { bg: "#ECFDF5", color: "#15803D", border: "#A7F3D0" },
  "マーケティング":     { bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  "事業開発":           { bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  "BizDev":             { bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  "コーポレート":       { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
  "経理":               { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
  "法務":               { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
  "人事":               { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
  "経営":               { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
};

function getDeptStyle(dept: string) {
  for (const [key, style] of Object.entries(DEPT_COLORS)) {
    if (dept.includes(key)) return style;
  }
  return { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" };
}


// ─── Role color map for colorStyle chips ─────────────────────────────────────

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  "エンジニア":         { color: "#1D4ED8", bg: "#EFF6FF" },
  "デザイン":           { color: "#7C3AED", bg: "#F5F3FF" },
  "プロダクト":         { color: "#7C3AED", bg: "#F5F3FF" },
  "PdM / PM":           { color: "#7C3AED", bg: "#F5F3FF" },
  "営業":               { color: "var(--success)", bg: "#ECFDF5" },
  "カスタマーサクセス": { color: "var(--success)", bg: "#ECFDF5" },
  "マーケティング":     { color: "#B45309", bg: "#FEF3C7" },
  "コーポレート":       { color: "#16A34A", bg: "#F0FDF4" },
  "経営":               { color: "#DC2626", bg: "#FEF2F2" },
};

function getRoleColor(name: string): { color: string; bg: string } {
  for (const [key, style] of Object.entries(ROLE_COLORS)) {
    if (name.includes(key)) return style;
  }
  return { color: "var(--royal)", bg: "var(--royal-50)" };
}



// ─── スキルタグ抽出・色分け ───────────────────────────────────────────────────────

// ビジネス系キーワード（アンバー）
// ── スキルタグ 3カテゴリ色分け ──────────────────────────────────────────────────
// 言語・英語スキル系 → green
const LANG_KW = ["英語", "ネイティブ", "TOEIC", "TOEFL", "中国語", "韓国語", "ビジネスレベル"];
// 技術系キーワード → blue
const TECH_KW = ["TypeScript","JavaScript","Python","Golang","Ruby","Java","Rust","Swift","Kotlin","PHP","Scala","React","Vue","Angular","Next","Rails","Django","FastAPI","Spring","AWS","GCP","Azure","Docker","Kubernetes","Terraform","Linux","SQL","MySQL","PostgreSQL","MongoDB","Redis","BigQuery","Snowflake","Figma","Sketch","機械学習","自然言語処理","MLOps","LLM","Node"];
// ビジネス系 → amber
const BIZ_KW = ["SaaS","B2B","BtoB","CRM","ERP","Salesforce","HubSpot","B2C","DX","SFA","営業経験","法人","エンタープライズ"];

function skillChipStyle(skill: string, isTechStack: boolean): React.CSSProperties {
  // 言語系: green
  if (LANG_KW.some(k => skill.includes(k))) {
    return { fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0", whiteSpace: "nowrap" as const };
  }
  // 技術系: blue
  if (isTechStack || TECH_KW.some(k => skill.toLowerCase().includes(k.toLowerCase()))) {
    return { fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", whiteSpace: "nowrap" as const };
  }
  // ビジネス系: amber
  if (BIZ_KW.some(k => skill.includes(k))) {
    return { fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A", whiteSpace: "nowrap" as const };
  }
  // その他: gray
  return { fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "var(--bg-tint)", color: "var(--ink-soft)", border: "1px solid var(--line)", whiteSpace: "nowrap" as const };
}

const TECH_KEYWORD_RE = new RegExp(
  [
    "TypeScript", "JavaScript", "Python", "Go(?:lang)?", "Ruby", "Java(?!Script)", "Rust",
    "Swift", "Kotlin", "PHP", "C\\+\\+", "C#", "Scala", "R言語",
    "React", "Vue", "Angular", "Next\\.js", "Nuxt", "Rails", "Django", "FastAPI", "Spring",
    "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "Linux",
    "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "BigQuery", "Snowflake",
    "SaaS", "B2B", "BtoB", "CRM", "ERP", "Salesforce", "HubSpot",
    "Figma", "Sketch", "機械学習", "自然言語処理", "MLOps", "LLM",
    "Ruby on Rails", "Node\\.js",
  ].join("|"),
  "gi",
);

function extractSkillChips(required_skills: string[], tech_stack: string[]): string[] {
  if (tech_stack.length > 0) return tech_stack.slice(0, 3);
  const chips: string[] = [];
  const seen = new Set<string>();
  for (const req of required_skills) {
    if (chips.length >= 3) break;
    const trimmed = req.trim();
    if (trimmed.length <= 14 && trimmed.length >= 2) {
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) { seen.add(key); chips.push(trimmed); }
    } else {
      // 長い要件文から技術キーワードを抽出
      const matches = trimmed.match(TECH_KEYWORD_RE) ?? [];
      for (const m of matches) {
        if (chips.length >= 3) break;
        const key = m.toLowerCase();
        if (!seen.has(key)) { seen.add(key); chips.push(m); }
      }
    }
  }
  return chips;
}

// ─── マッチ理由テキスト（フィルター文脈ベース）────────────────────────────────

function computeMatchReason(
  job: Job,
  filters: { category: string; dept: string; salary: string; prefecture: string; q: string },
  parentRoles: { id: string; name: string }[],
): string | null {
  const { category, dept, salary: _salary, prefecture, q } = filters;
  // 職種カテゴリフィルター
  if (category) {
    const roleName = parentRoles.find((r) => r.id === category)?.name;
    if (roleName) return `「${roleName}」職種での絞り込み結果`;
  }
  // 旧 dept フィルター
  if (!category && dept && (job.dept?.includes(dept) || dept.includes(job.dept ?? ""))) {
    return `「${dept}」職種での絞り込み結果`;
  }
  // 年収フィルター — ラベル非表示
  // 勤務地フィルター
  if (prefecture && job.location?.includes(prefecture)) {
    return `${prefecture}勤務の求人`;
  }
  // キーワード検索
  if (q.trim().length >= 1) return `「${q.trim()}」の検索結果`;
  return null;
}

// ─── LinkedIn 型縦リスト行 ────────────────────────────────────────────────────

function JobListItem({
  job, companyMap, initialBookmarked = false, isApplied = false,
  reviewSummary, matchReason: _matchReason,
  showMeetingCta: _showMeetingCta = true,
}: {
  job: Job;
  companyMap: Map<string, Company>;
  initialBookmarked?: boolean;
  isApplied?: boolean;
  reviewSummary?: CompanyReviewSummary;
  matchReason?: string | null;
  showMeetingCta?: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkAnim, setBookmarkAnim] = useState(false);
  const bookmarkingRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!bookmarkingRef.current) setBookmarked(initialBookmarked);
  }, [initialBookmarked]);

  const company = companyMap.get(job.company_id);

  const handleBookmark = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmarkingRef.current) return;
    bookmarkingRef.current = true;
    const next = !bookmarked;
    setBookmarked(next);
    setBookmarkAnim(true);
    setTimeout(() => setBookmarkAnim(false), 400);
    try {
      const res = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "job", target_id: job.id }),
      });
      if (res.status === 401) {
        setBookmarked(!next);
        router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      } else if (!res.ok) {
        setBookmarked(!next);
      } else {
        if (next) showToast(`${job.role} を気になりリストに追加しました`, "warm");
        else showToast("気になりリストから削除しました");
      }
    } catch {
      setBookmarked(!next);
    } finally {
      bookmarkingRef.current = false;
    }
  }, [bookmarked, job.id, job.role, router]);

  if (!company) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phaseBadge = getPhaseBadge((company as any).funding_stage ?? (company as any).phase);
  return (
    <div
      className="job-list-card"
      style={{
        borderRadius: 10,
        border: "1.5px solid var(--line)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        overflow: "hidden",
        transition: "border-color 0.15s, box-shadow 0.15s",
        display: "flex",
        background: "#fff",
      }}
    >
      <Link
        href={`/jobs/${job.slug ?? job.id}`}
        prefetch
        className="job-list-item-link"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 16px",
          flex: 1,
          minWidth: 0,
          minHeight: 80,
          background: "transparent",
          textDecoration: "none",
          transition: "background 0.15s",
        }}
      >
        {/* ── 左端: 企業ロゴ ── */}
        <div style={{ flexShrink: 0, padding: company.logo_url ? 3 : 0, background: company.logo_url ? "#fff" : "transparent", borderRadius: 13, boxShadow: company.logo_url ? "0 1px 5px rgba(0,0,0,0.10)" : "none", border: company.logo_url ? "1px solid var(--line)" : "none" }}>
          <CompanyLogo
            name={company.name}
            logoUrl={company.logo_url}
            logoLetter={company.logo_letter}
            logoGradient={company.gradient}
            companyUrl={company.url}
            size={54}
            borderRadius={10}
            style={{ boxShadow: company.logo_url ? "none" : "0 2px 6px rgba(0,0,0,0.12)" }}
          />
        </div>

        {/* ── 中央: テキスト情報 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* マッチ理由（フィルター文脈 / 先輩在籍 など） */}

          {/* 行1: 求人タイトル + 面談受付中バッジ */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span className="job-title-clamp" style={{
              fontSize: 17, fontWeight: 800, color: "var(--ink)",
              lineHeight: 1.4, letterSpacing: "-0.025em",
              maxWidth: "calc(100% - 110px)",
            }}>
              {job.role}
            </span>
          </div>

          {/* 行2: 会社名のみ */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span
              role="link" tabIndex={0}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${company.slug ?? company.id}`); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${company.slug ?? company.id}`); } }}
              className="company-name-link"
              style={{ fontSize: 14, color: "var(--royal)", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(company as any).brand_name ?? company.name}
            </span>
            {isApplied && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", flexShrink: 0 }}>
                ✓ 応募済み
              </span>
            )}
          </div>

          {/* キャッチコピー1行 — LinkedIn の job summary 相当 */}
          {job.highlight && (
            <div style={{
              fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5,
              marginBottom: 5,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {job.highlight}
            </div>
          )}

          {/* 行3: ①フェーズ ②職種 ③スキルチップ */}
          {(() => {
            const techTags = job.tech_stack ?? [];
            const chips = extractSkillChips(job.required_skills, techTags);
            const isTechStack = techTags.length > 0;
            const hasRow = phaseBadge || job.dept || chips.length > 0;
            if (!hasRow) return null;
            return (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5, alignItems: "center" }}>
                {/* ① フェーズバッジ（ユニコーン等） */}
                {phaseBadge && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 100,
                    background: phaseBadge.bg, color: phaseBadge.color,
                    border: `1px solid ${phaseBadge.color}40`, flexShrink: 0,
                  }}>
                    {phaseBadge.label}
                  </span>
                )}
                {/* ③ スキルチップ */}
                {chips.map((skill) => (
                  <span key={skill} style={skillChipStyle(skill, isTechStack)}>
                    {skill}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* 行4: 勤務地 · 勤務形態 · 年収 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {job.location && (
              <span style={{ fontSize: 11, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 2 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {job.location.split("・")[0].replace(/[（(][^）)]*[）)]/g, "").trim()}
              </span>
            )}
            {job.work_style && job.location && (
              <span style={{ fontSize: 10, color: "var(--line)", userSelect: "none" }}>·</span>
            )}
            {job.work_style && (
              <span style={{
                fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 3,
                color: job.work_style.includes("リモート") || job.work_style.includes("フルリモート") ? "var(--success)" : "var(--ink-soft)",
              }}>
                {job.work_style.includes("リモート") || job.work_style.includes("フルリモート") ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                ) : job.work_style.includes("ハイブリッド") ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                )}
                {job.work_style}
              </span>
            )}
            {hasSalaryData(job.salary_min, job.salary_max) && (
              <span style={{ fontSize: 10, color: "var(--line)", userSelect: "none" }}>·</span>
            )}
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700,
              color: hasSalaryData(job.salary_min, job.salary_max) ? "var(--success)" : "var(--ink-mute)",
            }}>
              {formatSalary(job.salary_min, job.salary_max)}
            </span>
            {reviewSummary && reviewSummary.count >= 1 && (
              <>
                <span style={{ fontSize: 10, color: "var(--line)", userSelect: "none" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "#B45309", fontWeight: 600 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  {reviewSummary.avg.toFixed(1)}
                  <span style={{ color: "var(--ink-mute)", fontWeight: 400 }}>({reviewSummary.count}件)</span>
                </span>
              </>
            )}
          </div>
        </div>

      </Link>

      {/* ── 右端: アクションパネル ── */}
      <div style={{
        flexShrink: 0,
        width: 104,
        borderLeft: "1px solid var(--line-soft)",
        background: "var(--bg-tint)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        gap: 5,
        padding: "12px 8px",
      }}>
        {/* 詳細を見る */}
        <a
          href={`/jobs/${job.slug ?? job.id}`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
            padding: "8px 6px", borderRadius: 7,
            backgroundColor: "#002366", color: "#fff",
            fontSize: 11, fontWeight: 700, textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          詳細を見る
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </a>

        {/* 面談をする（求人がある＝面談受付中） */}
        <a
          href={`/companies/${company.slug ?? company.id}/casual-meeting`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
            padding: "8px 6px", borderRadius: 7,
            backgroundColor: "#FFF7ED", color: "#C2410C",
            border: "1.5px solid #FDBA74",
            fontSize: 11, fontWeight: 700, textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          面談をする
        </a>

        {/* 保存をする */}
        <button
          type="button"
          onClick={handleBookmark}
          aria-label={bookmarked ? "ブックマーク解除" : "保存する"}
          aria-pressed={bookmarked}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
            padding: "8px 6px", borderRadius: 7,
            backgroundColor: bookmarked ? "#FEF2F2" : "#fff",
            color: bookmarked ? "#e24b4a" : "#475569",
            border: `1.5px solid ${bookmarked ? "#FECACA" : "#E2E8F0"}`,
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            whiteSpace: "nowrap",
            transform: bookmarkAnim ? "scale(1.05)" : "scale(1)",
            transition: "all 0.2s",
          }}
        >
          <Heart size={11} strokeWidth={2} style={{ color: bookmarked ? "#e24b4a" : "#F87171", fill: bookmarked ? "#e24b4a" : "none", flexShrink: 0 }} />
          {bookmarked ? "保存済み" : "保存する"}
        </button>
      </div>
    </div>
  );
}


// ─── Desktop Sidebar Filters ──────────────────────────────────────────────────

const SALARY_STEPS = [0, 400, 500, 600, 700, 800, 1000, 1200, 1500, 2000];

function SalaryRangeSlider({ salary, salaryMax, setParam }: { salary: string; salaryMax: string; setParam: (k: string, v: string) => void }) {
  const urlMin = salary ? Math.max(0, SALARY_STEPS.indexOf(parseInt(salary, 10))) : 0;
  const urlMax = salaryMax ? Math.max(1, SALARY_STEPS.indexOf(parseInt(salaryMax, 10))) : SALARY_STEPS.length - 1;
  const [localMin, setLocalMin] = useState(urlMin < 0 ? 0 : urlMin);
  const [localMax, setLocalMax] = useState(urlMax < 0 ? SALARY_STEPS.length - 1 : Math.max(1, urlMax));

  // Sync from URL (e.g. reset)
  useEffect(() => {
    setLocalMin(urlMin < 0 ? 0 : urlMin);
    setLocalMax(urlMax < 0 ? SALARY_STEPS.length - 1 : Math.max(1, urlMax));
  }, [urlMin, urlMax]);

  const pctMin = (localMin / (SALARY_STEPS.length - 1)) * 100;
  const pctMax = (localMax / (SALARY_STEPS.length - 1)) * 100;

  function commitMin(idx: number) {
    setParam("salary", idx === 0 ? "" : String(SALARY_STEPS[idx]));
  }
  function commitMax(idx: number) {
    setParam("salary_max", idx === SALARY_STEPS.length - 1 ? "" : String(SALARY_STEPS[idx]));
  }

  return (
    <div>
      <style>{`
        .salary-slider { position:absolute; width:100%; height:4px; appearance:none; -webkit-appearance:none; background:transparent; pointer-events:none; top:50%; transform:translateY(-50%); }
        .salary-slider::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#fff; border:2px solid var(--royal); box-shadow:0 1px 4px rgba(0,36,102,0.18); cursor:pointer; pointer-events:all; }
        .salary-slider::-moz-range-thumb { width:18px; height:18px; border-radius:50%; background:#fff; border:2px solid var(--royal); box-shadow:0 1px 4px rgba(0,36,102,0.18); cursor:pointer; pointer-events:all; }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: localMin > 0 ? "var(--royal)" : "var(--ink-mute)" }}>
          {localMin === 0 ? "下限なし" : `${SALARY_STEPS[localMin]}万〜`}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>〜</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: localMax < SALARY_STEPS.length - 1 ? "var(--royal)" : "var(--ink-mute)" }}>
          {localMax === SALARY_STEPS.length - 1 ? "上限なし" : `〜${SALARY_STEPS[localMax]}万`}
        </span>
      </div>
      <div style={{ position: "relative", height: 28, marginBottom: 6 }}>
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", width: "100%", height: 4, borderRadius: 2, background: "var(--line)" }} />
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: `${pctMin}%`, width: `${pctMax - pctMin}%`, height: 4, borderRadius: 2, background: "var(--royal)" }} />
        {/* Min thumb — update local state on drag, commit on release */}
        <input type="range" className="salary-slider" min={0} max={SALARY_STEPS.length - 1} value={localMin}
          onChange={(e) => {
            const idx = parseInt(e.target.value, 10);
            if (idx < localMax) setLocalMin(idx);
          }}
          onMouseUp={() => commitMin(localMin)}
          onTouchEnd={() => commitMin(localMin)}
        />
        {/* Max thumb */}
        <input type="range" className="salary-slider" min={0} max={SALARY_STEPS.length - 1} value={localMax}
          onChange={(e) => {
            const idx = parseInt(e.target.value, 10);
            if (idx > localMin) setLocalMax(idx);
          }}
          onMouseUp={() => commitMax(localMax)}
          onTouchEnd={() => commitMax(localMax)}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--ink-mute)" }}>
        {SALARY_STEPS.filter((_, i) => i % 2 === 0).map((v) => (
          <span key={v}>{v === 0 ? "なし" : v === 2000 ? "2000+" : `${v}`}</span>
        ))}
      </div>
    </div>
  );
}

function SidebarFilters({
  parentRoles, category, workStyle, salary, salaryMax, empType, prefecture, bizModel: _bizModel,
  companyStage, onCompanyStageChange: _onCompanyStageChange, techStack: _techStack, onTechStackChange: _onTechStackChange,
  availablePrefectures, setParam, hasFilter, q, onReset,
  industries: _industries, industryId: _industryId, roleCounts,
  toggleParam: toggleParamFn, toggleStage,
}: {
  parentRoles: { id: string; name: string }[];
  category: string; workStyle: string; salary: string; salaryMax: string; empType: string; prefecture: string;
  bizModel: string;
  companyStage: string; onCompanyStageChange: (v: string) => void;
  techStack: string[]; onTechStackChange: (v: string[]) => void;
  availablePrefectures: string[];
  setParam: (key: string, value: string) => void;
  hasFilter: boolean; q: string; onReset: () => void;
  industries: { id: string; parent_id: string | null; name: string; slug: string }[];
  industryId: string;
  roleCounts?: Map<string, number>;
  toggleParam: (key: string, value: string, current: string) => void;
  toggleStage: (value: string) => void;
}) {
  // ③ アコーディオン: デフォルトで年収以外は折りたたむ（年収はデフォルト展開）
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["empType", "prefecture"]));
  const categorySet = useMemo(() => new Set(category ? category.split(",") : []), [category]);
  const workStyleSet = useMemo(() => new Set(workStyle ? workStyle.split(",") : []), [workStyle]);
  const empTypeSet = useMemo(() => new Set(empType ? empType.split(",") : []), [empType]);
  const companyStageSet = useMemo(() => new Set(companyStage ? companyStage.split(",") : []), [companyStage]);
  function toggleSection(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ③ アコーディオンセクションヘッダー共通
  function SectionHeader({ label, sectionKey, hasActive }: { label: string; sectionKey: string; hasActive?: boolean }) {
    const isOpen = !collapsed.has(sectionKey);
    return (
      <button type="button" onClick={() => toggleSection(sectionKey)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: hasActive ? "var(--royal)" : "var(--ink-mute)", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 5 }}>
          {hasActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />}
          {label}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--line)", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
      {/* Header — リセットボタンのみ（有効フィルターがある場合） */}
      {(hasFilter || q) && (
        <div style={{ padding: "7px 12px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onReset} style={{ fontSize: 11, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline" }}>
            リセット
          </button>
        </div>
      )}

      {/* 職種 — 常時展開（ヘッダーなし）*/}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        {(() => {
          const { business, tech } = getVisibleRoles(parentRoles);
          const renderRoleBtn = (role: { id: string; name: string }) => {
            const isActive = categorySet.has(role.id);
            const rc = getRoleColor(role.name);
            return (
              <button key={role.id} type="button" onClick={() => toggleParamFn("category", role.id, category)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${isActive ? rc.color : "transparent"}`, background: isActive ? rc.bg : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.1s", width: "100%" }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: rc.color, flexShrink: 0, opacity: isActive ? 1 : 0.5 }} />
                <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? rc.color : "var(--ink)", flex: 1 }}>{role.name}</span>
                {roleCounts?.get(role.id) ? <span style={{ fontSize: 10, color: isActive ? rc.color : "var(--ink-mute)", opacity: 0.8, flexShrink: 0 }}>({roleCounts.get(role.id)})</span> : null}
                {isActive && <svg style={{ flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={rc.color} strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            );
          };
          return (
            <div style={{ padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
              {business.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "2px 2px 3px" }}>
                  <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.05em" }}>ビジネス職</span>
                  <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                </div>
              )}
              {business.map(renderRoleBtn)}
              {tech.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "5px 2px 3px" }}>
                    <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.05em" }}>技術職</span>
                    <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                  </div>
                  {tech.map(renderRoleBtn)}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* 年収 — デュアルスライダー */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="年収" sectionKey="salary" hasActive={!!salary || !!salaryMax} />
        {!collapsed.has("salary") && (
          <div style={{ padding: "0 14px 12px" }}>
            <SalaryRangeSlider salary={salary} salaryMax={salaryMax} setParam={setParam} />
          </div>
        )}
      </div>

      {/* 勤務形態 — アコーディオン（デフォルト展開）*/}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="勤務形態" sectionKey="workStyle" hasActive={!!workStyle} />
        {!collapsed.has("workStyle") && (
          <div style={{ padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
            {[{ value: "フルリモート", label: "🏠 フルリモート" }, { value: "ハイブリッド", label: "🔀 ハイブリッド" }, { value: "出社", label: "🏢 出社" }].map((opt) => {
              const isActive = workStyleSet.has(opt.value);
              return (
                <button key={opt.value} type="button" onClick={() => toggleParamFn("work_style", opt.value, workStyle)}
                  style={{ padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${isActive ? "var(--success)" : "transparent"}`, background: isActive ? "var(--success-soft)" : "transparent", color: isActive ? "var(--success)" : "var(--ink)", fontSize: 13, fontWeight: isActive ? 700 : 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.1s" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  {isActive ? "✓ " : ""}{opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 企業ステージ（複数選択対応） */}
      <div style={{ borderBottom: "1px solid var(--line-soft)", padding: "10px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: companyStageSet.size > 0 ? "var(--royal)" : "var(--ink-mute)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 5 }}>
          {companyStageSet.size > 0 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />}
          企業ステージ
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {([
            { key: "listed",  label: "上場",           color: "var(--success)",  bg: "var(--success-soft)" },
            { key: "unicorn", label: "🦄 ユニコーン",  color: "var(--purple)",   bg: "var(--purple-soft)" },
            { key: "startup", label: "スタートアップ", color: "var(--royal)",    bg: "var(--royal-50)" },
            { key: "foreign", label: "🌏 外資系",      color: "#1D4ED8",         bg: "#EFF6FF" },
          ] as { key: string; label: string; color: string; bg: string }[]).map(({ key, label, color, bg }) => {
            const active = companyStageSet.has(key);
            return (
              <button key={key} type="button" onClick={() => toggleStage(key)}
                style={{ padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: active ? 700 : 500, border: `1.5px solid ${active ? color : "var(--line)"}`, background: active ? bg : "#fff", color: active ? color : "var(--ink-soft)", cursor: "pointer", transition: "all 0.15s" }}
              >
                {active ? "✓ " : ""}{label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 雇用形態（企業ステージの下・複数選択対応） */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="雇用形態" sectionKey="empType" hasActive={empTypeSet.size > 0} />
        {!collapsed.has("empType") && (
          <div style={{ padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
            {[{ value: "正社員", label: "正社員" }, { value: "業務委託", label: "業務委託" }, { value: "副業", label: "副業・複業" }].map((opt) => {
              const isActive = empTypeSet.has(opt.value);
              return (
                <button key={opt.value} type="button" onClick={() => toggleParamFn("emp_type", opt.value, empType)}
                  style={{ padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${isActive ? "var(--royal)" : "transparent"}`, background: isActive ? "var(--royal-50)" : "transparent", color: isActive ? "var(--royal)" : "var(--ink)", fontSize: 13, fontWeight: isActive ? 700 : 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.1s" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  {isActive ? "✓ " : ""}{opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 地域 */}
      {availablePrefectures.length > 1 && (
        <div>
          <SectionHeader label="地域" sectionKey="prefecture" hasActive={!!prefecture} />
          {!collapsed.has("prefecture") && (
            <div style={{ padding: "0 12px 8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 150, overflowY: "auto" }}>
                {availablePrefectures.map((p) => {
                  const isActive = prefecture === p;
                  return (
                    <button key={p} type="button" onClick={() => setParam("prefecture", isActive ? "" : p)}
                      style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: isActive ? "var(--royal-50)" : "transparent", color: isActive ? "var(--royal)" : "var(--ink)", fontSize: 13, fontWeight: isActive ? 700 : 500, cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "background 0.1s" }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      {isActive ? "✓ " : ""}{p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── モバイル「詳細条件」アコーディオン ────────────────────────────────────────────

function MobileDetailSection({
  industryId, empType, companyStage, industries, setParam, onCompanyStageChange,
}: {
  industryId: string; empType: string; companyStage: string;
  industries: { id: string; parent_id: string | null; name: string; slug: string }[];
  setParam: (key: string, value: string) => void;
  onCompanyStageChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasActive = !!industryId || !!empType || !!companyStage;
  const parentIndustries = industries.filter((i) => !i.parent_id);
  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${hasActive ? "var(--royal)" : "var(--line)"}`, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: hasActive ? "var(--royal-50)" : "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: hasActive ? "var(--royal)" : "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6 }}>
          {hasActive && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />}
          詳細条件
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      <div style={{ display: open ? "flex" : "none", flexDirection: "column", gap: 16, padding: "14px 14px" }}>
        {/* 業種 */}
        {parentIndustries.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>業種</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {parentIndustries.map((ind) => (
                <button key={ind.id} type="button" onClick={() => setParam("industry_id", industryId === ind.id ? "" : ind.id)}
                  style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: `1.5px solid ${industryId === ind.id ? "var(--royal)" : "var(--line)"}`, background: industryId === ind.id ? "var(--royal-50)" : "#fff", color: industryId === ind.id ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer", fontWeight: industryId === ind.id ? 700 : 400 }}>
                  {ind.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 雇用形態 */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>雇用形態</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["正社員", "業務委託", "副業"].map(v => (
              <button key={v} type="button" onClick={() => setParam("emp_type", empType === v ? "" : v)}
                style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: `1.5px solid ${empType === v ? "var(--royal)" : "var(--line)"}`, background: empType === v ? "var(--royal-50)" : "#fff", color: empType === v ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer", fontWeight: empType === v ? 700 : 400 }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        {/* 企業ステージ */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>企業ステージ</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {([
              { key: "listed",  label: "上場",           color: "var(--success)",  bg: "var(--success-soft)" },
              { key: "unicorn", label: "🦄 ユニコーン",  color: "var(--purple)",   bg: "var(--purple-soft)" },
              { key: "startup", label: "スタートアップ", color: "var(--royal)",    bg: "var(--royal-50)" },
              { key: "foreign", label: "🌏 外資系",      color: "#1D4ED8",         bg: "#EFF6FF" },
            ] as { key: string; label: string; color: string; bg: string }[]).map(({ key, label, color, bg }) => {
              const active = companyStage === key;
              return (
                <button key={key} type="button" onClick={() => onCompanyStageChange(active ? "" : key)}
                  style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: active ? 700 : 400, border: `1.5px solid ${active ? color : "var(--line)"}`, background: active ? bg : "#fff", color: active ? color : "var(--ink-soft)", cursor: "pointer" }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main client component ─────────────────────────────────────────────────────

export default function JobsClient({
  jobs: allJobs,
  companies,
  parentRoles,
  recommendations = [],
  reviewSummaries = {},
  roleAliases = [],
  industries = [],
}: {
  jobs: Job[];
  companies: Company[];
  parentRoles: { id: string; name: string }[];
  recommendations?: RecommendedJob[];
  reviewSummaries?: Record<string, CompanyReviewSummary>;
  roleAliases?: { alias: string; roleId: string }[];
  industries?: { id: string; parent_id: string | null; name: string; slug: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? "";
  const bizOnly = searchParams.get("biz_only") === "1";
  const dept = searchParams.get("dept") ?? "";       // 後方互換 (新規 URL では未使用)
  const work_style = searchParams.get("work_style") ?? "";
  const salary = searchParams.get("salary") ?? "";
  const salaryMax = searchParams.get("salary_max") ?? "";
  const industry = searchParams.get("industry") ?? "";
  const industryId = searchParams.get("industry_id") ?? "";
  const prefecture = searchParams.get("prefecture") ?? "";
  const empType = searchParams.get("emp_type") ?? "";   // 雇用形態フィルター（カンマ区切り複数可）
  const bizModel = searchParams.get("biz_model") ?? ""; // 業態タグフィルター

  // 複数選択用: カンマ区切り文字列 → Set
  const categorySet = useMemo(() => new Set(category ? category.split(",") : []), [category]);
  const workStyleSet = useMemo(() => new Set(work_style ? work_style.split(",") : []), [work_style]);
  const empTypeSet = useMemo(() => new Set(empType ? empType.split(",") : []), [empType]);
  const [sort, setSort] = useState(searchParams.get("sort") ?? "updated");
  // Desktop sidebar detection
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Local-only keyword search
  const [q, setQ] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [pillAnchor, setPillAnchor] = useState<{ top: number; left: number } | null>(null);
  const filterPillsRef = useRef<HTMLDivElement>(null);

  // サジェスト / フィルターピル外クリックで閉じる
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchBarRef.current && !searchBarRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
      const target = e.target as Node;
      const inFilterBar = filterPillsRef.current?.contains(target);
      const inDropdown = (target as HTMLElement)?.closest?.(".jobs-pill-menu");
      if (!inFilterBar && !inDropdown) {
        setOpenFilter(null);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // ⑧ 企業グルーピング toggle（デフォルトON）
  const [groupByCompany, setGroupByCompany] = useState(false);


  // 企業ステージフィルター
  const [companyStage, setCompanyStage] = useState(""); // カンマ区切り複数選択
  const companyStageSet = useMemo(() => new Set(companyStage ? companyStage.split(",") : []), [companyStage]);

  function toggleParam(key: string, value: string, current: string) {
    const set = new Set(current ? current.split(",") : []);
    if (set.has(value)) set.delete(value); else set.add(value);
    setParam(key, Array.from(set).join(","));
  }
  function toggleStage(value: string) {
    const set = new Set(companyStage ? companyStage.split(",") : []);
    if (set.has(value)) set.delete(value); else set.add(value);
    setCompanyStage(Array.from(set).join(","));
  }

  // 技術スタックフィルター（複数選択 AND）
  const [techStack, setTechStack] = useState<string[]>([]);

  // モバイルフィルターボトムシート
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Which filter chip dropdown is open
  const filterBarRef = useRef<HTMLDivElement>(null);

  // Close filter bar on outside click (for future use)
  useEffect(() => {
    function handleClickOutside(_e: MouseEvent) {
      // no-op: native selects close automatically
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Bookmarks + applied jobs: load in parallel on mount
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [userJobType, setUserJobType] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      fetch("/api/bookmarks?target_type=job").then((r) => r.ok ? r.json() : { ids: [] }).catch(() => ({ ids: [] })),
      fetch("/api/user/applied-jobs").then((r) => r.ok ? r.json() : { ids: [] }).catch(() => ({ ids: [] })),
      supabase.auth.getUser(),
    ]).then(async ([bookmarkData, appliedData, { data: { user } }]) => {
      if ((bookmarkData as { ids?: string[] }).ids) setBookmarkedIds(new Set((bookmarkData as { ids: string[] }).ids));
      if ((appliedData as { ids?: string[] }).ids) setAppliedJobIds(new Set((appliedData as { ids: string[] }).ids));
      if (!user) return;
      const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).single();
      if (!owUser?.id) return;
      const { data: profile } = await supabase.from("ow_profiles").select("job_type").eq("user_id", owUser.id).single();
      if (profile?.job_type) setUserJobType(profile.job_type as string);
    }).catch(() => {});
  }, []);

  // ⑤ "もっと見る" — init from URL param ?show=N, resets when filters change
  const initShow = Math.max(PER_PAGE, parseInt(searchParams.get("show") ?? "0") || PER_PAGE);
  const [displayCount, setDisplayCount] = useState(initShow);

  // Build Map for fast company lookup
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  // 検索サジェスト: キーワードから求人タイトル・会社名をマッチ
  const suggestions = useMemo(() => {
    const trimmed = q.trim();
    if (trimmed.length < 1) return [];
    const lower = trimmed.toLowerCase();
    const seen = new Set<string>();
    const results: { label: string; sub: string; q: string }[] = [];
    for (const j of allJobs) {
      if (results.length >= 8) break;
      const roleMatch = j.role.toLowerCase().includes(lower);
      const co = companyMap.get(j.company_id);
      const coName = co?.name ?? "";
      const coMatch = coName.toLowerCase().includes(lower);
      if (roleMatch) {
        const key = j.role;
        if (!seen.has(key)) { seen.add(key); results.push({ label: j.role, sub: coName, q: j.role }); }
      } else if (coMatch) {
        const key = `co:${coName}`;
        if (!seen.has(key)) { seen.add(key); results.push({ label: coName, sub: "企業で絞り込む", q: coName }); }
      }
    }
    return results;
  }, [q, allJobs, companyMap]);

  // 業界名の正規化マップ（フィルター用）
  // SaaS は業態タグ（biz_model）に移行したため業界軸から削除
  const INDUSTRY_NORMALIZE: Record<string, string> = {
    "IT": "ITサービス",
  };
  const normalizeIndustry = (v: string | null) =>
    v ? (INDUSTRY_NORMALIZE[v] ?? v) : null;

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`/jobs?${params.toString()}`, { scroll: false });
  }

  // 実データに含まれる都道府県のみ (北から南順)
  const availablePrefectures = useMemo(() => {
    const prefSet = new Set<string>();
    allJobs.forEach((j) => {
      const p = extractPrefecture(j.location);
      if (p) prefSet.add(p);
    });
    return PREFECTURES.filter((p) => prefSet.has(p));
  }, [allJobs]);

  const filtered = useMemo(() => {
    let list = [...allJobs];

    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      // エイリアスにマッチするroleIdを収集（例: "サーバーサイド" → バックエンドのrole_id）
      const aliasMatchedRoleIds = new Set(
        roleAliases
          .filter((a) => a.alias.toLowerCase().includes(lq))
          .map((a) => a.roleId)
      );
      const jobMatchesAlias = (j: (typeof list)[number]) => {
        // ow_job_roles の全職種 UUID で判定（複数職種対応）
        const ids = j.roleIds ?? (j.role_category_id ? [j.role_category_id] : []);
        return ids.some((id) => aliasMatchedRoleIds.has(id));
      };
      list = list.filter(
        (j) =>
          j.role.toLowerCase().includes(lq) ||
          (companyMap.get(j.company_id)?.name ?? "").toLowerCase().includes(lq) ||
          (companyMap.get(j.company_id)?.brand_name ?? "").toLowerCase().includes(lq) ||
          (companyMap.get(j.company_id)?.slug ?? "").toLowerCase().includes(lq) ||
          j.highlight.toLowerCase().includes(lq) ||
          jobMatchesAlias(j)
      );
    }

    // ビジネス職のみフィルタ
    if (bizOnly && !category) {
      const { business } = getVisibleRoles(parentRoles);
      const bizIds = new Set(business.map((r) => r.id));
      list = list.filter((j) => bizIds.has(j.role_category_id ?? ""));
    }

    // ow_roles 親カテゴリフィルタ — 複数選択対応（カンマ区切り）
    if (categorySet.size > 0) list = list.filter((j) => {
      const ids = j.roleIds ?? (j.role_category_id ? [j.role_category_id] : []);
      return ids.some((id) => categorySet.has(id));
    });

    // 旧 dept フィルタ (後方互換、URLに ?dept= が残っている場合)
    if (!category && dept) list = list.filter((j) => j.dept === dept);

    if (workStyleSet.size > 0) {
      list = list.filter(
        (j) =>
          workStyleSet.has(j.work_style) ||
          j.tags.some((t) => Array.from(workStyleSet).some((ws) => t.includes(ws)))
      );
    }

    if (salary) {
      const min = parseInt(salary, 10);
      if (!isNaN(min)) {
        list = list.filter((j) => j.salary_max > 0 && j.salary_max >= min);
      }
    }

    if (salaryMax) {
      const max = parseInt(salaryMax, 10);
      if (!isNaN(max)) {
        list = list.filter((j) => (j.salary_min ?? 0) > 0 && (j.salary_min ?? 0) <= max);
      }
    }

    if (industry) {
      const companyIds = companies
        .filter((c) => normalizeIndustry(c.industry) === industry)
        .map((c) => c.id);
      list = list.filter((j) => companyIds.includes(j.company_id));
    }

    // industry_id フィルター（ow_industries マスタ使用。親IDを選択した場合は子IDも含む）
    if (industryId) {
      const childIds = new Set(
        industries.filter((i) => i.parent_id === industryId).map((i) => i.id)
      );
      const companyIds = new Set(
        companies
          .filter((c) => {
            const cid = (c as { industry_id?: string | null }).industry_id;
            return cid && (cid === industryId || childIds.has(cid));
          })
          .map((c) => c.id)
      );
      list = list.filter((j) => companyIds.has(j.company_id));
    }

    // 都道府県フィルタ (job.location から抽出した都道府県と完全一致)
    if (prefecture) {
      list = list.filter((j) => extractPrefecture(j.location) === prefecture);
    }

    // 雇用形態フィルタ（複数選択対応）
    if (empTypeSet.size > 0) {
      list = list.filter((j) => empTypeSet.has(j.employment_type));
    }

    // 業態タグフィルタ
    if (bizModel) {
      list = list.filter((j) => j.business_model === bizModel);
    }

    // 企業ステージフィルタ（複数選択対応）
    if (companyStageSet.size > 0) {
      list = list.filter((j) => {
        const phase = (companyMap.get(j.company_id)?.phase ?? "").toLowerCase();
        const co = companyMap.get(j.company_id);
        const matchesStage = (s: string) => {
          if (s === "unicorn") return /unicorn|ユニコーン/.test(phase);
          if (s === "listed")  return /上場|listed|nasdaq|nyse|グロース|プライム/.test(phase);
          if (s === "startup") return /seed|シード|series|シリーズ/.test(phase);
          if (s === "foreign") {
            const nm = co?.name ?? "";
            const url = (co?.url ?? "").toLowerCase();
            if (nm.toLowerCase().includes("japan")) return true;
            if (url && !url.includes(".co.jp") && !url.includes(".jp/") && !url.endsWith(".jp")) return true;
            if (/^[゠-ヿ]/.test(nm)) return true;
            return false;
          }
          return false;
        };
        return Array.from(companyStageSet).some(matchesStage);
      });
    }

    // 技術スタックフィルタ（AND: 選択タグをすべて含む求人のみ）
    if (techStack.length > 0) {
      list = list.filter((j) => {
        const ts = j.tech_stack;
        if (!ts || ts.length === 0) return false;
        return techStack.every((t) => ts.includes(t));
      });
    }

    // ソート
    if (sort === "salary") {
      list = [...list].sort((a, b) => (b.salary_max ?? 0) - (a.salary_max ?? 0));
    } else if (sort === "meeting") {
      // 面談受付中優先、次に更新日
      list = [...list].sort((a, b) => {
        const aM = companyMap.get(a.company_id)?.accepting_casual_meetings ? 0 : 1;
        const bM = companyMap.get(b.company_id)?.accepting_casual_meetings ? 0 : 1;
        if (aM !== bM) return aM - bM;
        return a.updated_days_ago - b.updated_days_ago;
      });
    } else {
      // デフォルト: 給与記載あり優先、次に更新日
      list = [...list].sort((a, b) => {
        const aHas = hasSalaryData(a.salary_min, a.salary_max) ? 0 : 1;
        const bHas = hasSalaryData(b.salary_min, b.salary_max) ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        return a.updated_days_ago - b.updated_days_ago;
      });
    }

    return list;
  }, [allJobs, q, category, categorySet, dept, work_style, workStyleSet, salary, salaryMax, bizModel, industry, industryId, prefecture, empType, empTypeSet, companyStage, companyStageSet, techStack, sort, companies, companyMap, roleAliases, industries]);

  // ⑧ グルーピング適用（1社あたり最大3件・更新日新しい順）
  const filteredForDisplay = useMemo(() => {
    if (!groupByCompany) return filtered;
    // 企業ごとにグループ化し、更新日昇順（古い日数=新しい）でソート後、先頭3件を取る
    const byCompany = new Map<string, typeof filtered>();
    for (const j of filtered) {
      const arr = byCompany.get(j.company_id) ?? [];
      arr.push(j);
      byCompany.set(j.company_id, arr);
    }
    byCompany.forEach((arr) => arr.sort((a, b) => a.updated_days_ago - b.updated_days_ago));
    // 企業の出現順（filteredリスト内の初出）を維持して平坦化
    const seenCompanies: string[] = [];
    for (const j of filtered) {
      if (!seenCompanies.includes(j.company_id)) seenCompanies.push(j.company_id);
    }
    return seenCompanies.flatMap((cid) => (byCompany.get(cid) ?? []).slice(0, 3));
  }, [filtered, groupByCompany]);

  // ⑧ グルーピング時に「まとめられた社数」を計算
  const hiddenByGrouping = filtered.length - filteredForDisplay.length;
  // ⑧ 最も多い企業の件数を計算
  const maxPerCompany = useMemo(() => {
    const countMap = new Map<string, number>();
    filtered.forEach((j) => countMap.set(j.company_id, (countMap.get(j.company_id) ?? 0) + 1));
    return Math.max(0, ...Array.from(countMap.values()));
  }, [filtered]);

  // ⑤ reset when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filterKey = [category, dept, work_style, salary, salaryMax, bizModel, industry, industryId, prefecture, empType, sort, q, bizOnly, companyStage, techStack.join(",")].join("|");
  useEffect(() => {
    setDisplayCount(PER_PAGE);
    // Clear ?show from URL when filters change
    const p = new URLSearchParams(window.location.search);
    if (p.has("show")) { p.delete("show"); router.replace(`/jobs?${p.toString()}`, { scroll: false }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const paged = filteredForDisplay.slice(0, displayCount);
  const hasMore = displayCount < filteredForDisplay.length;
  const remainingCount = filteredForDisplay.length - displayCount;

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setDisplayCount((c) => c + PER_PAGE); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  const hasFilter = !!(category || dept || work_style || salary || bizModel || industry || industryId || prefecture || empType || companyStage || techStack.length || bizOnly);


  const roleCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of allJobs) {
      const ids = (j as { roleIds?: string[] }).roleIds ?? (j.role_category_id ? [j.role_category_id] : []);
      for (const id of ids) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [allJobs]);

  // 希望職種マッチ求人（パーソナライズセクション用）
  const jobTypeMatchedJobs = useMemo(() => {
    if (!userJobType) return [];
    const roleName = JOB_TYPE_TO_ROLE_NAME[userJobType];
    if (!roleName) return [];
    const role = parentRoles.find((r) => r.name === roleName);
    if (!role) return [];
    return allJobs.filter((j) => j.role_category_id === role.id).slice(0, 5);
  }, [allJobs, userJobType, parentRoles]);

  return (
    <>
      <h1 className="sr-only">IT/SaaS 求人を探す</h1>

      <div style={{ paddingTop: "var(--space-5)" }} />

      {/* ── 2-row スティッキーフィルターバー（全幅・常時固定） ── */}
      <div
        ref={filterBarRef}
        className="jobs-mobile-filterbar"
        style={{
          zIndex: 50,
          background: "#fff",
          borderBottom: "1px solid var(--line)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          padding: "var(--space-2) 0",
        }}
      >
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }} className="px-5 md:px-12">

          {/* ── 行1: 検索バー（企業一覧と同スタイル：大きなピル） ── */}
          <div ref={searchBarRef} style={{ position: "relative" }}>
            <div role="search" style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#fff", border: "2px solid #e6e9ef", borderRadius: 999,
              padding: "0 16px", transition: "border-color 0.15s, box-shadow 0.15s",
            }}
              onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--royal)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(0,35,102,0.08)"; }}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { (e.currentTarget as HTMLDivElement).style.borderColor = "#e6e9ef"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; } }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="search"
                aria-label="求人を検索"
                placeholder="職種・企業名で検索..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
                onFocus={() => setShowSuggest(true)}
                onKeyDown={(e) => { if (e.key === "Escape") setShowSuggest(false); }}
                style={{
                  flex: 1, border: "none", outline: "none",
                  fontSize: 14.5, color: "var(--ink)", background: "transparent",
                  padding: "12px 0", minWidth: 0,
                }}
              />
              {q && (
                <button type="button" onClick={() => { setQ(""); setShowSuggest(false); }} aria-label="検索をクリア"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 16, lineHeight: 1, padding: 2, display: "flex", alignItems: "center", flexShrink: 0 }}
                >×</button>
              )}
              <div className="jobs-location-separator" style={{ width: 1, height: 18, background: "#e2e8f0", flexShrink: 0 }} />
              <select
                aria-label="勤務地"
                value={prefecture}
                onChange={(e) => setParam("prefecture", e.target.value)}
                className="jobs-location-select"
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: prefecture ? "var(--ink)" : "var(--ink-mute)", cursor: "pointer", padding: "8px 4px", flexShrink: 0, maxWidth: 90, fontFamily: "inherit" }}
              >
                <option value="">勤務地</option>
                {availablePrefectures.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* ── 検索サジェスト dropdown ── */}
            {showSuggest && suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                background: "#fff", border: "1.5px solid var(--line)",
                borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 200, overflow: "hidden",
              }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setQ(s.q); setShowSuggest(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "10px 16px",
                      border: "none", background: "transparent",
                      cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                      borderBottom: i < suggestions.length - 1 ? "1px solid var(--line-soft)" : "none",
                    }}
                    className="suggest-item"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</div>
                      {s.sub && <div style={{ fontSize: 11, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sub}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 行2: フィルターピル + 区切り + 並び替え pills + 件数 ── */}
          <div ref={filterPillsRef} style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", flexWrap: "nowrap", paddingBottom: 2 }}>
            {/* モバイル専用フィルターボタン */}
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="jobs-mobile-filter-btn"
              style={{
                display: "none",
                height: 36, padding: "0 14px", borderRadius: 999, fontSize: 12.5,
                fontWeight: hasFilter ? 700 : 500,
                border: `1.5px solid ${hasFilter ? "var(--royal)" : "#e2e8f0"}`,
                background: hasFilter ? "var(--royal-50)" : "#fff",
                color: hasFilter ? "var(--royal)" : "var(--ink-soft)",
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, alignItems: "center", gap: 6,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 5 }}>
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              絞り込み
              {hasFilter && (
                <span style={{ marginLeft: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "var(--royal)", color: "#fff", fontSize: 10, fontWeight: 800, fontFamily: "Inter, sans-serif" }}>
                  {[category, work_style, salary, empType, prefecture].filter(Boolean).length}
                </span>
              )}
            </button>

            {/* 職種 ピル */}
            <button type="button" className={`jobs-pill${category ? " active" : ""}`} style={{ flexShrink: 0 }}
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                if (openFilter === "category") { setOpenFilter(null); return; }
                setPillAnchor({ top: r.bottom + 6, left: r.left });
                setOpenFilter("category");
              }}
            >
              {category ? (parentRoles.find(r => r.id === category)?.name ?? "職種") : "職種"} <span className="jobs-pill-caret">▾</span>
            </button>

            {/* 勤務形態 ピル */}
            <button type="button" className={`jobs-pill${work_style ? " active" : ""}`} style={{ flexShrink: 0 }}
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                if (openFilter === "work_style") { setOpenFilter(null); return; }
                setPillAnchor({ top: r.bottom + 6, left: r.left });
                setOpenFilter("work_style");
              }}
            >
              {work_style || "勤務形態"} <span className="jobs-pill-caret">▾</span>
            </button>

            {/* 年収 ピル */}
            <button type="button" className={`jobs-pill${salary ? " active" : ""}`} style={{ flexShrink: 0 }}
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                if (openFilter === "salary") { setOpenFilter(null); return; }
                setPillAnchor({ top: r.bottom + 6, left: r.left });
                setOpenFilter("salary");
              }}
            >
              {salary ? (SALARY_PILL_TIERS.find(t => t.value === salary)?.label ?? "年収") : "年収"} <span className="jobs-pill-caret">▾</span>
            </button>

            {/* 雇用形態 ピル */}
            <button type="button" className={`jobs-pill${empType ? " active" : ""}`} style={{ flexShrink: 0 }}
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                if (openFilter === "empType") { setOpenFilter(null); return; }
                setPillAnchor({ top: r.bottom + 6, left: r.left });
                setOpenFilter("empType");
              }}
            >
              {empType || "雇用形態"} <span className="jobs-pill-caret">▾</span>
            </button>

            {/* 地域 ピル */}
            {availablePrefectures.length > 1 && (
              <button type="button" className={`jobs-pill${prefecture ? " active" : ""}`} style={{ flexShrink: 0 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (openFilter === "prefecture") { setOpenFilter(null); return; }
                  setPillAnchor({ top: r.bottom + 6, left: r.left });
                  setOpenFilter("prefecture");
                }}
              >
                {prefecture || "地域"} <span className="jobs-pill-caret">▾</span>
              </button>
            )}

            {/* 面談受付中 トグルピル */}
            <button type="button"
              className={`jobs-pill-hiring${sort === "meeting" ? " active" : ""}`}
              onClick={() => setSort(sort === "meeting" ? "updated" : "meeting")}
            >
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: sort === "meeting" ? "#fff" : "var(--warm)", marginRight: 5, verticalAlign: "middle", flexShrink: 0 }} />
              面談受付中
            </button>

            {(hasFilter || q) && (
              <button type="button" onClick={() => { setQ(""); setCompanyStage(""); setTechStack([]); router.replace("/jobs"); }}
                style={{ fontSize: 11, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: "5px 2px", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0 }}
              >✕ リセット</button>
            )}

            {/* 縦区切り */}
            <div style={{ width: 1, height: 20, background: "var(--line)", margin: "0 2px", flexShrink: 0 }} />

            {/* 並び替え — 新着順 / 年収順 */}
            <div style={{ display: "flex", border: "1.5px solid #e2e8f0", borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#fff" }}>
              {([
                { value: "updated", label: "新着順" },
                { value: "salary",  label: "年収順" },
              ] as const).map((opt, i) => {
                const active = sort === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSort(opt.value)}
                    style={{
                      height: 35, padding: "0 13px", borderRadius: 0, fontSize: 12.5,
                      fontWeight: active ? 700 : 500,
                      background: active ? "var(--royal)" : "transparent",
                      color: active ? "#fff" : "var(--ink-mute)",
                      cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.15s, color 0.15s", flexShrink: 0,
                      boxShadow: i > 0 ? "-1px 0 0 0 #e2e8f0 inset" : "none",
                      border: "none",
                      fontFamily: "inherit",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              {maxPerCompany > 3 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setGroupByCompany(v => !v); setDisplayCount(PER_PAGE); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 11px", borderRadius: 100,
                      border: `1.5px solid ${groupByCompany ? "var(--royal)" : "var(--line)"}`,
                      background: groupByCompany ? "var(--royal-50)" : "#fff",
                      color: groupByCompany ? "var(--royal)" : "var(--ink-mute)",
                      fontSize: 11, fontWeight: groupByCompany ? 700 : 500,
                      cursor: "pointer", whiteSpace: "nowrap",
                      fontFamily: "inherit", transition: "all 0.15s",
                    }}
                    title="同一企業の求人を1社あたり3件に絞る"
                  >
                    {groupByCompany ? "✓ " : ""}1社3件まで
                  </button>
                  {groupByCompany && hiddenByGrouping > 0 && (
                    <span style={{ fontSize: 10, color: "#C2410C", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      1社3件まで（{hiddenByGrouping}件非表示）
                      <button type="button" onClick={() => setGroupByCompany(false)} style={{ background: "none", border: "none", color: "#C2410C", fontWeight: 700, fontSize: 10, cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline" }}>全表示</button>
                    </span>
                  )}
                </>
              )}
              <span aria-live="polite" style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {filteredForDisplay.length}<span style={{ fontSize: 10, fontWeight: 500, marginLeft: 2 }}>件</span>
                {(hasFilter || q) && <span style={{ fontSize: 10, color: "var(--success)", marginLeft: 5, fontWeight: 600 }}>絞込中</span>}
              </span>
            </div>
          </div>

          {/* ── 行3 (モバイルのみ): 職種クイックピル ── */}
          <div className="jobs-mobile-role-pills" style={{ display: "none", gap: 6, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
            {parentRoles.slice(0, 10).map((role) => {
              const active = category === role.id;
              const rc = getRoleColor(role.name);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setParam("category", active ? "" : role.id)}
                  style={{
                    flexShrink: 0, height: 30, padding: "0 12px", borderRadius: 999,
                    fontSize: 11.5, fontWeight: active ? 700 : 500,
                    border: `1.5px solid ${active ? rc.color : "#e2e8f0"}`,
                    background: active ? rc.bg : "#fff",
                    color: active ? rc.color : "var(--ink-soft)",
                    cursor: "pointer", whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {role.name}
                  {roleCounts.get(role.id) ? <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>({roleCounts.get(role.id)})</span> : null}
                </button>
              );
            })}
          </div>

          {/* アクティブフィルター (optional row 4) */}
          {hasFilter && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2, paddingBottom: 2, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap", fontWeight: 500 }}>絞り込み中:</span>
              {category && (() => {
                const r = parentRoles.find(r => r.id === category);
                const rc = r ? getRoleColor(r.name) : { color: "var(--royal)", bg: "var(--royal-50)" };
                return r ? (
                  <button key="cat" type="button" onClick={() => setParam("category", "")} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 100,
                    background: rc.bg, border: `1.5px solid ${rc.color}`,
                    color: rc.color, fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    職種: {r.name} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                  </button>
                ) : null;
              })()}
              {work_style && (
                <button key="ws" type="button" onClick={() => setParam("work_style", "")} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 100,
                  background: "var(--success-soft)", border: "1.5px solid #6EE7B7",
                  color: "#065F46", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  勤務形態: {work_style} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                </button>
              )}
              {salary && (() => {
                const tier = SALARY_PILL_TIERS.find(t => t.value === salary);
                return tier ? (
                  <button key="sal" type="button" onClick={() => setParam("salary", "")} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 100,
                    background: "#FEF3C7", border: "1.5px solid #FDE68A",
                    color: "#92400E", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    年収: {tier.label} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                  </button>
                ) : null;
              })()}
              {empType && (
                <button key="emp" type="button" onClick={() => setParam("emp_type", "")} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 100,
                  background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
                  color: "var(--royal)", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  雇用形態: {empType} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                </button>
              )}
              {prefecture && (
                <button key="pref" type="button" onClick={() => setParam("prefecture", "")} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 100,
                  background: "#F0FDF4", border: "1.5px solid #BBF7D0",
                  color: "#16A34A", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  地域: {prefecture} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                </button>
              )}
              {techStack.map((t) => (
                <button key={`ts-${t}`} type="button" onClick={() => setTechStack(techStack.filter((x) => x !== t))} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 100,
                  background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
                  color: "var(--royal)", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  {t} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                </button>
              ))}
              <button type="button" onClick={() => { setQ(""); setTechStack([]); router.replace("/jobs"); }} style={{
                fontSize: 11, color: "var(--ink-mute)", background: "none",
                border: "none", cursor: "pointer", padding: "3px 4px",
                fontFamily: "inherit", textDecoration: "underline",
              }}>
                すべてリセット
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Main content */}
      <div style={{ background: "#F5F7FA" }}>
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 py-6 md:px-12 md:py-8"
        >
          <div
            className="jobs-layout"
            style={isDesktop ? { gridTemplateColumns: "220px minmax(0,1fr)" } : undefined}
          >
            {/* ─ Desktop sidebar ─ */}
            <aside className="jobs-sidebar">
              <SidebarFilters
                parentRoles={parentRoles}
                category={category}
                workStyle={work_style}
                salary={salary}
                salaryMax={salaryMax}
                empType={empType}
                bizModel={bizModel}
                prefecture={prefecture}
                companyStage={companyStage}
                onCompanyStageChange={setCompanyStage}
                techStack={techStack}
                onTechStackChange={setTechStack}
                availablePrefectures={availablePrefectures}
                setParam={setParam}
                hasFilter={hasFilter}
                q={q}
                onReset={() => { setQ(""); setCompanyStage(""); setTechStack([]); router.replace("/jobs"); }}
                industries={industries}
                industryId={industryId}
                roleCounts={roleCounts}
                toggleParam={toggleParam}
                toggleStage={toggleStage}
              />
            </aside>

            {/* ─ Results column ─ */}
            <main style={{ minWidth: 0 }}>

          {/* ── パーソナライズ: あなたにおすすめの求人 ── */}
          {!hasFilter && !q && recommendations.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>あなたへのおすすめ</span>
                <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", fontWeight: 600 }}>
                  {recommendations.length}件
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {recommendations.slice(0, 6).map(({ job }) => {
                  const recCompany = companyMap.get(job.company_id);
                  return (
                    <a
                      key={job.id}
                      href={`/jobs/${job.slug ?? job.id}`}
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        background: "#fff", color: "var(--ink)",
                        border: "1.5px solid var(--line)",
                        textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 10,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                        transition: "border-color .15s, box-shadow .15s",
                      }}
                    >
                      <div style={{ flexShrink: 0, marginTop: 1 }}>
                        {recCompany && (
                          <CompanyLogo
                            name={recCompany.name}
                            logoUrl={recCompany.logo_url}
                            logoLetter={recCompany.logo_letter}
                            logoGradient={recCompany.gradient}
                            size={36}
                            borderRadius={8}
                          />
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {job.role}
                        </div>
                        {recCompany && (
                          <div style={{ fontSize: 11, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {(recCompany as any).brand_name ?? recCompany.name}
                          </div>
                        )}
                        {(job.salary_min ?? 0) > 0 && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
                            {job.salary_min}
                            {job.salary_max && job.salary_max > job.salary_min! ? `〜${job.salary_max}` : ""}万円
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
              {recommendations.length > 4 && (
                <div style={{ marginTop: 8, textAlign: "right" }}>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>他 +{recommendations.length - 4}件</span>
                </div>
              )}
            </div>
          )}

          {/* フォールバック: おすすめなし・希望職種マッチのみ（ログイン済みでプロフィール未設定の場合） */}
          {!hasFilter && !q && recommendations.length === 0 && jobTypeMatchedJobs.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                paddingBottom: 10, borderBottom: "2px solid var(--royal-100)",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                  あなたの希望職種にマッチ
                </span>
                <span style={{
                  fontSize: 11, padding: "2px 9px", borderRadius: 100,
                  background: "var(--royal-50)", color: "var(--royal)",
                  fontWeight: 700, border: "1px solid var(--royal-100)",
                }}>
                  {userJobType}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-mute)", marginLeft: "auto", fontFamily: "Inter, sans-serif" }}>
                  {jobTypeMatchedJobs.length}件
                </span>
              </div>
              <div className="jobs-list-desktop">
                {jobTypeMatchedJobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    companyMap={companyMap}
                    initialBookmarked={bookmarkedIds.has(job.id)}
                    isApplied={appliedJobIds.has(job.id)}
                    reviewSummary={reviewSummaries?.[job.company_id]}
                    matchReason={computeMatchReason(job, { category, dept, salary, prefecture, q }, parentRoles)}
                  />
                ))}
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginTop: 20,
              }}>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  すべての求人
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              </div>
            </div>
          )}

          {paged.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px 24px", background: "#fff",
              borderRadius: 16, border: "1px solid var(--line)", marginTop: 20,
            }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <h3 style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>条件に合う求人が見つかりませんでした</h3>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", marginBottom: 20 }}>フィルター条件を変えるか、企業のカジュアル面談で直接聞いてみましょう</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button type="button" onClick={() => router.replace("/jobs")} style={{
                  padding: "10px 24px", borderRadius: 8, background: "var(--royal)",
                  color: "#fff", border: "none", fontSize: "var(--text-base)", fontWeight: 600, cursor: "pointer",
                }}>
                  すべてリセット
                </button>
                <Link href="/companies" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 8,
                  background: "linear-gradient(135deg, var(--royal), var(--accent))",
                  color: "#fff", fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  企業を見る
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* リスト表示（デスクトップ・モバイル共通） */}
              <div className="jobs-list-desktop">
                {(() => {
                  return paged.map((job) => {
                    const co = companyMap.get(job.company_id);
                    return (
                      <JobListItem
                        key={job.id}
                        job={job}
                        companyMap={companyMap}
                        initialBookmarked={bookmarkedIds.has(job.id)}
                        isApplied={appliedJobIds.has(job.id)}
                        reviewSummary={reviewSummaries?.[job.company_id]}
                        matchReason={computeMatchReason(job, { category, dept, salary, prefecture, q }, parentRoles)}
                        showMeetingCta={!!co?.accepting_casual_meetings}
                      />
                    );
                  });
                })()}
              </div>
              {/* ⑦ プログレスバー + もっと見るボタン */}
              <div style={{ marginTop: 16, marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                    <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{paged.length}</strong>
                    {" / "}
                    <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{filteredForDisplay.length}</strong>
                    {" 件表示中"}
                  </span>
                  {hasMore && (
                    <span style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600 }}>残り{remainingCount}件</span>
                  )}
                </div>
                <div style={{ height: 4, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.round(paged.length / Math.max(filteredForDisplay.length, 1) * 100)}%`,
                    background: "linear-gradient(to right, var(--royal), #3B5FD9)",
                    borderRadius: 99,
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => {
                    const next = displayCount + PER_PAGE;
                    setDisplayCount(next);
                    const p = new URLSearchParams(window.location.search);
                    p.set("show", next.toString());
                    router.replace(`/jobs?${p.toString()}`, { scroll: false });
                  }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    margin: "12px auto 0",
                    padding: "12px 32px", borderRadius: 999,
                    border: "1.5px solid var(--royal)",
                    background: "#fff", color: "var(--royal)",
                    fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                    boxShadow: "0 2px 8px rgba(0,35,102,0.1)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--royal)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)"; }}
                >
                  もっと見る
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
              )}
              {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

            </>
          )}
            </main>
          </div>{/* jobs-layout end */}
        </div>
      </div>{/* bg end */}


      <style>{`
        /* ── フィルターピル ── */
        .jobs-pill {
          display: inline-flex; align-items: center; gap: 4px;
          height: 34px; padding: 0 13px;
          border-radius: 999px; font-size: 12.5px; font-weight: 500;
          border: 1.5px solid #e2e8f0; background: #fff; color: var(--ink-soft);
          cursor: pointer; white-space: nowrap; font-family: inherit;
          transition: border-color 0.12s, background 0.12s, color 0.12s;
        }
        .jobs-pill:hover { border-color: var(--royal); color: var(--royal); }
        .jobs-pill.active {
          border-color: var(--royal); background: var(--royal-50);
          color: var(--royal); font-weight: 700;
        }
        .jobs-pill-caret { font-size: 9px; opacity: 0.6; }
        .jobs-pill-menu {
          position: absolute; top: calc(100% + 6px); left: 0;
          background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px;
          box-shadow: 0 8px 28px rgba(0,35,102,0.13);
          z-index: 120; min-width: 160px; max-height: 300px; overflow-y: auto;
          padding: 6px;
        }
        .jobs-pill-item {
          display: block; width: 100%; text-align: left;
          padding: 8px 12px; border-radius: 8px; border: none;
          background: none; font-size: 13px; color: var(--ink); cursor: pointer;
          font-family: inherit; white-space: nowrap;
          transition: background 0.1s;
        }
        .jobs-pill-item:hover { background: var(--royal-50); }
        .jobs-pill-item.selected { color: var(--royal); font-weight: 700; background: var(--royal-50); }
        /* 面談受付中トグルピル */
        .jobs-pill-hiring {
          display: inline-flex; align-items: center;
          height: 34px; padding: 0 13px;
          border-radius: 999px; font-size: 12.5px; font-weight: 500;
          border: 1.5px solid #e2e8f0; background: #fff; color: var(--ink-soft);
          cursor: pointer; white-space: nowrap; font-family: inherit;
          transition: border-color 0.12s, background 0.12s, color 0.12s;
        }
        .jobs-pill-hiring:hover { border-color: var(--warm); color: var(--warm); }
        .jobs-pill-hiring.active {
          border-color: var(--warm); background: var(--warm); color: #fff; font-weight: 700;
        }

        /* ── Job card hover ── */
        .job-card-link:hover {
          box-shadow: 0 12px 36px rgba(0,35,102,0.18), 0 2px 8px rgba(0,35,102,0.08) !important;
          transform: translateY(-5px) !important;
        }
        .job-card-link .job-card-cta-overlay {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 20px 16px 14px;
          background: linear-gradient(to top, rgba(0,35,102,0.85) 0%, rgba(0,35,102,0) 100%);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          text-align: right;
          opacity: 0;
          transition: opacity 0.22s ease;
          border-radius: 0 0 18px 18px;
          pointer-events: none;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          gap: 4px;
        }
        .job-card-link:hover .job-card-cta-overlay {
          opacity: 1;
        }
        .job-card-link:active {
          box-shadow: 0 4px 12px rgba(15,23,42,0.10) !important;
          transform: translateY(-2px) !important;
          transition-duration: 0.06s !important;
        }
        /* ── 縦リストカードhover ── */
        .job-list-card:hover {
          box-shadow: 0 3px 14px rgba(0,35,102,0.10) !important;
        }
        .job-list-item-link:hover {
          background: var(--royal-50) !important;
        }
        .job-list-item-link:active {
          background: var(--royal-100) !important;
          transition-duration: 0.06s !important;
        }
        .job-search-input:focus {
          box-shadow: 0 0 0 3px rgba(0,35,102,0.12) !important;
        }

        /* ── Default layout (mobile: single column) ── */
        .jobs-layout {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .jobs-sidebar { display: none; }
        /* filter bar: always visible */
        .jobs-mobile-filterbar { display: block; position: sticky; top: 64px; }
        /* 縦リスト: 1カラム — 個別カード方式 */
        .jobs-list-desktop {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* desktop grid mode (旧カードグリッド: 残置) */
        .jobs-grid-desktop {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 1023px) {
          .jobs-grid-desktop { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 767px) {
          .jobs-grid-desktop { display: none; }
          .jobs-view-toggle { display: none !important; }
        }

        /* ── Desktop layout (≥1024px): サイドバー + 縦リスト [+ 詳細ペイン] ── */
        @media (min-width: 1024px) {
          .jobs-layout {
            display: grid;
            grid-template-columns: 220px minmax(0, 1fr);
            gap: 24px;
            align-items: start;
          }
          .jobs-sidebar { display: block !important; }
          /* デスクトップでは検索バーの勤務地selectをサイドバーで代替 */
          .jobs-location-select, .jobs-location-separator { display: none !important; }
        }

        @media (max-width: 767px) {
          .job-list-mobile-hide { display: none !important; }
        }
        @media (max-width: 1023px) {
          .jobs-mobile-role-pills { display: flex !important; }
        }

        /* モバイルフィルターボタン: 1023px以下で表示 */
        @media (max-width: 1023px) {
          .jobs-mobile-filter-btn { display: inline-flex !important; }
        }

        /* タイトル1行クランプ */
        .job-title-clamp {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: block;
          max-width: 100%;
        }

        /* company name hover */
        .company-name-link:hover {
          text-decoration: underline;
        }

        /* 検索サジェスト hover */
        .suggest-item:hover {
          background: var(--royal-50) !important;
        }

        /* 面談CTA hover */
        .job-meeting-cta:hover {
          background: #FED7AA !important;
        }

        /* ボトムシートアニメーション */
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

      `}</style>

      {/* ── モバイルフィルターボトムシート ── */}
      {filterSheetOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 2000, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          onClick={(e) => { if (e.target === e.currentTarget) setFilterSheetOpen(false); }}
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "0 0 env(safe-area-inset-bottom)", maxHeight: "85vh", overflowY: "auto", animation: "slideUp 0.25s ease-out" }}>
            {/* ハンドル */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>絞り込み</span>
              <button onClick={() => setFilterSheetOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--ink-mute)", lineHeight: 1, padding: 4 }}>×</button>
            </div>

            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* 職種 */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>職種</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {parentRoles.map(r => (
                    <button key={r.id} onClick={() => setParam("category", category === r.id ? "" : r.id)}
                      style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, border: `1.5px solid ${category === r.id ? "var(--royal)" : "var(--line)"}`, background: category === r.id ? "var(--royal-50)" : "#fff", color: category === r.id ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer", fontWeight: category === r.id ? 700 : 400 }}>
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 勤務形態 */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>勤務形態</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["フルリモート", "ハイブリッド", "出社"].map(v => (
                    <button key={v} onClick={() => setParam("work_style", work_style === v ? "" : v)}
                      style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, border: `1.5px solid ${work_style === v ? "var(--royal)" : "var(--line)"}`, background: work_style === v ? "var(--royal-50)" : "#fff", color: work_style === v ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer", fontWeight: work_style === v ? 700 : 400 }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* 年収 */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>年収下限</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SALARY_PILL_TIERS.map(t => (
                    <button key={t.value} onClick={() => setParam("salary", salary === t.value ? "" : t.value)}
                      style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, border: `1.5px solid ${salary === t.value ? "var(--royal)" : "var(--line)"}`, background: salary === t.value ? "var(--royal-50)" : "#fff", color: salary === t.value ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer", fontWeight: salary === t.value ? 700 : 400 }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 業態 */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>業態</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {BUSINESS_MODELS.map(m => (
                    <button key={m.key} onClick={() => setParam("biz_model", bizModel === m.key ? "" : m.key)}
                      style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, border: `1.5px solid ${bizModel === m.key ? "var(--purple)" : "var(--line)"}`, background: bizModel === m.key ? "var(--purple-soft)" : "#fff", color: bizModel === m.key ? "var(--purple)" : "var(--ink-soft)", cursor: "pointer", fontWeight: bizModel === m.key ? 700 : 400 }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 技術スタック */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>技術スタック</div>
                {techStack.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                    {techStack.map((t) => (
                      <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "var(--royal)", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                        {t}
                        <button type="button" onClick={() => setTechStack(techStack.filter((x) => x !== t))} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1, opacity: 0.8 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                {TECH_STACK_CATEGORIES.map((cat) => (
                  <div key={cat.label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>{cat.label}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {cat.items.map((tech) => {
                        const active = techStack.includes(tech);
                        return (
                          <button key={tech} type="button"
                            onClick={() => setTechStack(active ? techStack.filter((t) => t !== tech) : [...techStack, tech])}
                            style={{ padding: "5px 10px", borderRadius: 999, fontSize: 12, border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`, background: active ? "var(--royal-50)" : "#fff", color: active ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                            {tech}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* 詳細条件アコーディオン */}
              <MobileDetailSection
                industryId={industryId} empType={empType} companyStage={companyStage}
                industries={industries} setParam={setParam} onCompanyStageChange={setCompanyStage}
              />
            </div>

            {/* フッターボタン */}
            <div style={{ padding: "12px 20px 24px", borderTop: "1px solid var(--line)", display: "flex", gap: 10 }}>
              <button
                onClick={() => { setTechStack([]); setCompanyStage(""); router.replace("/jobs"); setFilterSheetOpen(false); }}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid var(--line)", background: "#fff", fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", cursor: "pointer" }}
              >
                リセット
              </button>
              <button
                onClick={() => setFilterSheetOpen(false)}
                style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                {paged.length}件を見る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フィルターピル ドロップダウン (position: fixed でoverflow clipを回避) */}
      {openFilter && pillAnchor && (
        <div className="jobs-pill-menu" style={{ position: "fixed", top: pillAnchor.top, left: pillAnchor.left, zIndex: 1200 }}>
          {openFilter === "category" && (
            <>
              <button className={`jobs-pill-item${!category ? " selected" : ""}`} onClick={() => { setParam("category", ""); setOpenFilter(null); }}>すべて</button>
              {parentRoles.map((r) => (
                <button key={r.id} className={`jobs-pill-item${category === r.id ? " selected" : ""}`}
                  onClick={() => { setParam("category", r.id); setOpenFilter(null); }}
                >{r.name}</button>
              ))}
            </>
          )}
          {openFilter === "work_style" && (
            <>
              {(["", "フルリモート", "ハイブリッド", "出社"] as const).map((v) => (
                <button key={v} className={`jobs-pill-item${work_style === v ? " selected" : ""}`}
                  onClick={() => { setParam("work_style", v); setOpenFilter(null); }}
                >{v || "すべて"}</button>
              ))}
            </>
          )}
          {openFilter === "salary" && (
            <>
              <button className={`jobs-pill-item${!salary ? " selected" : ""}`} onClick={() => { setParam("salary", ""); setOpenFilter(null); }}>すべて</button>
              {SALARY_PILL_TIERS.map((t) => (
                <button key={t.value} className={`jobs-pill-item${salary === t.value ? " selected" : ""}`}
                  onClick={() => { setParam("salary", t.value); setOpenFilter(null); }}
                >{t.label}</button>
              ))}
            </>
          )}
          {openFilter === "empType" && (
            <>
              {(["", "正社員", "業務委託", "副業"] as const).map((v) => (
                <button key={v} className={`jobs-pill-item${empType === v ? " selected" : ""}`}
                  onClick={() => { setParam("emp_type", v); setOpenFilter(null); }}
                >{v || "すべて"}</button>
              ))}
            </>
          )}
          {openFilter === "prefecture" && (
            <>
              <button className={`jobs-pill-item${!prefecture ? " selected" : ""}`} onClick={() => { setParam("prefecture", ""); setOpenFilter(null); }}>すべて</button>
              {availablePrefectures.map((p) => (
                <button key={p} className={`jobs-pill-item${prefecture === p ? " selected" : ""}`}
                  onClick={() => { setParam("prefecture", p); setOpenFilter(null); }}
                >{p}</button>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
