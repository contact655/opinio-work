import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ── データ取得(server-side 直接クエリ、service role で RLS バイパス)──────────

type SchoolRequest = {
  id: string;
  school_name: string;
  school_name_kana: string | null;
  requested_by_email: string;
  created_at: string;
};

async function fetchPendingRequests(): Promise<SchoolRequest[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ow_school_requests")
    .select(`
      id,
      school_name,
      school_name_kana,
      created_at,
      requested_by_user:ow_users!ow_school_requests_requested_by_fkey (
        email
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/school-requests]", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    school_name: row.school_name,
    school_name_kana: row.school_name_kana ?? null,
    requested_by_email:
      (row.requested_by_user as unknown as { email: string } | null)?.email ?? "—",
    created_at: row.created_at,
  }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── ページ ─────────────────────────────────────────────────────────────────────
// 認可は /admin/layout.tsx が処理済み(auth_is_admin RPC)

export default async function SchoolRequestsPage() {
  const requests = await fetchPendingRequests();

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">学校追加リクエスト</h1>
          <p className="text-sm text-gray-500 mt-1">
            ユーザーから送られた学校マスター追加リクエスト
          </p>
        </div>
        <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-sm font-medium rounded-full">
          pending {requests.length} 件
        </span>
      </div>

      {/* 空状態 */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-card border border-card-border p-12 text-center">
          <p className="text-gray-400 text-sm">現在 pending のリクエストはありません</p>
        </div>
      ) : (
        /* リスト */
        <div className="bg-white rounded-card border border-card-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">学校名</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">ふりがな</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">送信者</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">送信日時</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req, idx) => (
                <tr
                  key={req.id}
                  className={idx < requests.length - 1 ? "border-b border-gray-50" : ""}
                >
                  <td className="px-5 py-3.5 font-medium text-gray-800">
                    {req.school_name}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {req.school_name_kana ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {req.requested_by_email}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {formatDate(req.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 承認/却下 アクション説明(Phase 3/4 実装予定) */}
      {requests.length > 0 && (
        <p className="text-xs text-gray-400 mt-4">
          承認・却下機能は準備中です。現在は Supabase Dashboard SQL で手動対応してください。
        </p>
      )}
    </div>
  );
}
