"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// ─── Types ───────────────────────────────────────────

type SavedJob = {
  id: string;
  job_id: string;
  job: {
    id: string;
    title: string;
    job_category: string | null;
    salary_min: number | null;
    salary_max: number | null;
    location: string | null;
    company: {
      id: string;
      name: string;
      url: string | null;
      logo_url: string | null;
    } | null;
  } | null;
};

type NewJob = {
  id: string;
  title: string;
  job_category: string | null;
  salary_min: number | null;
  salary_max: number | null;
  location: string | null;
  created_at: string;
  company: {
    id: string;
    name: string;
    url: string | null;
    logo_url: string | null;
  } | null;
};

// ─── Helpers ─────────────────────────────────────────

function getLogoUrl(entity: { logo_url?: string | null; url?: string | null } | null): string | null {
  if (!entity) return null;
  if (entity.logo_url) return entity.logo_url;
  if (entity.url) {
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(entity.url).hostname}&sz=128`;
    } catch {}
  }
  return null;
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return "応相談";
  if (min && max) return `${min}〜${max}万`;
  if (min) return `${min}万〜`;
  if (max) return `〜${max}万`;
  return "応相談";
}

// ─── Logo Component ──────────────────────────────────

function Logo({ src, name, size = 36 }: { src: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  return (
    <div
      className="rounded-lg bg-gray-50 flex-shrink-0 overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size, border: "0.5px solid #e5e7eb" }}
    >
      {src && !err ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-contain p-1" onError={() => setErr(true)} />
      ) : (
        <span className="text-gray-500 text-xs font-bold">{name[0] || "?"}</span>
      )}
    </div>
  );
}

// ─── Status tracker card data ────────────────────────

const TRACKER_STATUSES = [
  { key: "applied", label: "応募済み", icon: "📄" },
  { key: "doc_review", label: "書類選考中", icon: "📋" },
  { key: "interview", label: "面接中", icon: "🎤" },
  { key: "offered", label: "内定", icon: "🎉" },
] as const;

// Map raw DB status values to our 4 tracker buckets
function mapStatusToBucket(status: string): string {
  switch (status) {
    case "applied":
      return "applied";
    case "pending":
    case "screening":
    case "doc_review":
      return "doc_review";
    case "interview":
    case "interview1":
    case "interview_final":
      return "interview";
    case "offer":
    case "offered":
    case "accepted":
      return "offered";
    default:
      return "applied";
  }
}

// ─── Main Component ──────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Section 1: Application tracker
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    applied: 0,
    doc_review: 0,
    interview: 0,
    offered: 0,
  });
  const [hasApplications, setHasApplications] = useState(false);

  // Section 2: Saved jobs
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);

  // Section 3: New jobs since last login
  const [newJobs, setNewJobs] = useState<NewJob[]>([]);
  const [newJobsCount, setNewJobsCount] = useState(0);

  // Apply action
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const handleApply = useCallback(
    async (jobId: string) => {
      if (!user || applyingId) return;
      setApplyingId(jobId);
      const supabase = createClient();
      try {
        await supabase.from("ow_applications").insert({
          candidate_id: user.id,
          job_id: jobId,
          status: "applied",
        });
        setAppliedIds((prev) => new Set(prev).add(jobId));
        // Update tracker count
        setStatusCounts((prev) => ({ ...prev, applied: prev.applied + 1 }));
        setHasApplications(true);
      } catch {
        // ignore
      }
      setApplyingId(null);
    },
    [user, applyingId]
  );

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/signin");
        return;
      }
      setUser(user);

      // ── Section 1: Fetch applications for status tracker ──
      try {
        const { data: apps } = await supabase
          .from("ow_applications")
          .select("id, status")
          .or(`candidate_id.eq.${user.id},user_id.eq.${user.id}`);

        if (apps && apps.length > 0) {
          setHasApplications(true);
          const counts: Record<string, number> = {
            applied: 0,
            doc_review: 0,
            interview: 0,
            offered: 0,
          };
          apps.forEach((a: any) => {
            const bucket = mapStatusToBucket(a.status);
            if (counts[bucket] !== undefined) counts[bucket]++;
          });
          setStatusCounts(counts);

          // Track already-applied job IDs
          const { data: appJobs } = await supabase
            .from("ow_applications")
            .select("job_id")
            .or(`candidate_id.eq.${user.id},user_id.eq.${user.id}`);
          if (appJobs) {
            setAppliedIds(new Set(appJobs.map((a: any) => a.job_id)));
          }
        }
      } catch {
        // ow_applications may not exist
      }

      // ── Section 2: Fetch saved jobs (ow_job_favorites) ──
      try {
        const { data: favs } = await supabase
          .from("ow_job_favorites")
          .select("id, job_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (favs && favs.length > 0) {
          const ids = favs.map((f: any) => f.job_id);
          const { data: jobs } = await supabase
            .from("ow_jobs")
            .select("id, title, job_category, salary_min, salary_max, location, ow_companies(id, name, url, logo_url)")
            .in("id", ids)
            .eq("status", "active");

          const jobMap = new Map(
            (jobs || []).map((j: any) => [
              j.id,
              { ...j, company: j.ow_companies || null },
            ])
          );
          setSavedJobs(
            favs
              .map((f: any) => ({
                id: f.id,
                job_id: f.job_id,
                job: jobMap.get(f.job_id) || null,
              }))
              .filter((f: SavedJob) => f.job !== null)
          );
        }
      } catch {
        // ignore
      }

      // ── Section 3: New jobs since last login ──
      try {
        const { data: profile } = await supabase
          .from("ow_profiles")
          .select("last_login_at")
          .eq("user_id", user.id)
          .maybeSingle();

        const lastLogin = profile?.last_login_at;
        if (lastLogin) {
          const { data: newJobsData, count } = await supabase
            .from("ow_jobs")
            .select("id, title, job_category, salary_min, salary_max, location, created_at, ow_companies(id, name, url, logo_url)", { count: "exact" })
            .eq("status", "active")
            .gt("created_at", lastLogin)
            .order("created_at", { ascending: false })
            .limit(5);

          if (newJobsData && newJobsData.length > 0) {
            setNewJobs(
              newJobsData.map((j: any) => ({
                ...j,
                company: j.ow_companies || null,
              }))
            );
            setNewJobsCount(count || newJobsData.length);
          }
        }
      } catch {
        // ignore
      }

      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen" style={{ background: "#f8f9fa" }}>
          <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
            <p style={{ fontSize: 14, color: "#9ca3af" }}>読み込み中...</p>
          </div>
        </main>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen" style={{ background: "#f8f9fa" }}>
        <div className="max-w-[760px] mx-auto px-4 py-10">
          {/* ─── Page Title ─── */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              マイページ
            </h1>
            <p style={{ fontSize: 13, color: "#9ca3af" }}>{user.email}</p>
          </div>

          {/* ═══ Section 1: 応募状況トラッカー ═══ */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>
              応募状況
            </h2>

            {!hasApplications ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: "32px 16px",
                  textAlign: "center",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
                }}
              >
                <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 12 }}>
                  まだ応募した求人がありません
                </p>
                <Link
                  href="/jobs"
                  style={{ fontSize: 13, fontWeight: 500, color: "#1D9E75" }}
                >
                  求人を探す →
                </Link>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {TRACKER_STATUSES.map(({ key, label, icon }) => (
                  <div
                    key={key}
                    style={{
                      background: "#f9fafb",
                      borderRadius: 12,
                      padding: 16,
                      textAlign: "center",
                      border: "1px solid #f3f4f6",
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 500, color: "#111827" }}>
                      {statusCounts[key] || 0}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ═══ Section 2: 保存済み求人 ═══ */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>
              保存済み求人
            </h2>

            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
              }}
            >
              {savedJobs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px" }}>
                  <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 12 }}>
                    気になる求人のハートを押すとここに表示されます
                  </p>
                  <Link href="/jobs" style={{ fontSize: 13, fontWeight: 500, color: "#1D9E75" }}>
                    求人を探す →
                  </Link>
                </div>
              ) : (
                <div>
                  {savedJobs.map((sf, idx) => {
                    const j = sf.job;
                    if (!j) return null;
                    const comp = j.company;
                    const isApplied = appliedIds.has(j.id);
                    return (
                      <div
                        key={sf.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 20px",
                          borderTop: idx > 0 ? "1px solid #f3f4f6" : undefined,
                        }}
                      >
                        <Logo src={getLogoUrl(comp)} name={comp?.name || "?"} />
                        <Link href={`/jobs/${j.id}`} className="flex-1 min-w-0" style={{ textDecoration: "none" }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }} className="truncate">
                            {comp?.name ? `${comp.name}` : ""}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginTop: 1 }} className="truncate">
                            {j.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                            {[j.job_category, formatSalary(j.salary_min, j.salary_max), j.location]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </Link>
                        {/* 応募するボタン */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            if (!isApplied) handleApply(j.id);
                          }}
                          disabled={isApplied || applyingId === j.id}
                          style={{
                            flexShrink: 0,
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "7px 16px",
                            borderRadius: 8,
                            border: "none",
                            cursor: isApplied ? "default" : "pointer",
                            background: isApplied ? "#f3f4f6" : "#1D9E75",
                            color: isApplied ? "#9ca3af" : "#fff",
                            transition: "background 0.15s",
                          }}
                        >
                          {applyingId === j.id ? "..." : isApplied ? "応募済み" : "応募する"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ═══ Section 3: 前回から新着 ═══ */}
          {newJobs.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 4 }}>
                前回から新着
              </h2>
              <p style={{ fontSize: 13, color: "#059669", fontWeight: 500, marginBottom: 12 }}>
                前回のログイン以降 {newJobsCount}件の新着求人があります
              </p>

              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
                }}
              >
                {newJobs.map((j, idx) => {
                  const comp = j.company;
                  const dateStr = new Date(j.created_at).toLocaleDateString("ja-JP", {
                    month: "short",
                    day: "numeric",
                  });
                  return (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 20px",
                        borderTop: idx > 0 ? "1px solid #f3f4f6" : undefined,
                        textDecoration: "none",
                      }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <Logo src={getLogoUrl(comp)} name={comp?.name || "?"} />
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }} className="truncate">
                          {comp?.name || "企業名"}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginTop: 1 }} className="truncate">
                          {j.title}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                          {[j.job_category, formatSalary(j.salary_min, j.salary_max), j.location]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <span style={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "#e1f5ee",
                        color: "#085041",
                      }}>
                        {dateStr}
                      </span>
                    </Link>
                  );
                })}
                {newJobsCount > 5 && (
                  <div style={{ textAlign: "center", padding: "12px 16px", borderTop: "1px solid #f3f4f6" }}>
                    <Link href="/jobs?sort=newest" style={{ fontSize: 13, fontWeight: 500, color: "#1D9E75" }}>
                      すべての新着求人を見る →
                    </Link>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ─── Quick Links ─── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, paddingTop: 8 }}>
            <Link href="/mypage/profile" style={{ color: "#6b7280", textDecoration: "none" }} className="hover:text-gray-900 transition-colors">
              プロフィール編集
            </Link>
            <span style={{ color: "#d1d5db" }}>·</span>
            <Link href="/career-consultation" style={{ color: "#6b7280", textDecoration: "none" }} className="hover:text-gray-900 transition-colors">
              キャリア相談
            </Link>
            <span style={{ color: "#d1d5db" }}>·</span>
            <Link href="/dashboard/job-tracking" style={{ color: "#6b7280", textDecoration: "none" }} className="hover:text-gray-900 transition-colors">
              転職トラッキング
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
