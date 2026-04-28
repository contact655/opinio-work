import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPIRY_DAYS = 7;

function err(status: number, code: string, message: string, extra?: Record<string, string>) {
  return NextResponse.json({ error: message, code, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  // 1. JSON parse
  let invitation_token: string;
  try {
    const body = await req.json();
    invitation_token = body.invitation_token;
  } catch {
    return err(400, "INVALID_TOKEN", "リクエスト形式が不正です");
  }

  // 2. UUID 形式チェック
  if (!invitation_token || !UUID_RE.test(invitation_token)) {
    return err(400, "INVALID_TOKEN", "招待トークンの形式が不正です");
  }

  const admin = createAdminClient();

  // 3. トークン検証 (user_id IS NULL = 未受諾)
  const { data: inviteRow } = await admin
    .from("ow_company_admins")
    .select("id, company_id, invited_email, invited_at, permission")
    .eq("invitation_token", invitation_token)
    .is("user_id", null)
    .maybeSingle();

  if (!inviteRow) {
    return err(404, "TOKEN_NOT_FOUND_OR_USED", "招待トークンが見つからないか、すでに使用済みです");
  }

  // 4. 有効期限チェック (invited_at + 7 days)
  const invitedAt = new Date(inviteRow.invited_at);
  const expiresAt = new Date(invitedAt.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  if (Date.now() > expiresAt.getTime()) {
    return err(410, "TOKEN_EXPIRED", `招待リンクの有効期限が切れています（有効期間 ${EXPIRY_DAYS} 日）`);
  }

  // 5. 認証チェック (通常クライアントで)
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return err(401, "LOGIN_REQUIRED", "招待を受諾するにはログインまたはサインアップが必要です");
  }

  // 6. email 一致チェック
  const loggedInEmail = (user.email ?? "").toLowerCase().trim();
  const invitedEmail = (inviteRow.invited_email ?? "").toLowerCase().trim();
  if (loggedInEmail !== invitedEmail) {
    return err(403, "EMAIL_MISMATCH", "ログイン中のメールアドレスが招待先と一致しません", {
      invited_email: inviteRow.invited_email ?? "",
      logged_in_email: user.email ?? "",
    });
  }

  // 7. owUserId の解決
  const { data: owUser } = await admin
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!owUser) {
    return err(500, "USER_NOT_FOUND", "ユーザー情報が見つかりません");
  }
  const owUserId = owUser.id;

  // 8. 既存メンバーシップチェック (invitation row と別の active レコード)
  const { data: existingMembership } = await admin
    .from("ow_company_admins")
    .select("id")
    .eq("user_id", owUserId)
    .eq("company_id", inviteRow.company_id)
    .eq("is_active", true)
    .maybeSingle();

  if (existingMembership) {
    return err(409, "ALREADY_MEMBER", "すでにこの企業のメンバーです");
  }

  // 9. 受諾処理 — invitation_token をクリア、user_id + 日時をセット
  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("ow_company_admins")
    .update({
      user_id: owUserId,
      accepted_at: now,
      joined_at: now,
      invitation_token: null,
      invited_email: null,
    })
    .eq("id", inviteRow.id);

  if (updateErr) {
    console.error("[accept POST update]", updateErr.message);
    return err(500, "DB_ERROR", "受諾処理に失敗しました");
  }

  // 10. 受諾した会社名を取得
  const { data: company } = await admin
    .from("ow_companies")
    .select("name")
    .eq("id", inviteRow.company_id)
    .maybeSingle();

  // 11. biz_current_company_id Cookie をセット
  const res = NextResponse.json({
    success: true,
    company_id: inviteRow.company_id,
    company_name: company?.name ?? "(不明)",
    redirectTo: "/biz/dashboard",
  });
  res.cookies.set("biz_current_company_id", inviteRow.company_id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
