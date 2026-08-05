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
import { BUSINESS_MODELS } from "@/lib/constants/businessModels";
import { TECH_STACK_CATEGORIES } from "@/lib/techStack";
import { INDUSTRY_GROUPS } from "@/lib/search/industryGroups";
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


function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return "給与非公開";
  const fmt = (v: number) => v.toLocaleString("ja-JP");
  if (min && max) return `年収${fmt(min)}万円〜${fmt(max)}万円`;
  if (max) return `年収〜${fmt(max)}万円`;
  return `年収${fmt(min!)}万円〜`;
}
function hasSalaryData(min: number | null, max: number | null): boolean {
  return !!(min || max);
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




// ─── マッチ理由テキスト（フィルター文脈ベース）────────────────────────────────

function computeMatchReason(
  job: Job,
  filters: { category: string; dept: string; salary: string; prefecture: string; q: string },
  parentRoles: { id: string; name: string }[],
): string | null {
  const { category, dept, prefecture, q } = filters;
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
    return `${prefecture}勤務の募集`;
  }
  // キーワード検索
  if (q.trim().length >= 1) return `「${q.trim()}」の検索結果`;
  return null;
}

// ─── LinkedIn 型縦リスト行 ────────────────────────────────────────────────────

function JobListItem({
  job, companyMap, initialBookmarked = false, isApplied = false,
  reviewSummary, matchReason: _matchReason,
}: {
  job: Job;
  companyMap: Map<string, Company>;
  initialBookmarked?: boolean;
  isApplied?: boolean;
  reviewSummary?: CompanyReviewSummary;
  matchReason?: string | null;
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
        target="_blank"
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
              // ⚠️ 非公開企業には飛ばさない（本番で404）。dev では getCompanies が
              //    is_published で絞らないので、ここで見る必要がある
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (company.is_published) router.push(`/companies/${company.slug ?? company.id}`); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (company.is_published) router.push(`/companies/${company.slug ?? company.id}`); } }}
              className="company-name-link"
              style={{ fontSize: 14, color: "var(--royal)", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(company as any).brand_name ?? company.name}
            </span>
            {isApplied && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", flexShrink: 0 }}>
                ✓ 応募済み
              </span>
            )}
          </div>

          {/* キャッチコピー1行 — LinkedIn の job summary 相当 */}
          {job.highlight && (
            <div style={{
              fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.5,
              marginBottom: 5,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {job.highlight}
            </div>
          )}


          {/* 行4: 勤務地 · 勤務形態 · 年収 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {job.location && (
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 2 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {job.location.split("・")[0].replace(/[（(][^）)]*[）)]/g, "").trim()}
              </span>
            )}
            {job.work_style && job.location && (
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--line)", userSelect: "none" }}>·</span>
            )}
            {job.work_style && (
              <span style={{
                fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 3,
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
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--line)", userSelect: "none" }}>·</span>
            )}
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700,
              color: hasSalaryData(job.salary_min, job.salary_max) ? "var(--success)" : "var(--ink-mute)",
            }}>
              {formatSalary(job.salary_min, job.salary_max)}
            </span>
            {reviewSummary && reviewSummary.count >= 1 && (
              <>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--line)", userSelect: "none" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: "#B45309", fontWeight: 600 }}>
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
          target="_blank"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
            padding: "8px 6px", borderRadius: 7,
            backgroundColor: "#002366", color: "#fff",
            fontSize: 12, fontWeight: 700, textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          詳細
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </a>

        {/*
          応募する。
          ⚠️ 2026-08-05 に、ここにあった面談ボタンと入れ替えた。位置と意匠は引き継いでいる。

          ── なぜ一覧に応募を置くか ────────────────────────────────────────
          OPINIO は「転職を前提にしない / 応募する前に調べる」を掲げているので、
          一覧をスキャンした段階で応募を促すのは姿勢と少しずれる。
          それでも置くのは、求人があるのに応募できないほうが不親切だからで、
          「調べてから決める」は応募を隠すことではなく急かさないこと、と整理した。
          詳細ページ（/jobs/[id]）は面談を主・応募を従のままにしてある。
          一覧＝行動 / 詳細＝検討 で住み分ける。

          ── なぜ面談を外したか ────────────────────────────────────────────
          ① 4つ縦積みにすると 104px のパネルが +38px 伸び、カードの主役が
             ボタンになる（18件で +684px）
          ② ここの面談ボタンは company.is_published しか見ておらず、
             accepting_casual_meetings = false の企業でも表示していた。
             押すと申込ページで「現在受付していません」に着地する
             （2026-08-05 時点で該当0社だが、企業が1社でも false にした瞬間に破綻する）
          面談の導線は /jobs/[id] と /companies/[id] に残してある。

          ⚠️ 企業側のフラグで出し分けないこと。この一覧に出ている求人は
             status = 'published' だけなので、応募先は必ず存在する。
          ⚠️ 応募済みかどうかでも出し分けない。一覧で引くとクエリが重くなる。
             既に応募していれば、押した先で「すでに応募しています」が出る
             （API が 409 を返し、ApplicationForm が文言を出す）。
        */}
        <a
          href={`/jobs/${job.slug ?? job.id}/apply`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
            padding: "8px 6px", borderRadius: 7,
            backgroundColor: "#FFF7ED", color: "#C2410C",
            border: "1.5px solid #FDBA74",
            fontSize: 12, fontWeight: 700, textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
          応募
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
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            whiteSpace: "nowrap",
            transform: bookmarkAnim ? "scale(1.05)" : "scale(1)",
            transition: "all 0.2s",
          }}
        >
          <Heart size={11} strokeWidth={2} style={{ color: bookmarked ? "#e24b4a" : "#F87171", fill: bookmarked ? "#e24b4a" : "none", flexShrink: 0 }} />
          {bookmarked ? "保存済" : "保存"}
        </button>
      </div>
    </div>
  );
}


// ─── Desktop Sidebar Filters ──────────────────────────────────────────────────

/*
  ⚠️ 型には残っているのに分割代入で受け取っていない props がある。
     bizModel / techStack / onTechStackChange / industries / industryId /
     onCompanyStageChange の7つで、**サイドバーにこれらのUIが無い**ため。
     絞り込みロジック自体は上位（1060行〜）に実装済みで、URLパラメータやモバイルの
     フィルタシートからは効く。サイドバーに足すときはここで受け取ればよい。
  ⚠️ 型からは消さないこと。消すと呼び出し側の受け渡しも消えて、
     サイドバーに足すときに配線を1から作り直すことになる。
*/
function SidebarFilters({
  parentRoles, category, workStyle, salary, empType, prefecture,
  companyStage, bizModel, techStack, onTechStackChange,
  availablePrefectures, setParam, hasFilter, q, onReset,
  roleCounts,
  toggleParam: toggleParamFn, toggleStage,
  industry,
}: {
  parentRoles: { id: string; name: string }[];
  category: string; workStyle: string; salary: string; empType: string; prefecture: string;
  bizModel: string; industry: string;
  companyStage: string; onCompanyStageChange: (v: string) => void;
  techStack: string[]; onTechStackChange: (v: string[]) => void;
  availablePrefectures: string[];
  setParam: (key: string, value: string) => void;
  hasFilter: boolean; q: string; onReset: () => void;
  roleCounts?: Map<string, number>;
  toggleParam: (key: string, value: string, current: string) => void;
  toggleStage: (value: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["industry", "prefecture", "salary", "kodawari", "emptype", "stage", "bizmodel", "tech"]));
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

  function SectionHeader({ label, sectionKey, hasActive }: { label: string; sectionKey: string; hasActive?: boolean }) {
    const isOpen = !collapsed.has(sectionKey);
    return (
      <button type="button" onClick={() => toggleSection(sectionKey)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: hasActive ? "var(--royal-50)" : "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: hasActive ? "var(--royal)" : "var(--ink)", letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: 6 }}>
          {hasActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />}
          {label}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" stroke={hasActive ? "var(--royal)" : "var(--ink-mute)"} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    );
  }

  function CheckItem({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
    return (
      <label
        onClick={(e) => { e.preventDefault(); onClick(); }}
        style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 14px", cursor: "pointer", userSelect: "none" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLLabelElement).style.background = "#f8fafc"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLLabelElement).style.background = "transparent"; }}
      >
        <span style={{
          width: 17, height: 17, borderRadius: 4, border: `2px solid ${active ? "var(--royal)" : "#CBD5E1"}`,
          background: active ? "var(--royal)" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.1s",
        }}>
          {active && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l2.5 3L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        <span style={{ fontSize: 13, color: active ? "var(--ink)" : "var(--ink-soft)", fontWeight: active ? 600 : 400, flex: 1 }}>
          {label}
        </span>
        {count !== undefined && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>({count})</span>
        )}
      </label>
    );
  }

  const { business, tech } = getVisibleRoles(parentRoles);
  const sortedRoles = [
    ...business.filter(r => r.name !== "その他"),
    ...tech,
    ...business.filter(r => r.name === "その他"),
  ];

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--line)", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)", display: "flex", flexDirection: "column" }}>

      {/* ── 1. 職種 ── */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="職種" sectionKey="category" hasActive={categorySet.size > 0} />
        {!collapsed.has("category") && (
          <div style={{ padding: "2px 4px 10px", display: "flex", flexDirection: "column", gap: 1 }}>
            {sortedRoles.map((role) => {
              const isActive = categorySet.has(role.id);
              const rc = getRoleColor(role.name);
              return (
                <button key={role.id} type="button" onClick={() => toggleParamFn("category", role.id, category)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${isActive ? rc.color : "transparent"}`, background: isActive ? rc.bg : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.1s", width: "100%" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: rc.color, flexShrink: 0, opacity: isActive ? 1 : 0.4 }} />
                  <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? rc.color : "var(--ink)", flex: 1 }}>{role.name}</span>
                  {roleCounts?.get(role.id) ? <span style={{ fontSize: 12, fontWeight: 500, color: isActive ? rc.color : "var(--ink-mute)", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>({roleCounts.get(role.id)})</span> : null}
                  {isActive && <svg style={{ flexShrink: 0 }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={rc.color} strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 2. 業種 ── */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="業種" sectionKey="industry" hasActive={!!industry} />
        {!collapsed.has("industry") && (
          <div style={{ paddingBottom: 8 }}>
            {INDUSTRY_GROUPS.map((g) => (
              <CheckItem key={g.key} label={g.label} active={industry === g.key}
                onClick={() => setParam("industry", industry === g.key ? "" : g.key)} />
            ))}
          </div>
        )}
      </div>

      {/* ── 3. 勤務地 ── */}
      {availablePrefectures.length > 1 && (
        <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
          <SectionHeader label="勤務地" sectionKey="prefecture" hasActive={!!prefecture} />
          {!collapsed.has("prefecture") && (
            <div style={{ paddingBottom: 8, maxHeight: 180, overflowY: "auto" }}>
              {availablePrefectures.map((p) => (
                <CheckItem key={p} label={p} active={prefecture === p}
                  onClick={() => setParam("prefecture", prefecture === p ? "" : p)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 4. 年収 ── */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="年収" sectionKey="salary" hasActive={!!salary} />
        {!collapsed.has("salary") && (
          <div style={{ padding: "4px 14px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 6 }}>下限年収</div>
            <select value={salary} onChange={(e) => setParam("salary", e.target.value)}
              style={{ width: "100%", height: 36, padding: "0 10px", border: `1.5px solid ${salary ? "var(--royal)" : "var(--line)"}`, borderRadius: 8, fontSize: 13, background: "#fff", color: salary ? "var(--ink)" : "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit", outline: "none" }}
            >
              <option value="">指定なし</option>
              {SALARY_PILL_TIERS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── 5. こだわり条件 ── */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="こだわり条件" sectionKey="kodawari"
          hasActive={workStyleSet.size > 0 || companyStageSet.has("foreign")} />
        {!collapsed.has("kodawari") && (
          <div style={{ paddingBottom: 10 }}>
            <div style={{ padding: "6px 14px 4px", fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.04em" }}>働き方</div>
            {[
              { value: "フルリモート", label: "フルリモート" },
              { value: "リモート可", label: "リモート可" },
              { value: "ハイブリッド", label: "ハイブリッド" },
            ].map(({ value, label }) => (
              <CheckItem key={value} label={label} active={workStyleSet.has(value)}
                onClick={() => toggleParamFn("work_style", value, workStyle)} />
            ))}
            <div style={{ padding: "8px 14px 4px", fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.04em" }}>企業特性</div>
            <CheckItem label="外資系" active={companyStageSet.has("foreign")}
              onClick={() => toggleStage("foreign")} />
          </div>
        )}
      </div>

      {/* ── 6. 雇用形態 ── */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="雇用形態" sectionKey="emptype" hasActive={empTypeSet.size > 0} />
        {!collapsed.has("emptype") && (
          <div style={{ paddingBottom: 8 }}>
            {["正社員", "業務委託", "副業"].map((v) => (
              <CheckItem key={v} label={v} active={empTypeSet.has(v)}
                onClick={() => toggleParamFn("emp_type", v, empType)} />
            ))}
          </div>
        )}
      </div>

      {/* ── 7. 企業ステージ ── */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="企業ステージ" sectionKey="stage"
          hasActive={companyStageSet.has("listed") || companyStageSet.has("unicorn") || companyStageSet.has("startup")} />
        {!collapsed.has("stage") && (
          <div style={{ paddingBottom: 8 }}>
            {[
              { key: "listed",  label: "上場企業" },
              { key: "unicorn", label: "🦄 ユニコーン" },
              { key: "startup", label: "スタートアップ" },
            ].map(({ key, label }) => (
              <CheckItem key={key} label={label} active={companyStageSet.has(key)}
                onClick={() => toggleStage(key)} />
            ))}
          </div>
        )}
      </div>

      {/* ── 8. 業態 ── */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="業態" sectionKey="bizmodel" hasActive={!!bizModel} />
        {!collapsed.has("bizmodel") && (
          <div style={{ paddingBottom: 8 }}>
            {BUSINESS_MODELS.map((m) => (
              <CheckItem key={m.key} label={m.label} active={bizModel === m.key}
                onClick={() => setParam("biz_model", bizModel === m.key ? "" : m.key)} />
            ))}
          </div>
        )}
      </div>

      {/* ── 9. 技術スタック（複数選択・AND） ── */}
      <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <SectionHeader label="技術スタック" sectionKey="tech" hasActive={techStack.length > 0} />
        {!collapsed.has("tech") && (
          <div style={{ paddingBottom: 8 }}>
            {TECH_STACK_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <div style={{ padding: "6px 14px 4px", fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.04em" }}>{cat.label}</div>
                {cat.items.map((tech) => (
                  <CheckItem key={tech} label={tech} active={techStack.includes(tech)}
                    onClick={() => onTechStackChange(
                      techStack.includes(tech) ? techStack.filter((t) => t !== tech) : [...techStack, tech]
                    )} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── フッター: 検索する ── */}
      <div style={{ padding: "12px 14px", background: "#fff" }}>
        <button
          type="button"
          onClick={() => document.getElementById("jobs-results-top")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 8,
            background: "var(--royal)", color: "#fff",
            border: "none", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "0.02em",
          }}
        >
          検索する
        </button>
        {(hasFilter || q) && (
          <button type="button" onClick={onReset}
            style={{ display: "block", width: "100%", marginTop: 8, padding: "5px 0", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", textAlign: "center" }}
          >
            検索条件をリセットする
          </button>
        )}
      </div>
    </div>
  );
}

// ─── モバイル「詳細条件」アコーディオン ────────────────────────────────────────────

/*
  モバイルのフィルタシート内「詳細条件」アコーディオン。
  シートの他のセクション（職種 / 勤務形態 / 年収下限 / 業態 / 技術スタック）とは
  重複しない条件だけを置く。ここが業種・雇用形態・企業ステージの唯一のモバイル導線。

  ⚠️ 業種は industry（INDUSTRY_GROUPS のグループキー）を使うこと。
     2026-08-06 まで ow_industries マスタの industry_id を使っており、
     デスクトップのサイドバー（industry）とモバイルで別の業種UIになっていた。
     選択肢も粒度も違うので、片方で絞ってもう片方を見ると噛み合わない。
*/
function MobileDetailSection({
  industry, prefecture, empType, companyStage, availablePrefectures, setParam, onCompanyStageChange,
}: {
  industry: string; prefecture: string; empType: string; companyStage: string;
  availablePrefectures: string[];
  setParam: (key: string, value: string) => void;
  onCompanyStageChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasActive = !!industry || !!prefecture || !!empType || !!companyStage;
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
        {/* 業種 — サイドバーと同じ INDUSTRY_GROUPS / 同じ URL パラメータ */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>業種</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {INDUSTRY_GROUPS.map((g) => {
              const active = industry === g.key;
              return (
                <button key={g.key} type="button" onClick={() => setParam("industry", active ? "" : g.key)}
                  style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`, background: active ? "var(--royal-50)" : "#fff", color: active ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
        {/*
          都道府県 — ⚠️ 2026-08-06 に追加。
          それまでモバイルではピル行の横スクロールでしか到達できず、375px では
          「フェーズ / 業種 / 都道府県 / 勤務形...」まで見えて残りが隠れていた。
          ピル行は残してある（そちらで選んでも同じ prefecture を書く）。
          ⚠️ 選択肢は実データにある都道府県だけ（availablePrefectures）。
             出す条件も 1件超のときだけ、とサイドバー（勤務地セクション）に揃えている。
             1県しか無いときに1択のフィルタを出しても選ぶ意味がないため。
             2026-08-06 時点は全18件が東京都なので、デスクトップ・モバイルとも出ない。
        */}
        {availablePrefectures.length > 1 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>勤務地</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {availablePrefectures.map((p) => {
                const active = prefecture === p;
                return (
                  <button key={p} type="button" onClick={() => setParam("prefecture", active ? "" : p)}
                    style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`, background: active ? "var(--royal-50)" : "#fff", color: active ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 雇用形態 */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>雇用形態</div>
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
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>企業ステージ</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {([
              { key: "listed",  label: "上場",           color: "var(--success)",  bg: "var(--success-soft)" },
              { key: "unicorn", label: "🦄 ユニコーン",  color: "var(--purple)",   bg: "var(--purple-soft)" },
              { key: "startup", label: "スタートアップ", color: "var(--royal)",    bg: "var(--royal-50)" },
              { key: "foreign", label: "外資系",           color: "#1D4ED8",         bg: "#EFF6FF" },
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
  /** ow_role_aliases。roleIds には祖先まで展開済み（queries.ts の getRoleAliases 参照） */
  roleAliases?: { alias: string; roleIds: string[] }[];
  industries?: { id: string; parent_id: string | null; name: string; slug: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? "";
  const bizOnly = searchParams.get("biz_only") === "1";
  const dept = searchParams.get("dept") ?? "";       // 後方互換 (新規 URL では未使用)
  const work_style = searchParams.get("work_style") ?? "";
  const salary = searchParams.get("salary") ?? "";
  /* ⚠️ 2026-08-06 に salary_max を削除した。指定するUIがサイドバーにもピル行にも
        フィルタシートにも無く、URLを手で書く以外に到達できなかった。
        年収は下限指定（salary・8段階）が自然な軸なのでそちらに一本化する。
        レンジ指定が必要になったら、ピルを「400〜600万」型に作り替えるところから設計すること。 */
  const industry = searchParams.get("industry") ?? "";
  /* ⚠️ 2026-08-06 に industry_id を削除した。指定できるのは MobileDetailSection だけで、
        そこをデスクトップと同じ industry（INDUSTRY_GROUPS のグループキー）に揃えた結果、
        到達手段が無くなったため。外部から ?industry_id= を作るリンクも存在しない。
        ow_industries マスタで絞りたくなったら、まず industry との二本立てをどうするか決めること。 */
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
  // LP のヒーロー検索から ?q= で飛んでくるため URL を初期値にする
  const [q, setQ] = useState(searchParams.get("q") ?? "");
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
  /*
    技術スタック（複数選択・AND）。
    ⚠️ 2026-08-06 に useState から URL パラメータに移した。
       それまで state だけで持っていたため、リロードでも共有でも消えており、
       他のフィルタと挙動が違った（絞り込んだ結果のURLを人に送ると別の結果が出る）。
    ⚠️ 区切りはカンマ。emp_type / work_style / category と同じ形式に揃えている。
  */
  const techStack = useMemo(
    () => (searchParams.get("tech_stack") ?? "").split(",").filter(Boolean),
    [searchParams],
  );
  const setTechStack = (next: string[]) => setParam("tech_stack", next.join(","));

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

  const searchResult = useMemo(() => {
    let list = [...allJobs];
    let ignoredTerms: string[] = [];

    if (q.trim()) {
      /*
        語ごとに絞り込む（2026-08-03）。

        以前はクエリ全体を1語として includes() していたため、
        「エンタープライズ企業 営業」が丸ごと1つの文字列として扱われ 0件 になっていた。
        /companies?q= 側（lib/search/companies.ts）は既に空白区切りの AND 検索なので、
        そちらに揃える。

        ただし単純な AND だと、こちらで解釈できない語が1つでも混ざると 0件 になる。
        「エンタープライズ企業」は企業規模の言い換えで、今はまだ辞書に無い。
        そこで **どの求人にも当たらなかった語は絞り込みから外す** ことにした。
        結果として「解釈できた語だけを AND する」挙動になる。

          エンタープライズ企業 営業 → 「エンタープライズ企業」は0件なので除外
                                    → 「営業」だけで絞る
          営業 エンジニア           → どちらも当たるので AND（＝セールスエンジニア系）
          ぬるぽ                    → 全語が当たらない → 0件（黙って全件返さない）

        外した語は ignoredTerms に入れ、画面に「絞り込みに使わなかった語」として出す。
        黙って無視すると、入力した条件が効いていないことに気づけないため。
      */
      const words = q.trim().toLowerCase().split(/[\s　]+/).filter(Boolean);

      const jobRoleIds = (j: (typeof list)[number]) =>
        j.roleIds ?? (j.role_category_id ? [j.role_category_id] : []);

      const matchesText = (j: (typeof list)[number], w: string) => {
        const co = companyMap.get(j.company_id);
        return (
          j.role.toLowerCase().includes(w) ||
          (co?.name ?? "").toLowerCase().includes(w) ||
          (co?.brand_name ?? "").toLowerCase().includes(w) ||
          (co?.slug ?? "").toLowerCase().includes(w) ||
          j.highlight.toLowerCase().includes(w)
        );
      };

      /*
        辞書は2段階で当てる。roleIds[0] がエイリアスの指す職種そのもの、
        以降が祖先（queries.ts の getRoleAliases で展開済み）。

        第1段: 職種そのもので当てる。
        第2段: 第1段が全滅したときだけ祖先まで広げる。

        いきなり祖先まで広げると精度が落ちる。たとえば「エンジニア」は
        エイリアス「セールスエンジニア」経由で 営業 まで遡れてしまい、
        純粋な AE 求人まで巻き込む（ow_roles 上プリセールスは営業配下のため）。
        求人が具体職種でタグ付けされていれば第1段で足り、
        粗くしかタグ付けされていない場合だけ祖先に頼る、という順序にする。
      */
      const matchByAlias = (w: string, pool: typeof list) => {
        const hits = roleAliases.filter((a) => a.alias.toLowerCase().includes(w));
        if (hits.length === 0) return null;

        const own = new Set(hits.map((a) => a.roleIds[0]).filter(Boolean));
        const exact = pool.filter((j) => jobRoleIds(j).some((id) => own.has(id)));
        if (exact.length > 0) return exact;

        const withAncestors = new Set(hits.flatMap((a) => a.roleIds));
        const loose = pool.filter((j) => jobRoleIds(j).some((id) => withAncestors.has(id)));
        return loose.length > 0 ? loose : null;
      };

      const ignored: string[] = [];
      for (const w of words) {
        const byText = list.filter((j) => matchesText(j, w));
        const byAlias = matchByAlias(w, list) ?? [];
        // 本文一致と辞書一致の和集合
        const merged = byText.length || byAlias.length
          ? Array.from(new Set([...byText, ...byAlias]))
          : [];

        if (merged.length === 0) {
          ignored.push(w);   // 解釈できなかった語。絞り込みには使わない
          continue;
        }
        list = merged;
      }
      // 全語が解釈できなかったときだけ 0件 にする
      if (ignored.length === words.length) list = [];
      ignoredTerms = ignored;
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


    if (industry) {
      const companyIds = companies
        .filter((c) => normalizeIndustry(c.industry) === industry)
        .map((c) => c.id);
      list = list.filter((j) => companyIds.includes(j.company_id));
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
    } else if (sort === "employees") {
      // 社員数順（多い企業の求人が上位）
      list = [...list].sort((a, b) => {
        const aE = companyMap.get(a.company_id)?.employee_count ?? 0;
        const bE = companyMap.get(b.company_id)?.employee_count ?? 0;
        return bE - aE;
      });
    } else if (sort === "disclosure") {
      // 開示充実順: 年収+キャッチコピー+説明の充実度スコア
      const score = (j: Job) => {
        let s = 0;
        if (hasSalaryData(j.salary_min, j.salary_max)) s += 3;
        if (j.highlight) s += 2;
        if (j.overview && j.overview.length > 100) s += 1;
        if (j.required_skills && j.required_skills.length > 0) s += 1;
        return s;
      };
      list = [...list].sort((a, b) => score(b) - score(a));
    } else {
      // デフォルト(新着順): 給与記載あり優先、次に更新日
      list = [...list].sort((a, b) => {
        const aHas = hasSalaryData(a.salary_min, a.salary_max) ? 0 : 1;
        const bHas = hasSalaryData(b.salary_min, b.salary_max) ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        return a.updated_days_ago - b.updated_days_ago;
      });
    }

    return { list, ignoredTerms };
  }, [allJobs, q, category, categorySet, dept, work_style, workStyleSet, salary, bizModel, industry, prefecture, empType, empTypeSet, companyStage, companyStageSet, techStack, sort, companies, companyMap, roleAliases, industries]);

  const filtered = searchResult.list;
  const ignoredTerms = searchResult.ignoredTerms;

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
  const filterKey = [category, dept, work_style, salary, bizModel, industry, prefecture, empType, sort, q, bizOnly, companyStage, techStack.join(",")].join("|");
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

  const hasFilter = !!(category || dept || work_style || salary || bizModel || industry || prefecture || empType || companyStage || techStack.length || bizOnly);


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
      <h1 className="sr-only">IT/SaaS 募集を探す</h1>

      {/* ── 検索バー + フィルターピル（sticky、企業ページと同構造） ── */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--line)",
          padding: "20px 0 0",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          position: "sticky",
          top: 60,
          zIndex: 30,
        }}
      >
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">

          {/* 検索バー行（企業ページ .csb-bar と同等） */}
          <div ref={filterPillsRef} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "12px 0 14px" }}>

            {/* 検索インプット */}
            <div ref={searchBarRef} style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
              <div role="search" style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#fff", border: "1.5px solid #e6e9ef", borderRadius: 999,
                padding: "0 14px", transition: "border-color 0.15s, box-shadow 0.15s",
              }}
                onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--royal)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(0,35,102,0.08)"; }}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { (e.currentTarget as HTMLDivElement).style.borderColor = "#e6e9ef"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; } }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b95a3" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="search"
                  aria-label="募集を検索"
                  placeholder="職種・企業名で検索..."
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
                  onFocus={() => setShowSuggest(true)}
                  onKeyDown={(e) => { if (e.key === "Escape") setShowSuggest(false); }}
                  style={{
                    flex: 1, border: "none", outline: "none",
                    fontSize: 13.5, color: "var(--ink)", background: "transparent",
                    padding: "9px 0", minWidth: 0,
                  }}
                />
                {q && (
                  <button type="button" onClick={() => { setQ(""); setShowSuggest(false); }} aria-label="検索をクリア"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 16, lineHeight: 1, padding: 2, display: "flex", alignItems: "center", flexShrink: 0 }}
                  >×</button>
                )}
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
                        {s.sub && <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sub}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* フィルターピル群（企業ページと同じ位置・同じスタイル） */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none" }}>

              {/* フェーズ ピル */}
              <button type="button"
                className={`jobs-pill${companyStageSet.has("listed") || companyStageSet.has("unicorn") || companyStageSet.has("startup") ? " active" : ""}`}
                style={{ flexShrink: 0 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (openFilter === "phase") { setOpenFilter(null); return; }
                  setPillAnchor({ top: r.bottom + 6, left: r.left });
                  setOpenFilter("phase");
                }}
              >
                {companyStageSet.has("listed") ? "上場" : companyStageSet.has("unicorn") ? "ユニコーン" : companyStageSet.has("startup") ? "スタートアップ" : "フェーズ"} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              {/* 業種 ピル */}
              <button type="button" className={`jobs-pill${industry ? " active" : ""}`} style={{ flexShrink: 0 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (openFilter === "industry") { setOpenFilter(null); return; }
                  setPillAnchor({ top: r.bottom + 6, left: r.left });
                  setOpenFilter("industry");
                }}
              >
                {INDUSTRY_GROUPS.find((g) => g.key === industry)?.label ?? "業種"} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              {/* 都道府県 ピル */}
              <button type="button" className={`jobs-pill${prefecture ? " active" : ""}`} style={{ flexShrink: 0 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  if (openFilter === "prefecture") { setOpenFilter(null); return; }
                  setPillAnchor({ top: r.bottom + 6, left: r.left });
                  setOpenFilter("prefecture");
                }}
              >
                {prefecture || "都道府県"} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
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
                {work_style || "勤務形態"} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
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
                {salary ? (SALARY_PILL_TIERS.find(t => t.value === salary)?.label ?? "年収") : "年収"} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              {/* 外資系 トグルピル */}
              <button type="button"
                className={`jobs-pill${companyStageSet.has("foreign") ? " active" : ""}`}
                onClick={() => {
                  const set = new Set(companyStage ? companyStage.split(",") : []);
                  if (set.has("foreign")) set.delete("foreign"); else set.add("foreign");
                  setCompanyStage(Array.from(set).join(","));
                }}
                style={{ flexShrink: 0 }}
              >
                外資系{companyStageSet.has("foreign") && <span style={{ fontSize: 12, marginLeft: 3 }}>✕</span>}
              </button>

              {/* 面談受付中 トグルピル */}
              <button type="button"
                className={`jobs-pill-hiring${sort === "meeting" ? " active" : ""}`}
                onClick={() => setSort(sort === "meeting" ? "updated" : "meeting")}
                style={{ flexShrink: 0 }}
              >
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: sort === "meeting" ? "#fff" : "var(--warm)", marginRight: 5, verticalAlign: "middle", flexShrink: 0 }} />
                面談受付中
              </button>

              {(hasFilter || q) && (
                <button type="button" onClick={() => { setQ(""); setCompanyStage(""); setTechStack([]); router.replace("/jobs"); }}
                  style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: "5px 2px", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0 }}
                >✕ リセット</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── ソートバー ── */}
      <div
        ref={filterBarRef}
        className="jobs-mobile-filterbar"
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }} className="px-5 py-3 md:px-12">

          {/* 解釈できなかった検索語の通知。
              「エンタープライズ企業 営業」のように、こちらで扱えない語が混ざったとき
              その語は絞り込みから外している。黙って外すと、入力した条件が効いていない
              ことに気づけないので明示する。 */}
          {ignoredTerms.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
              background: "var(--warm-soft)", border: "1px solid #FDE68A",
              borderRadius: 10, padding: "8px 14px",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>
                {ignoredTerms.map((t) => `「${t}」`).join("")}
                は絞り込みに使えませんでした
              </span>
              {/* 全語が使えなかったときは「残りの語」が存在しないので出さない */}
              {ignoredTerms.length < q.trim().split(/[\s　]+/).filter(Boolean).length && (
                <span style={{ fontSize: 12, fontWeight: 500, color: "#92400E", opacity: 0.85 }}>
                  残りの語だけで検索しています
                </span>
              )}
            </div>
          )}

          {/* 並び替えバー */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            background: "#fff", borderRadius: 12, border: "1px solid var(--line)",
            padding: "10px 16px", boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
          }}>
            {/* 左: 並び替えピル */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--ink-soft)", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M7 12h10M11 18h2"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>並び替え</span>
              </div>
              <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0 }} />
              <div style={{ display: "flex", gap: 6, alignItems: "center", overflowX: "auto", scrollbarWidth: "none" }}>
                {([
                  { value: "updated",     label: "新着順",     icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg> },
                  { value: "salary",      label: "年収順",     icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
                  { value: "employees",   label: "社員数順",   icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                  { value: "disclosure",  label: "開示充実順", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
                ] as const).map((opt) => {
                  const active = sort === opt.value;
                  return (
                    <button key={opt.value} type="button" onClick={() => setSort(opt.value)}
                      className={`jobs-sort-btn${active ? " active" : ""}`}
                    >
                      {active ? <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> : opt.icon}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 右: グルーピング + 件数 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {maxPerCompany > 3 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setGroupByCompany(v => !v); setDisplayCount(PER_PAGE); }}
                    className={`jobs-sort-btn${groupByCompany ? " active" : ""}`}
                    title="同一企業の求人を1社あたり3件に絞る"
                  >
                    {groupByCompany ? "✓ " : ""}1社3件まで
                  </button>
                  {groupByCompany && hiddenByGrouping > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#C2410C", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                      {hiddenByGrouping}件非表示
                      <button type="button" onClick={() => setGroupByCompany(false)} style={{ background: "none", border: "none", color: "#C2410C", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline" }}>全表示</button>
                    </span>
                  )}
                </>
              )}
              <div style={{ width: 1, height: 20, background: "var(--line)" }} />
              <span aria-live="polite" style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
                <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "Inter, sans-serif", fontSize: 16 }}>{filteredForDisplay.length}</strong>
                <span style={{ marginLeft: 2 }}>件</span>
                {(hasFilter || q) && <span style={{ fontSize: 12, color: "var(--success)", marginLeft: 6, fontWeight: 600 }}>絞込中</span>}
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
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    border: `1.5px solid ${active ? rc.color : "#e2e8f0"}`,
                    background: active ? rc.bg : "#fff",
                    color: active ? rc.color : "var(--ink-soft)",
                    cursor: "pointer", whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {role.name}
                  {roleCounts.get(role.id) ? <span style={{ fontSize: 12, marginLeft: 4, opacity: 0.7 }}>({roleCounts.get(role.id)})</span> : null}
                </button>
              );
            })}
          </div>

          {/* アクティブフィルター (optional row 4) */}
          {hasFilter && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2, paddingBottom: 2, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap", fontWeight: 500 }}>絞り込み中:</span>
              {category && (() => {
                const r = parentRoles.find(r => r.id === category);
                const rc = r ? getRoleColor(r.name) : { color: "var(--royal)", bg: "var(--royal-50)" };
                return r ? (
                  <button key="cat" type="button" onClick={() => setParam("category", "")} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 100,
                    background: rc.bg, border: `1.5px solid ${rc.color}`,
                    color: rc.color, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    職種: {r.name} <span style={{ fontSize: 12, opacity: 0.8 }}>✕</span>
                  </button>
                ) : null;
              })()}
              {work_style && (
                <button key="ws" type="button" onClick={() => setParam("work_style", "")} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 100,
                  background: "var(--success-soft)", border: "1.5px solid #6EE7B7",
                  color: "#065F46", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  勤務形態: {work_style} <span style={{ fontSize: 12, opacity: 0.8 }}>✕</span>
                </button>
              )}
              {salary && (() => {
                const tier = SALARY_PILL_TIERS.find(t => t.value === salary);
                return tier ? (
                  <button key="sal" type="button" onClick={() => setParam("salary", "")} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 100,
                    background: "#FEF3C7", border: "1.5px solid #FDE68A",
                    color: "#92400E", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    年収: {tier.label} <span style={{ fontSize: 12, opacity: 0.8 }}>✕</span>
                  </button>
                ) : null;
              })()}
              {empType && (
                <button key="emp" type="button" onClick={() => setParam("emp_type", "")} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 100,
                  background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
                  color: "var(--royal)", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  雇用形態: {empType} <span style={{ fontSize: 12, opacity: 0.8 }}>✕</span>
                </button>
              )}
              {prefecture && (
                <button key="pref" type="button" onClick={() => setParam("prefecture", "")} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 100,
                  background: "#F0FDF4", border: "1.5px solid #BBF7D0",
                  color: "#16A34A", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  地域: {prefecture} <span style={{ fontSize: 12, opacity: 0.8 }}>✕</span>
                </button>
              )}
              {techStack.map((t) => (
                <button key={`ts-${t}`} type="button" onClick={() => setTechStack(techStack.filter((x) => x !== t))} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 100,
                  background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
                  color: "var(--royal)", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  {t} <span style={{ fontSize: 12, opacity: 0.8 }}>✕</span>
                </button>
              ))}
              <button type="button" onClick={() => { setQ(""); setTechStack([]); router.replace("/jobs"); }} style={{
                fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", background: "none",
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
            style={isDesktop ? { gridTemplateColumns: "260px minmax(0,1fr)" } : undefined}
          >
            {/* ─ Desktop sidebar ─ */}
            <aside className="jobs-sidebar">
              <SidebarFilters
                parentRoles={parentRoles}
                category={category}
                workStyle={work_style}
                salary={salary}
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
                industry={industry}
                roleCounts={roleCounts}
                toggleParam={toggleParam}
                toggleStage={toggleStage}
              />
            </aside>

            {/* ─ Results column ─ */}
            <main id="jobs-results-top" style={{ minWidth: 0 }}>

          {/* ── パーソナライズ: あなたにおすすめの求人 ── */}
          {!hasFilter && !q && recommendations.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>あなたへのおすすめ</span>
                <span style={{ fontSize: 12, padding: "1px 8px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", fontWeight: 600 }}>
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
                          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {(recCompany as any).brand_name ?? recCompany.name}
                          </div>
                        )}
                        {(job.salary_min ?? 0) > 0 && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
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
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>他 +{recommendations.length - 4}件</span>
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
                  fontSize: 12, padding: "2px 9px", borderRadius: 100,
                  background: "var(--royal-50)", color: "var(--royal)",
                  fontWeight: 700, border: "1px solid var(--royal-100)",
                }}>
                  {userJobType}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: "auto", fontFamily: "Inter, sans-serif" }}>
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
                  すべての募集
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
              <h3 style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>条件に合う募集が見つかりませんでした</h3>
              {/* 「カジュアル面談で直接聞いてみましょう」は 2026-08-03 に差し替え。
                  面談を前提にした案内はプラットフォーム側の説明では使わない方針。
                  ここは検索結果が0件のときの導線なので、条件を緩めるか企業から辿るかを示す。 */}
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", marginBottom: 20 }}>条件を緩めるか、企業から探してみてください</p>
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
                    return (
                      <JobListItem
                        key={job.id}
                        job={job}
                        companyMap={companyMap}
                        initialBookmarked={bookmarkedIds.has(job.id)}
                        isApplied={appliedJobIds.has(job.id)}
                        reviewSummary={reviewSummaries?.[job.company_id]}
                        matchReason={computeMatchReason(job, { category, dept, salary, prefecture, q }, parentRoles)}
                      />
                    );
                  });
                })()}
              </div>
              {/* ⑦ プログレスバー + もっと見るボタン */}
              <div style={{ marginTop: 16, marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                    <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{paged.length}</strong>
                    {" / "}
                    <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{filteredForDisplay.length}</strong>
                    {" 件表示中"}
                  </span>
                  {hasMore && (
                    <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>残り{remainingCount}件</span>
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
          padding: 7px 14px;
          border-radius: 999px; font-size: 13px; font-weight: 500;
          border: 1.5px solid #e2e8f0; background: #fff; color: var(--ink-soft);
          cursor: pointer; white-space: nowrap; font-family: inherit;
          transition: border-color 0.12s, background 0.12s, color 0.12s;
        }
        .jobs-pill:hover { border-color: var(--royal); color: var(--royal); }
        .jobs-pill.active {
          border-color: var(--royal); background: var(--royal-50);
          color: var(--royal); font-weight: 700;
        }
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
        .jobs-sort-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 600;
          cursor: pointer; border: 1.5px solid var(--line); background: #fff; color: var(--ink-soft);
          transition: all 0.15s ease; white-space: nowrap; font-family: inherit; flex-shrink: 0;
        }
        .jobs-sort-btn:hover { border-color: var(--royal-100); background: var(--royal-50); color: var(--royal); }
        .jobs-sort-btn.active {
          background: var(--royal); border-color: var(--royal); color: #fff;
          font-weight: 700; box-shadow: 0 3px 12px rgba(0,35,102,0.35); transform: scale(1.03);
        }
        /* 面談受付中トグルピル */
        .jobs-pill-hiring {
          display: inline-flex; align-items: center;
          padding: 7px 14px;
          border-radius: 999px; font-size: 13px; font-weight: 500;
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
                      <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "var(--royal)", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                        {t}
                        <button type="button" onClick={() => setTechStack(techStack.filter((x) => x !== t))} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 500, lineHeight: 1, opacity: 0.8 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                {TECH_STACK_CATEGORIES.map((cat) => (
                  <div key={cat.label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>{cat.label}</div>
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
                industry={industry} prefecture={prefecture} empType={empType} companyStage={companyStage}
                availablePrefectures={availablePrefectures}
                setParam={setParam} onCompanyStageChange={setCompanyStage}
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
          {openFilter === "phase" && (
            <>
              <button className={`jobs-pill-item${!companyStageSet.has("listed") && !companyStageSet.has("unicorn") && !companyStageSet.has("startup") ? " selected" : ""}`}
                onClick={() => { setCompanyStage(""); setOpenFilter(null); }}>すべて</button>
              {([
                { key: "listed",  label: "上場" },
                { key: "unicorn", label: "🦄 ユニコーン" },
                { key: "startup", label: "スタートアップ" },
              ] as { key: string; label: string }[]).map(({ key, label }) => (
                <button key={key} className={`jobs-pill-item${companyStageSet.has(key) ? " selected" : ""}`}
                  onClick={() => {
                    const set = new Set(companyStage ? companyStage.split(",") : []);
                    if (set.has(key)) set.delete(key); else set.add(key);
                    setCompanyStage(Array.from(set).join(","));
                    setOpenFilter(null);
                  }}>{label}</button>
              ))}
            </>
          )}
          {openFilter === "industry" && (
            <>
              <button className={`jobs-pill-item${!industry ? " selected" : ""}`} onClick={() => { setParam("industry", ""); setOpenFilter(null); }}>すべて</button>
              {INDUSTRY_GROUPS.map((g) => (
                <button key={g.key} className={`jobs-pill-item${industry === g.key ? " selected" : ""}`}
                  onClick={() => { setParam("industry", industry === g.key ? "" : g.key); setOpenFilter(null); }}
                >{g.label}</button>
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
