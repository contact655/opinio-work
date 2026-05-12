import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/isAdmin";

export const dynamic = "force-dynamic";

// GET /api/admin/school-requests — pending リクエスト一覧(admin 専用)
export async function GET() {
  // 1. 認証チェック
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 認可チェック(admin のみ)
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. service role で pending リクエストを取得(RLS をバイパスして全ユーザー分を取得)
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
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
    console.error("[GET /api/admin/school-requests]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // 4. レスポンス整形: requested_by_user.email をフラットに展開
  const requests = (data ?? []).map((row) => ({
    id: row.id,
    school_name: row.school_name,
    school_name_kana: row.school_name_kana ?? null,
    requested_by_email:
      (row.requested_by_user as unknown as { email: string } | null)?.email ?? "—",
    created_at: row.created_at,
  }));

  return NextResponse.json({ requests, count: requests.length });
}
