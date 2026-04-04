import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

async function getStats() {
  const supabase = createClient();
  const [profiles, companies, , , pendingCompanies, pendingJobs] =
    await Promise.all([
      supabase.from("ow_profiles").select("id", { count: "exact", head: true }),
      supabase.from("ow_companies").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("ow_jobs").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("ow_applications").select("id", { count: "exact", head: true }),
      supabase.from("ow_companies").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("ow_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  // Recent candidates
  const { data: recentCandidates } = await supabase
    .from("ow_profiles")
    .select("id, name, job_type, location, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Offered applications
  const { data: offeredApps } = await supabase
    .from("ow_applications")
    .select("id, status, updated_at, ow_jobs(title, ow_companies(name))")
    .eq("status", "offered")
    .order("updated_at", { ascending: false })
    .limit(5);

  // Recent companies
  const { data: recentCompanies } = await supabase
    .from("ow_companies")
    .select("id, name, industry, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    candidatesCount: profiles.count || 0,
    companiesCount: companies.count || 0,
    offeredCount: (await supabase.from("ow_applications").select("id", { count: "exact", head: true }).eq("status", "offered")).count || 0,
    earlyTurnover: 0,
    pendingCompaniesCount: pendingCompanies.count || 0,
    pendingJobsCount: pendingJobs.count || 0,
    recentCandidates: recentCandidates || [],
    offeredApps: offeredApps || [],
    recentCompanies: recentCompanies || [],
  };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "登録候補者数", value: stats.candidatesCount, color: "text-blue-600" },
          { label: "クライアント企業数", value: stats.companiesCount, color: "text-primary" },
          { label: "今月の内定数", value: stats.offeredCount, color: "text-purple-600" },
          { label: "早期離職数（累計）", value: stats.earlyTurnover, color: "text-red-500", sub: "常にゼロを維持" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-card p-5 border border-card-border">
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            {kpi.sub && <p className="text-[10px] text-gray-400 mt-1">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Action Tasks + Recent Candidates */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Tasks */}
        <div className="bg-white rounded-card p-5 border border-card-border">
          <h2 className="text-sm font-bold mb-4">要対応タスク</h2>
          <div className="space-y-2">
            {stats.offeredApps.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700">内定承諾期限</p>
                  <p className="text-xs text-red-500">{stats.offeredApps.length}件の内定返答待ち</p>
                </div>
                <span className="text-xs text-red-400">緊急</span>
              </div>
            )}
            {stats.pendingCompaniesCount > 0 && (
              <Link href="/admin/companies" className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100 hover:bg-yellow-100 transition-colors">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-700">企業審査待ち</p>
                  <p className="text-xs text-yellow-600">{stats.pendingCompaniesCount}社の審査が必要</p>
                </div>
              </Link>
            )}
            {stats.pendingJobsCount > 0 && (
              <Link href="/admin/jobs" className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100 hover:bg-yellow-100 transition-colors">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-700">求人審査待ち</p>
                  <p className="text-xs text-yellow-600">{stats.pendingJobsCount}件の審査が必要</p>
                </div>
              </Link>
            )}
            {stats.pendingCompaniesCount === 0 && stats.pendingJobsCount === 0 && stats.offeredApps.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">対応が必要なタスクはありません</p>
            )}
          </div>
        </div>

        {/* Recent Candidates */}
        <div className="bg-white rounded-card p-5 border border-card-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold">最近の登録候補者</h2>
            <Link href="/admin/candidates" className="text-xs text-primary hover:underline">すべて見る →</Link>
          </div>
          {stats.recentCandidates.length > 0 ? (
            <div className="space-y-3">
              {stats.recentCandidates.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary text-xs font-bold">
                    {c.name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name || "未入力"}</p>
                    <p className="text-xs text-gray-400">{c.job_type || "職種未設定"} / {c.location || "未設定"}</p>
                  </div>
                  <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString("ja-JP")}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">候補者はまだいません</p>
          )}
        </div>
      </div>

      {/* Recent Companies */}
      <div className="bg-white rounded-card p-5 border border-card-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold">企業一覧</h2>
          <Link href="/admin/companies" className="text-xs text-primary hover:underline">すべて見る →</Link>
        </div>
        {stats.recentCompanies.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs text-gray-400 font-medium">企業名</th>
                <th className="text-left py-2 text-xs text-gray-400 font-medium">業界</th>
                <th className="text-left py-2 text-xs text-gray-400 font-medium">ステータス</th>
                <th className="text-left py-2 text-xs text-gray-400 font-medium">登録日</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentCompanies.map((c: any) => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="py-2.5 font-medium">{c.name}</td>
                  <td className="py-2.5 text-gray-500">{c.industry || "-"}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      c.status === "active" ? "bg-green-100 text-green-700" :
                      c.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>{c.status === "active" ? "承認済" : c.status === "pending" ? "審査中" : "却下"}</span>
                  </td>
                  <td className="py-2.5 text-gray-400">{new Date(c.created_at).toLocaleDateString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">企業はまだ登録されていません</p>
        )}
      </div>
    </div>
  );
}
