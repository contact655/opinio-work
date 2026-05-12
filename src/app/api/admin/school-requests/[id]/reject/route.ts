import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/isAdmin";

export const dynamic = "force-dynamic";

// POST /api/admin/school-requests/[id]/reject
//
// 学校追加リクエストを却下する。
// reject_school_request() PostgreSQL 関数を呼び出し、
// ow_school_requests.status を 'rejected' に UPDATE する。
//
// Body: なし
// Response 200: { request_id, rejected_at }
// Error codes:
//   401 — 未認証
//   403 — 管理者以外
//   404 — リクエストが見つからない (ERRCODE P0001)
//   409 — リクエストが pending 状態でない (ERRCODE P0002)
//   500 — 内部エラー

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const requestId = params.id;

  // ── 1. 認証チェック ──────────────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. 認可チェック (admin のみ) ─────────────────────────────────────────
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 3. reject_school_request() 呼び出し ──────────────────────────────────
  //    body 不要(approve と異なり、logo パラメータなし)
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc("reject_school_request", {
    p_request_id: requestId,
    p_approved_by: user.id, // auth.users.id を渡す
  });

  if (error) {
    const pgCode = (error as { code?: string }).code;
    if (pgCode === "P0001") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (pgCode === "P0002") {
      return NextResponse.json({ error: "Request is not pending" }, { status: 409 });
    }
    console.error("[POST /api/admin/school-requests/[id]/reject]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // RETURNS TABLE → 配列の最初の要素
  const result = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    request_id: requestId,
    rejected_at: result.rejected_at,
  });
}
