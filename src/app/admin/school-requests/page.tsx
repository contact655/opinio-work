import { createAdminClient } from "@/lib/supabase/admin";
import SchoolRequestsList, {
  type SchoolRequest,
} from "@/components/admin/SchoolRequestsList";

export const dynamic = "force-dynamic";

// ── データ取得(server-side 直接クエリ、service role で RLS バイパス)──────────

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
      </div>

      {/* 一覧(Client Component — 承認/却下ボタン + モーダル + ダイアログ) */}
      <SchoolRequestsList initialRequests={requests} />
    </div>
  );
}
