import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/isAdmin";

export const dynamic = "force-dynamic";

// POST /api/admin/school-requests/[id]/approve
//
// 学校追加リクエストを承認する。
// approve_school_request() PostgreSQL 関数を呼び出し、以下を一括実行する:
//   1. ow_schools に新しい学校を INSERT
//   2. ow_school_requests.status を 'approved' に UPDATE
//   3. 同名学校の ow_user_educations.school_id を一括 UPDATE
//
// Body: { logo_letter: string, logo_gradient: string }
// Response 200: { school_id, request_id, updated_educations_count }
// Error codes:
//   400 — バリデーションエラー
//   401 — 未認証
//   403 — 管理者以外
//   404 — リクエストが見つからない (ERRCODE P0001)
//   409 — リクエストが pending 状態でない (ERRCODE P0002)
//   500 — 内部エラー

export async function POST(
  req: Request,
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

  // ── 3. ボディ検証 ────────────────────────────────────────────────────────
  let body: { logo_letter?: unknown; logo_gradient?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { logo_letter, logo_gradient } = body;

  if (!logo_letter || typeof logo_letter !== "string" || logo_letter.trim() === "") {
    return NextResponse.json({ error: "logo_letter is required" }, { status: 400 });
  }
  if (!logo_gradient || typeof logo_gradient !== "string" || logo_gradient.trim() === "") {
    return NextResponse.json({ error: "logo_gradient is required" }, { status: 400 });
  }
  if (logo_letter.trim().length > 4) {
    return NextResponse.json({ error: "logo_letterは4文字以内です" }, { status: 400 });
  }
  if (logo_gradient.trim().length > 200) {
    return NextResponse.json({ error: "logo_gradientは200文字以内です" }, { status: 400 });
  }

  // ── 4. approve_school_request() 呼び出し ─────────────────────────────────
  //    service role クライアントで呼び出すことで RLS をバイパス
  //    関数内で 3 ステップがアトミックに実行される
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc("approve_school_request", {
    p_request_id: requestId,
    p_logo_letter: logo_letter.trim(),
    p_logo_gradient: logo_gradient.trim(),
    p_approved_by: user.id, // auth.users.id を渡す (関数内で ow_users.id に解決)
  });

  if (error) {
    // PostgreSQL カスタム ERRCODE をマッピング
    const pgCode = (error as { code?: string }).code;
    if (pgCode === "P0001") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (pgCode === "P0002") {
      return NextResponse.json({ error: "Request is not pending" }, { status: 409 });
    }
    console.error("[POST /api/admin/school-requests/[id]/approve]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // RETURNS TABLE → 配列の最初の要素を取り出す
  const result = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    school_id: result.school_id,
    request_id: requestId,
    updated_educations_count: result.updated_educations_count,
  });
}
