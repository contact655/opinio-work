import { createClient } from "@/lib/supabase/server";

async function getUsers(query?: string) {
  const supabase = createClient();
  let q = supabase
    .from("ow_users")
    .select("id, name, email, is_mentor, location, age_range, visibility, created_at")
    .order("created_at", { ascending: false });

  if (query) {
    q = q.or(`name.ilike.%${query}%,email.ilike.%${query}%,location.ilike.%${query}%`);
  }

  const { data } = await q.limit(100);
  return data || [];
}

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const users = await getUsers(searchParams.q);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">候補者管理</h1>
        <span className="text-sm text-gray-500">{users.length}名</span>
      </div>

      {/* Search */}
      <form action="/admin/candidates" method="GET" className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q}
          placeholder="名前・メール・所在地で検索..."
          className="w-full max-w-md px-4 py-2.5 bg-white border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </form>

      {/* Table */}
      <div className="bg-white rounded-card border border-card-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">名前</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">メール</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">居住地</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">年代</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">公開設定</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">メンター</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">登録日</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  ユーザーが見つかりません
                </td>
              </tr>
            ) : (
              users.map((u: any) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                        {u.name?.[0] || "?"}
                      </div>
                      <span className="font-medium">{u.name || "未入力"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.location || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{u.age_range || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      u.visibility === "public" ? "bg-green-100 text-green-700" :
                      u.visibility === "login_only" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {u.visibility === "public" ? "公開" :
                       u.visibility === "login_only" ? "ログイン限定" : "非公開"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_mentor ? (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">メンター</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString("ja-JP")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
