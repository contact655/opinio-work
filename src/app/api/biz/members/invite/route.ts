import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { addExistingUserToCompany } from "../_lib";

function getBaseUrl(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { email?: string; permission?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  if (!email.includes("@")) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }
  const permission = body.permission;
  if (permission !== "admin" && permission !== "member") {
    return NextResponse.json({ error: "権限が不正です" }, { status: 400 });
  }

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) {
    return NextResponse.json({ error: "Company context not found" }, { status: 403 });
  }
  const { owUserId: actorOwUserId, companyId, allMemberships } = ctx;

  const actorMembership = allMemberships.find((m) => m.companyId === companyId);
  if (actorMembership?.permission !== "admin") {
    return NextResponse.json({ error: "メンバー追加は管理者のみ可能です" }, { status: 403 });
  }

  // Case 1: ow_users にすでに存在するユーザー → 直接追加（M-3 と同じパス）
  const { data: targetUser } = await supabase
    .from("ow_users")
    .select("id, name, email")
    .eq("email", email)
    .maybeSingle();

  if (targetUser) {
    const result = await addExistingUserToCompany({ supabase, targetUser, companyId, permission });
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
    return NextResponse.json(
      { success: true, already_registered: true, member: result.member },
      { status: 201 }
    );
  }

  // Case 2: 未登録ユーザー → pending 招待レコードを作成
  const { data: existingPending } = await supabase
    .from("ow_company_admins")
    .select("id")
    .eq("company_id", companyId)
    .eq("invited_email", email)
    .is("user_id", null)
    .maybeSingle();

  if (existingPending) {
    return NextResponse.json(
      { error: "このメールアドレスは既に招待済みです", code: "ALREADY_INVITED" },
      { status: 409 }
    );
  }

  const inviteToken = crypto.randomUUID();
  const invitedAt = new Date();
  const expiresAt = new Date(invitedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: newRow, error: insertErr } = await supabase
    .from("ow_company_admins")
    .insert({
      user_id: null,
      company_id: companyId,
      permission,
      is_active: true,
      invited_email: email,
      invited_by_user_id: actorOwUserId,
      invitation_token: inviteToken,
      invited_at: invitedAt.toISOString(),
    })
    .select("id, invited_at")
    .single();

  if (insertErr || !newRow) {
    console.error("[invite POST insert]", insertErr?.message);
    return NextResponse.json({ error: insertErr?.message ?? "Failed" }, { status: 500 });
  }

  const baseUrl = getBaseUrl(req);
  const inviteUrl = `${baseUrl}/biz/auth/accept-invite?token=${inviteToken}`;

  return NextResponse.json(
    {
      success: true,
      already_registered: false,
      invite_token: inviteToken,
      invite_url: inviteUrl,
      expires_at: expiresAt.toISOString(),
    },
    { status: 201 }
  );
}
