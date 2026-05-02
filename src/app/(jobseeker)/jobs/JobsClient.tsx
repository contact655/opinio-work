"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Job } from "@/app/jobs/mockJobData";
import { SALARY_PRESETS } from "@/app/jobs/mockJobData";
import type { Company } from "@/app/companies/mockCompanies";
import { extractPrefecture, PREFECTURES } from "@/lib/utils/location";

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE = 9;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function freshLabel(days: number): string {
  if (days === 0) return "今日更新";
  if (days === 1) return "昨日更新";
  if (days <= 7) return `${days}日前更新`;
  if (days <= 14) return "今週更新";
  if (days <= 21) return "先週更新";
  if (days <= 31) return "今月更新";
  return `${Math.floor(days / 7)}週間前更新`;
}

function formatSalary(min: number, max: number): string {
  if (!min && !max) return "応相談";
  if (min && max) return `¥${min}–${max}万`;
  if (max) return `〜¥${max}万`;
  return `¥${min}万〜`;
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  companyMap,
}: {
  job: Job;
  companyMap: Map<string, Company>;
}) {
  const company = companyMap.get(job.company_id);
  if (!company) return null;

  const initial = company.name.charAt(0).toUpperCase();
  const isFresh = job.updated_days_ago <= 7;
  const label = freshLabel(job.updated_days_ago);

  return (
    <Link
      href={`/jobs/${job.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 18px 16px",
        textDecoration: "none",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
      }}
      className="job-card-link"
    >
      {/* NEW ribbon */}
      {job.is_new && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: -28,
            transform: "rotate(45deg)",
            background: "var(--success)",
            color: "#fff",
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: "0.12em",
            padding: "3px 32px",
            zIndex: 2,
          }}
        >
          NEW
        </div>
      )}

      {/* Head */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 12,
          paddingRight: job.is_new ? 32 : 0,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            flexShrink: 0,
            background: company.gradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          {initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1.4,
              marginBottom: 4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {job.role}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                color: "var(--royal)",
                fontWeight: 600,
              }}
            >
              {company.name}
            </span>
            <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>·</span>
            {isFresh ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 100,
                  background: "var(--success-soft)",
                  color: "var(--success)",
                  border: "1px solid #A7F3D0",
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "var(--success)",
                    flexShrink: 0,
                  }}
                />
                {label}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>
                {label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      {job.tags.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            marginBottom: 10,
          }}
        >
          {job.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                padding: "3px 8px",
                borderRadius: 100,
                background:
                  tag.includes("リモート") || tag === "全国どこでも"
                    ? "var(--success-soft)"
                    : "var(--bg-tint)",
                color:
                  tag.includes("リモート") || tag === "全国どこでも"
                    ? "var(--success)"
                    : "var(--ink-soft)",
                border: `1px solid ${
                  tag.includes("リモート") || tag === "全国どこでも"
                    ? "#A7F3D0"
                    : "var(--line)"
                }`,
                fontWeight: 500,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Highlight */}
      {job.highlight && (
        <p
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            lineHeight: 1.7,
            flex: 1,
            marginBottom: 14,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {job.highlight}
        </p>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 12,
          borderTop: "1px solid var(--line-soft,#F1F5F9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--ink-mute)",
              marginBottom: 1,
            }}
          >
            想定年収
          </div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--royal)",
            }}
          >
            {formatSalary(job.salary_min, job.salary_max)}
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--royal)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          詳細を見る
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

// ─── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  current,
  total,
  onPage,
}: {
  current: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total <= 1) return null;
  const pages = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 6,
        marginTop: 32,
      }}
    >
      <button
        onClick={() => onPage(current - 1)}
        disabled={current === 1}
        style={{
          padding: "8px 14px",
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "#fff",
          color: current === 1 ? "var(--ink-mute)" : "var(--ink)",
          cursor: current === 1 ? "default" : "pointer",
          fontSize: 13,
          opacity: current === 1 ? 0.4 : 1,
        }}
      >
        ← 前へ
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          style={{
            padding: "8px 14px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: p === current ? "var(--royal)" : "#fff",
            color: p === current ? "#fff" : "var(--ink)",
            fontFamily: "Inter, sans-serif",
            fontWeight: p === current ? 700 : 400,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPage(current + 1)}
        disabled={current === total}
        style={{
          padding: "8px 14px",
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "#fff",
          color: current === total ? "var(--ink-mute)" : "var(--ink)",
          cursor: current === total ? "default" : "pointer",
          fontSize: 13,
          opacity: current === total ? 0.4 : 1,
        }}
      >
        次へ →
      </button>
    </div>
  );
}

// ─── Main client component ─────────────────────────────────────────────────────

export default function JobsClient({
  jobs: allJobs,
  companies,
  parentRoles,
}: {
  jobs: Job[];
  companies: Company[];
  parentRoles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? "";
  const dept = searchParams.get("dept") ?? "";       // 後方互換 (新規 URL では未使用)
  const work_style = searchParams.get("work_style") ?? "";
  const salary = searchParams.get("salary") ?? "";
  const industry = searchParams.get("industry") ?? "";
  const prefecture = searchParams.get("prefecture") ?? "";
  const sort = searchParams.get("sort") ?? "updated";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  // Local-only keyword search
  const [q, setQ] = useState("");

  // Build Map for fast company lookup
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  // Derive unique industry values from loaded companies
  const industries = useMemo(
    () =>
      Array.from(new Set(companies.map((c) => c.industry).filter(Boolean))).sort(),
    [companies]
  );

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`/jobs?${params.toString()}`);
  }

  function goPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.replace(`/jobs?${params.toString()}`);
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
      list = list.filter(
        (j) =>
          j.role.toLowerCase().includes(lq) ||
          (companyMap.get(j.company_id)?.name ?? "").toLowerCase().includes(lq) ||
          j.highlight.toLowerCase().includes(lq)
      );
    }

    // ow_roles 親カテゴリフィルタ (role_category_id が親 UUID に直接紐づく前提)
    if (category) list = list.filter((j) => j.role_category_id === category);

    // 旧 dept フィルタ (後方互換、URLに ?dept= が残っている場合)
    if (!category && dept) list = list.filter((j) => j.dept === dept);

    if (work_style) {
      list = list.filter(
        (j) =>
          j.work_style === work_style ||
          j.tags.some((t) => t.includes(work_style))
      );
    }

    if (salary) {
      const min = parseInt(salary, 10);
      if (!isNaN(min)) {
        // Exclude jobs with null/0 salary_max (option A: exclude when filtering)
        list = list.filter((j) => j.salary_max > 0 && j.salary_max >= min);
      }
    }

    if (industry) {
      const companyIds = companies
        .filter((c) => c.industry === industry)
        .map((c) => c.id);
      list = list.filter((j) => companyIds.includes(j.company_id));
    }

    // 都道府県フィルタ (job.location から抽出した都道府県と完全一致)
    if (prefecture) {
      list = list.filter((j) => extractPrefecture(j.location) === prefecture);
    }

    if (sort === "salary") {
      list = [...list].sort((a, b) => b.salary_max - a.salary_max);
    } else {
      list = [...list].sort((a, b) => a.updated_days_ago - b.updated_days_ago);
    }

    return list;
  }, [allJobs, q, category, dept, work_style, salary, industry, prefecture, sort, companies, companyMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const newThisWeek = allJobs.filter((j) => j.updated_days_ago <= 7).length;
  const hasFilter = !!(category || dept || work_style || salary || industry || prefecture);

  return (
    <>
      {/* Page header */}
      <div
        style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}
      >
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 py-6 md:px-12"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                flexShrink: 0,
              }}
            >
              <h1
                style={{
                  fontFamily: 'var(--font-noto-serif)',
                  fontSize: "clamp(22px,2.5vw,28px)",
                  fontWeight: 500,
                  color: "var(--ink)",
                  letterSpacing: "0.02em",
                }}
              >
                求人を、見つける。
              </h1>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  color: "var(--ink-mute)",
                }}
              >
                <strong
                  style={{
                    color: "var(--royal)",
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  {allJobs.length.toLocaleString()}
                </strong>
                件
              </span>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "var(--ink-mute)",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                今週新着{" "}
                <strong style={{ color: "var(--ink)" }}>{newThisWeek}件</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 md:px-12"
        >
          <div
            style={{
              padding: "10px 0",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* すべて */}
            <button
              onClick={() => setParam("category", "")}
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                border: `1.5px solid ${!category ? "var(--royal)" : "var(--line)"}`,
                background: !category ? "var(--royal)" : "#fff",
                color: !category ? "#fff" : "var(--ink-soft)",
                fontSize: 13,
                fontWeight: !category ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.12s, border-color 0.12s, color 0.12s",
              }}
            >
              すべて
            </button>

            {parentRoles.map((role) => {
              const active = category === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setParam("category", role.id)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 999,
                    border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
                    background: active ? "var(--royal)" : "#fff",
                    color: active ? "#fff" : "var(--ink-soft)",
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "background 0.12s, border-color 0.12s, color 0.12s",
                  }}
                >
                  {role.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div
        style={{
          position: "sticky",
          top: 64,
          zIndex: 50,
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 md:px-12"
        >
          <div
            style={{
              padding: "10px 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {/* Keyword search */}
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="キーワード検索..."
              style={{
                padding: "7px 12px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 13,
                width: 160,
                outline: "none",
                color: "var(--ink)",
              }}
            />

            <div
              style={{
                width: 1,
                height: 20,
                background: "var(--line)",
                flexShrink: 0,
              }}
            />

            {/* Work style filter */}
            <select
              value={work_style}
              onChange={(e) => setParam("work_style", e.target.value)}
              style={{
                padding: "7px 10px",
                border: `1px solid ${work_style ? "var(--royal)" : "var(--line)"}`,
                borderRadius: 8,
                background: work_style ? "var(--royal-50)" : "#fff",
                color: work_style ? "var(--royal)" : "var(--ink-soft)",
                fontSize: 13,
                cursor: "pointer",
                outline: "none",
                fontWeight: work_style ? 600 : 400,
              }}
            >
              <option value="">すべての働き方</option>
              <option value="フルリモート">フルリモート</option>
              <option value="ハイブリッド">ハイブリッド</option>
              <option value="フレックス">フレックス</option>
            </select>

            {/* Salary filter */}
            <select
              value={salary}
              onChange={(e) => setParam("salary", e.target.value)}
              style={{
                padding: "7px 10px",
                border: `1px solid ${salary ? "var(--royal)" : "var(--line)"}`,
                borderRadius: 8,
                background: salary ? "var(--royal-50)" : "#fff",
                color: salary ? "var(--royal)" : "var(--ink-soft)",
                fontSize: 13,
                cursor: "pointer",
                outline: "none",
                fontWeight: salary ? 600 : 400,
              }}
            >
              <option value="">年収指定なし</option>
              {SALARY_PRESETS.map((s) => (
                <option key={s} value={String(s)}>
                  {s}万〜
                </option>
              ))}
            </select>

            {/* Industry filter */}
            <select
              value={industry}
              onChange={(e) => setParam("industry", e.target.value)}
              style={{
                padding: "7px 10px",
                border: `1px solid ${industry ? "var(--royal)" : "var(--line)"}`,
                borderRadius: 8,
                background: industry ? "var(--royal-50)" : "#fff",
                color: industry ? "var(--royal)" : "var(--ink-soft)",
                fontSize: 13,
                cursor: "pointer",
                outline: "none",
                fontWeight: industry ? 600 : 400,
              }}
            >
              <option value="">すべての業界</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>

            {/* 都道府県 filter */}
            <select
              value={prefecture}
              onChange={(e) => setParam("prefecture", e.target.value)}
              style={{
                padding: "7px 10px",
                border: `1px solid ${prefecture ? "var(--royal)" : "var(--line)"}`,
                borderRadius: 8,
                background: prefecture ? "var(--royal-50)" : "#fff",
                color: prefecture ? "var(--royal)" : "var(--ink-soft)",
                fontSize: 13,
                cursor: "pointer",
                outline: "none",
                fontWeight: prefecture ? 600 : 400,
              }}
              aria-label="都道府県で絞り込み"
            >
              <option value="">すべての都道府県</option>
              {availablePrefectures.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {hasFilter && (
              <button
                onClick={() => {
                  setQ("");
                  router.replace("/jobs");
                }}
                style={{
                  padding: "7px 12px",
                  border: "none",
                  background: "none",
                  color: "var(--ink-mute)",
                  fontSize: 12,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                リセット
              </button>
            )}

            <div style={{ flex: 1 }} />

            {/* Result count */}
            <span
              style={{
                fontSize: 13,
                color: "var(--ink-mute)",
                whiteSpace: "nowrap",
              }}
            >
              <strong
                style={{
                  color: "var(--royal)",
                  fontSize: 15,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {filtered.length}
              </strong>{" "}
              件
            </span>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value)}
              style={{
                padding: "7px 10px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "#fff",
                fontSize: 13,
                color: "var(--ink-soft)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="updated">新着順</option>
              <option value="salary">年収順</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <main style={{ background: "var(--bg-tint)" }}>
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 py-8 md:px-12 md:py-10"
        >
          {paged.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "80px 0",
                color: "var(--ink-mute)",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "var(--ink-soft)",
                }}
              >
                条件に合う求人が見つかりませんでした
              </p>
              <p style={{ fontSize: 14 }}>フィルターを変更してみてください</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paged.map((job) => (
                  <JobCard key={job.id} job={job} companyMap={companyMap} />
                ))}
              </div>
              <Pagination
                current={safePage}
                total={totalPages}
                onPage={goPage}
              />
            </>
          )}
        </div>
      </main>

      <style>{`
        .job-card-link:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 12px 32px rgba(15,23,42,0.08) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>
    </>
  );
}
