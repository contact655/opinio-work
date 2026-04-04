import { createClient } from "@/lib/supabase/server";

async function getCandidates(query?: string) {
  const supabase = createClient();
  let q = supabase
    .from("ow_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (query) {
    q = q.or(`name.ilike.%${query}%,job_type.ilike.%${query}%,location.ilike.%${query}%`);
  }

  const { data } = await q.limit(100);
  return data || [];
}

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const candidates = await getCandidates(searchParams.q);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">候補者管理</h1>
        <span className="text-sm text-gray-500">{candidates.length}名</span>
      </div>

      {/* Search */}
      <form action="/admin/candidates" method="GET" className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q}
          placeholder="名前・職種・所在地で検索..."
          className="w-full max-w-md px-4 py-2.5 bg-white border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </form>

      {/* Table */}
      <div className="bg-white rounded-card border border-card-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">名前</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">職種</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">居住地</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">経験年数</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">希望年収</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">希望働き方</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">転職時期</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">登録日</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  候補者が見つかりません
                </td>
              </tr>
            ) : (
              candidates.map((c: any) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center text-primary text-xs font-bold">
                        {c.name?.[0] || "?"}
                      </div>
                      <span className="font-medium">{c.name || "未入力"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.job_type || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.location || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.experience_years || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.desired_salary_min || c.desired_salary_max
                      ? `${c.desired_salary_min || "?"}〜${c.desired_salary_max || "?"}万`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {c.desired_work_style ? (
                      <span className="px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                        {c.desired_work_style === "remote" ? "リモート" :
                         c.desired_work_style === "hybrid" ? "ハイブリッド" : "出社"}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {c.transfer_timing ? (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        c.transfer_timing === "asap" ? "bg-red-100 text-red-600" :
                        c.transfer_timing === "3months" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {c.transfer_timing === "asap" ? "すぐにでも" :
                         c.transfer_timing === "3months" ? "3ヶ月以内" :
                         c.transfer_timing === "6months" ? "6ヶ月以内" : "情報収集中"}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(c.created_at).toLocaleDateString("ja-JP")}
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
