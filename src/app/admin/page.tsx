import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

async function getStats() {
  const supabase = createClient();

  const [users, activeCompanies, activeJobs, pendingCompanies, pendingMeetings, pendingReservations] =
    await Promise.all([
      supabase.from("ow_users").select("id", { count: "exact", head: true }),
      supabase.from("ow_companies").select("id", { count: "exact", head: true }).eq("is_published", true),
      supabase.from("ow_jobs").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("ow_companies").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("ow_casual_meetings").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("ow_mentor_reservations").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    ]);

  // Recent users
  const { data: recentUsers } = await supabase
    .from("ow_users")
    .select("id, name, email, is_mentor, location, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Recent companies
  const { data: recentCompanies } = await supabase
    .from("ow_companies")
    .select("id, name, industry, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    usersCount: users.count ?? 0,
    activeCompaniesCount: activeCompanies.count ?? 0,
    activeJobsCount: activeJobs.count ?? 0,
    pendingCompaniesCount: pendingCompanies.count ?? 0,
    pendingMeetingsCount: pendingMeetings.count ?? 0,
    pendingReservationsCount: pendingReservations.count ?? 0,
    recentUsers: recentUsers ?? [],
    recentCompanies: recentCompanies ?? [],
  };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "登録ユーザー数", value: stats.usersCount, color: "text-blue-600" },
          { label: "公開中の企業数", value: stats.activeCompaniesCount, color: "text-green-600" },
          { label: "公開中の求人数", value: stats.activeJobsCount, color: "text-purple-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-card p-5 border border-card-border">
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Action Tasks + Recent Users */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Tasks */}
        <div className="bg-white rounded-card p-5 border border-card-border">
          <h2 className="text-sm font-bold mb-4">要対応タスク</h2>
          <div className="space-y-2">
            {stats.pendingCompaniesCount > 0 && (
              <Link href="/admin/companies" className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100 hover:bg-yellow-100 transition-colors">
                <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-700">企業審査待ち</p>
                  <p className="text-xs text-yellow-600">{stats.pendingCompaniesCount}社の審査が必要</p>
                </div>
              </Link>
            )}
            {stats.pendingMeetingsCount > 0 && (
              <Link href="/admin/companies" className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700">カジュアル面談 申込待ち</p>
                  <p className="text-xs text-blue-600">{stats.pendingMeetingsCount}件</p>
                </div>
              </Link>
            )}
            {stats.pendingReservationsCount > 0 && (
              <Link href="/admin/reservations" className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors">
                <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-700">メンター相談 転送待ち</p>
                  <p className="text-xs text-purple-600">{stats.pendingReservationsCount}件</p>
                </div>
              </Link>
            )}
            {stats.pendingCompaniesCount === 0 && stats.pendingMeetingsCount === 0 && stats.pendingReservationsCount === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">対応が必要なタスクはありません</p>
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-card p-5 border border-card-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold">最近の登録ユーザー</h2>
            <Link href="/admin/candidates" className="text-xs text-primary hover:underline">すべて見る →</Link>
          </div>
          {stats.recentUsers.length > 0 ? (
            <div className="space-y-3">
              {stats.recentUsers.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                    {u.name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{u.name || "未入力"}</p>
                      {u.is_mentor && (
                        <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full flex-shrink-0">メンター</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(u.created_at).toLocaleDateString("ja-JP")}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">ユーザーはまだいません</p>
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
