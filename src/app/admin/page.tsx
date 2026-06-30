import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

async function getStats() {
  const supabase = createClient();
  const admin = createAdminClient();

  const [
    users, activeCompanies, activeJobs, totalApplications,
    pendingJobs, pendingMeetings, bizAdmins,
    onboardingCompleted, profileFilled, appliedOrMet,
  ] = await Promise.all([
    supabase.from("ow_users").select("id", { count: "exact", head: true }),
    supabase.from("ow_companies").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("ow_jobs").select("id", { count: "exact", head: true }).in("status", ["active", "published"]),
    supabase.from("ow_job_applications").select("id", { count: "exact", head: true }),
    supabase.from("ow_jobs").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("ow_casual_meetings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("ow_company_admins").select("id", { count: "exact", head: true }).eq("is_active", true),
    // オンボーディングファネル
    admin.from("ow_profiles").select("id", { count: "exact", head: true }).eq("onboarding_completed", true),
    admin.from("ow_profiles").select("id", { count: "exact", head: true }).not("job_type", "is", null),
    admin.from("ow_job_applications").select("id", { count: "exact", head: true }),
  ]);

  // 未ログインBIZ担当者数を算出（auth.admin → ow_users.auth_id でジョイン）
  let neverLoggedInBizCount = 0;
  try {
    const [{ data: adminRows }, { data: owUsers }, authResult] = await Promise.all([
      admin.from("ow_company_admins").select("user_id").eq("is_active", true).not("user_id", "is", null),
      admin.from("ow_users").select("id, auth_id"),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authUsers = (authResult as any).data?.users ?? [];
    const neverLoggedInAuthIds = new Set<string>(
      authUsers.filter((u: any) => !u.last_sign_in_at).map((u: any) => u.id as string)
    );
    const owUserMap = new Map<string, string | null>((owUsers ?? []).map((u) => [u.id, u.auth_id]));
    const bizUserIds = Array.from(new Set((adminRows ?? []).map((r: any) => r.user_id as string)));
    for (const owUserId of bizUserIds) {
      const authId = owUserMap.get(owUserId);
      if (authId && neverLoggedInAuthIds.has(authId)) neverLoggedInBizCount++;
    }
  } catch {
    // best-effort
  }

  // Recent users
  const { data: recentUsers } = await supabase
    .from("ow_users")
    .select("id, name, email, is_mentor, location, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Recent companies
  const { data: recentCompanies } = await supabase
    .from("ow_companies")
    .select("id, name, industry, is_published, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    usersCount: users.count ?? 0,
    activeCompaniesCount: activeCompanies.count ?? 0,
    activeJobsCount: activeJobs.count ?? 0,
    totalApplicationsCount: totalApplications.count ?? 0,
    pendingJobsCount: pendingJobs.count ?? 0,
    pendingMeetingsCount: pendingMeetings.count ?? 0,
    pendingReservationsCount: 0,
    bizAdminsCount: bizAdmins.count ?? 0,
    neverLoggedInBizCount,
    recentUsers: recentUsers ?? [],
    recentCompanies: recentCompanies ?? [],
    // ファネル
    onboardingCompletedCount: onboardingCompleted.count ?? 0,
    profileFilledCount: profileFilled.count ?? 0,
    appliedOrMetCount: appliedOrMet.count ?? 0,
  };
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, var(--royal), #3B5FD9)",
  "linear-gradient(135deg, #7C3AED, #C4B5FD)",
  "linear-gradient(135deg, var(--success), #34D399)",
  "linear-gradient(135deg, #F59E0B, #FCD34D)",
  "linear-gradient(135deg, #DC2626, #FCA5A5)",
];

export default async function AdminDashboard() {
  const stats = await getStats();
  const totalPending = stats.pendingJobsCount + stats.pendingMeetingsCount + stats.pendingReservationsCount
    + (stats.neverLoggedInBizCount > 0 ? 1 : 0);

  const kpis = [
    {
      label: "登録ユーザー数",
      sublabel: "Job Seekers",
      value: stats.usersCount,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      iconBg: "#EFF3FC",
      iconColor: "var(--royal)",
      accentBar: "var(--royal)",
      href: "/admin/candidates",
    },
    {
      label: "BIZ担当者数",
      sublabel: "Biz Accounts",
      value: stats.bizAdminsCount,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <polyline points="16 11 18 13 22 9"/>
        </svg>
      ),
      iconBg: "#F3E8FF",
      iconColor: "#7C3AED",
      accentBar: "#7C3AED",
      href: "/admin/biz-accounts",
    },
    {
      label: "公開中の企業数",
      sublabel: "Active Companies",
      value: stats.activeCompaniesCount,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      iconBg: "#ECFDF5",
      iconColor: "var(--success)",
      accentBar: "var(--success)",
      href: "/admin/companies",
    },
    {
      label: "公開中の求人数",
      sublabel: "Active Jobs",
      value: stats.activeJobsCount,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
        </svg>
      ),
      iconBg: "#FEF3C7",
      iconColor: "#B45309",
      accentBar: "#F59E0B",
      href: "/admin/jobs",
    },
  ];

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        .admin-kpi-card:hover { box-shadow: 0 6px 20px rgba(15,23,42,0.08); transform: translateY(-2px); border-color: #DCE5F7 !important; }
        .admin-quick-link:hover { background: #F8FAFC !important; border-color: #E2E8F0 !important; }
      `}</style>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9, fontWeight: 800,
              letterSpacing: "0.18em", textTransform: "uppercase",
              background: "#DC2626", color: "#fff",
              padding: "3px 8px", borderRadius: 4,
            }}>ADMIN</span>
            <h1 style={{
              fontFamily: "var(--font-noto-serif, 'Noto Serif JP', serif)",
              fontSize: 22, fontWeight: 600, color: "#0F172A",
              margin: 0,
            }}>ダッシュボード</h1>
          </div>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
            OPINIO 管理画面 — {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
          </p>
        </div>

        {/* Pending tasks badge */}
        {totalPending > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#FEF3C7", border: "1px solid #FCD34D",
            borderRadius: 10, padding: "10px 16px",
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#F59E0B",
              boxShadow: "0 0 0 3px rgba(245,158,11,0.25)",
            }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>
              要対応タスク {totalPending}件
            </span>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12, marginBottom: 24,
      }}>
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} style={{ textDecoration: "none", display: "block" }}>
            <div className="admin-kpi-card" style={{
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 14,
              padding: "20px 22px 16px",
              transition: "all 0.18s ease",
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
            }}>
              {/* Top accent bar */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                height: 3, background: kpi.accentBar, borderRadius: "14px 14px 0 0",
              }} />

              {/* Icon + value */}
              <div style={{
                display: "flex", alignItems: "flex-start",
                justifyContent: "space-between", marginBottom: 12,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: kpi.iconBg, color: kpi.iconColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {kpi.icon}
                </div>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 34, fontWeight: 800, color: "#0F172A",
                  lineHeight: 1, letterSpacing: "-0.02em",
                }}>
                  {kpi.value}
                </div>
              </div>

              {/* Label */}
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>
                {kpi.label}
              </div>
              <div style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 9, fontWeight: 700,
                color: "#94A3B8", letterSpacing: "0.14em", textTransform: "uppercase",
                borderTop: "1px solid #F1F5F9", paddingTop: 8, marginTop: 8,
              }}>
                {kpi.sublabel} →
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── オンボーディングファネル ── */}
      {(() => {
        const total = stats.usersCount;
        const funnel = [
          { label: "登録完了", count: total, color: "var(--royal)", bg: "#EFF3FC" },
          { label: "オンボーディング完了", count: stats.onboardingCompletedCount, color: "#7C3AED", bg: "#F5F3FF" },
          { label: "プロフィール記入済み", count: stats.profileFilledCount, color: "var(--success)", bg: "#ECFDF5" },
          { label: "応募・面談実績あり", count: stats.appliedOrMetCount, color: "#D97706", bg: "#FEF3C7" },
        ];
        return (
          <div style={{
            background: "#fff", border: "1px solid #E2E8F0",
            borderRadius: 14, padding: "20px 22px", marginBottom: 16,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
              </svg>
              ユーザーファネル（オンボーディング完了率）
            </div>
            <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
              {funnel.map((step, i) => {
                const pct = total > 0 ? Math.round((step.count / total) * 100) : 0;
                return (
                  <div key={step.label} style={{ flex: 1, position: "relative" }}>
                    {/* Arrow connector */}
                    {i > 0 && (
                      <div style={{
                        position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)",
                        color: "#CBD5E1", fontSize: 18, zIndex: 1, lineHeight: 1,
                      }}>›</div>
                    )}
                    <div style={{
                      background: step.bg, borderRadius: 10,
                      padding: "14px 16px", marginLeft: i > 0 ? 12 : 0,
                    }}>
                      <div style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 28, fontWeight: 800, color: step.color, lineHeight: 1, marginBottom: 4,
                      }}>
                        {step.count}
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", marginLeft: 4 }}>人</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                        {step.label}
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 4, background: "#E2E8F0", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: step.color, borderRadius: 2, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ fontSize: 10, color: step.color, fontWeight: 700, fontFamily: "'Inter', sans-serif", marginTop: 4 }}>
                        {pct}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Tasks + Quick Actions ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Pending Tasks */}
        <div style={{
          background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 14, padding: "20px 22px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F1F5F9",
          }}>
            <h2 style={{
              fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              要対応タスク
            </h2>
            {totalPending > 0 && (
              <span style={{
                background: "#FEF3C7", color: "#92400E",
                fontSize: 10, fontWeight: 700,
                padding: "2px 8px", borderRadius: 100,
              }}>
                {totalPending}件
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.pendingJobsCount > 0 && (
              <Link href="/admin/jobs" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "#FFFBEB", border: "1px solid #FDE68A",
                  transition: "background 0.15s",
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#FEF3C7", color: "#B45309",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#92400E", margin: 0, marginBottom: 2 }}>求人審査待ち</p>
                    <p style={{ fontSize: 11, color: "#B45309", margin: 0 }}>{stats.pendingJobsCount}件の求人審査が必要</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            )}

            {stats.pendingMeetingsCount > 0 && (
              <Link href="/admin/candidates" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "#EFF3FC", border: "1px solid #DCE5F7",
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#DCE5F7", color: "var(--royal)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", margin: 0, marginBottom: 2 }}>カジュアル面談 申込待ち</p>
                    <p style={{ fontSize: 11, color: "#3B5FD9", margin: 0 }}>{stats.pendingMeetingsCount}件</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            )}

            {stats.pendingReservationsCount > 0 && (
              <Link href="/admin/reservations" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "#F3E8FF", border: "1px solid #E9D5FF",
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#E9D5FF", color: "#7C3AED",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#6D28D9", margin: 0, marginBottom: 2 }}>メンター相談 転送待ち</p>
                    <p style={{ fontSize: 11, color: "#7C3AED", margin: 0 }}>{stats.pendingReservationsCount}件</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            )}

            {stats.neverLoggedInBizCount > 0 && (
              <Link href="/admin/biz-accounts?filter=never_login" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "#FFFBEB", border: "1px solid #FDE68A",
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#FEF3C7", color: "#B45309",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#92400E", margin: 0, marginBottom: 2 }}>BIZ担当者 未ログイン</p>
                    <p style={{ fontSize: 11, color: "#B45309", margin: 0 }}>
                      招待済みで未ログインの担当者が{stats.neverLoggedInBizCount}名います
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            )}

            {totalPending === 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "16px 14px", borderRadius: 10,
                background: "#ECFDF5", border: "1px solid #A7F3D0",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
                </svg>
                <p style={{ fontSize: 13, color: "#065F46", fontWeight: 600, margin: 0 }}>
                  対応が必要なタスクはありません
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{
          background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 14, padding: "20px 22px",
        }}>
          <h2 style={{
            fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0,
            marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F1F5F9",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B5FD9" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            クイックアクション
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/admin/invite" style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 10,
                background: "#EFF3FC", border: "1px solid #DCE5F7",
                cursor: "pointer", transition: "background 0.15s",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "var(--royal)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", margin: 0, marginBottom: 2 }}>ユーザーを招待する</p>
                  <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>求職者・企業担当者をメール招待</p>
                </div>
              </div>
            </Link>

            {[
              { href: "/admin/companies", label: "企業を管理する", desc: "掲載企業の承認・編集", icon: "🏢" },
              { href: "/admin/jobs", label: "求人を審査する", desc: "掲載求人のレビューと承認", icon: "📋" },
              { href: "/admin/mentors", label: "メンターを管理する", desc: "メンター登録・承認", icon: "🎓" },
              { href: "/admin/candidates", label: "候補者を確認する", desc: "登録ユーザーの一覧", icon: "👤" },
            ].map(({ href, label, desc, icon }) => (
              <Link key={href} href={href} style={{ textDecoration: "none" }}>
                <div className="admin-quick-link" style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 10,
                  border: "1px solid #F1F5F9",
                  cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0, marginBottom: 1 }}>{label}</p>
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>{desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>


      {/* ── Recent Users ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16,
      }}>
        <div style={{
          background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 14, padding: "20px 22px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F1F5F9",
          }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>最近の登録ユーザー</h2>
            <Link href="/admin/candidates" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
              すべて見る →
            </Link>
          </div>

          {stats.recentUsers.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stats.recentUsers.map((u: any, i: number) => (
                <div key={u.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 8,
                  background: "#F8FAFC",
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: "#fff",
                    flexShrink: 0,
                  }}>
                    {u.name?.[0] || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.name || "未入力"}
                      </p>
                      {u.is_mentor && (
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          background: "#F3E8FF", color: "#7C3AED",
                          padding: "1px 6px", borderRadius: 100,
                          flexShrink: 0,
                        }}>メンター</span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.email}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 10, color: "#94A3B8", flexShrink: 0,
                    fontFamily: "'Inter', sans-serif",
                  }}>
                    {new Date(u.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "24px 0" }}>
              ユーザーはまだいません
            </p>
          )}
        </div>

        {/* Stats summary */}
        <div style={{
          background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 14, padding: "20px 22px",
        }}>
          <h2 style={{
            fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0,
            marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F1F5F9",
          }}>プラットフォーム概況</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                label: "登録ユーザー（求職者）",
                value: stats.usersCount,
                color: "var(--royal)",
                bar: stats.usersCount,
                max: Math.max(stats.usersCount, 1),
              },
              {
                label: "BIZ担当者",
                value: stats.bizAdminsCount,
                color: "#7C3AED",
                bar: stats.bizAdminsCount,
                max: Math.max(stats.usersCount, 1),
              },
              {
                label: "公開中の企業",
                value: stats.activeCompaniesCount,
                color: "var(--success)",
                bar: stats.activeCompaniesCount,
                max: Math.max(stats.usersCount, 1),
              },
              {
                label: "公開中の求人",
                value: stats.activeJobsCount,
                color: "#F59E0B",
                bar: stats.activeJobsCount,
                max: Math.max(stats.usersCount, 1),
              },
              {
                label: "累計応募数",
                value: stats.totalApplicationsCount,
                color: "#DC2626",
                bar: stats.totalApplicationsCount,
                max: Math.max(stats.usersCount, 1),
              },
            ].map(({ label, value, color, bar, max }) => (
              <div key={label}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{label}</span>
                  <span style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 14, fontWeight: 700, color,
                  }}>{value}</span>
                </div>
                <div style={{
                  height: 6, borderRadius: 3,
                  background: "#F1F5F9", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, (bar / max) * 100)}%`,
                    background: color,
                    borderRadius: 3,
                    transition: "width 0.5s ease",
                    minWidth: value > 0 ? 8 : 0,
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 20, paddingTop: 14, borderTop: "1px solid #F1F5F9",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
              BIZ担当者（未ログイン）:{" "}
              <strong style={{ color: stats.neverLoggedInBizCount > 0 ? "#B45309" : "var(--success)" }}>
                {stats.neverLoggedInBizCount}名
              </strong>
            </p>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
              審査待ち求人: <strong style={{ color: stats.pendingJobsCount > 0 ? "#B45309" : "var(--success)" }}>
                {stats.pendingJobsCount}件
              </strong>
            </p>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
              面談申込待ち: <strong style={{ color: stats.pendingMeetingsCount > 0 ? "var(--royal)" : "var(--success)" }}>
                {stats.pendingMeetingsCount}件
              </strong>
            </p>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
              メンター相談転送待ち: <strong style={{ color: stats.pendingReservationsCount > 0 ? "#7C3AED" : "var(--success)" }}>
                {stats.pendingReservationsCount}件
              </strong>
            </p>
          </div>
        </div>
      </div>

      {/* ── Recent Companies Table ── */}
      <div style={{
        background: "#fff", border: "1px solid #E2E8F0",
        borderRadius: 14, padding: "20px 22px",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F1F5F9",
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>企業一覧</h2>
          <Link href="/admin/companies" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
            すべて見る →
          </Link>
        </div>

        {stats.recentCompanies.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["企業名", "業界", "ステータス", "登録日"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "6px 10px",
                    fontSize: 10, fontWeight: 700, color: "#94A3B8",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    borderBottom: "1px solid #F1F5F9",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.recentCompanies.map((c: any) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                  <td style={{ padding: "10px 10px", fontWeight: 600, color: "#0F172A" }}>
                    <Link href={`/admin/companies/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      {c.name}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 10px", color: "#475569" }}>{c.industry || "—"}</td>
                  <td style={{ padding: "10px 10px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                      background: c.is_published ? "#ECFDF5" : "#F8FAFC",
                      color: c.is_published ? "var(--success)" : "#94A3B8",
                      border: `1px solid ${c.is_published ? "#A7F3D0" : "#E2E8F0"}`,
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: c.is_published ? "var(--success)" : "#94A3B8",
                      }} />
                      {c.is_published ? "公開中" : "非公開"}
                    </span>
                  </td>
                  <td style={{
                    padding: "10px 10px", color: "#94A3B8",
                    fontFamily: "'Inter', sans-serif", fontSize: 12,
                  }}>
                    {new Date(c.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "24px 0" }}>
            企業はまだ登録されていません
          </p>
        )}
      </div>
    </div>
  );
}
