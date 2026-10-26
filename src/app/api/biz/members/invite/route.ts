import { can, isCompanyRole, toCompanyRole, ROLE_LABELS } from "@/lib/auth/roles";
import { roleIn } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { sendEmail } from "@/lib/notify/email";
import { companyInviteTemplate } from "@/lib/notify/templates";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://opinio.jp";
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
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }
  const permission = body.permission;
  /* ★役割は4つ（2026-10-12。lib/auth/roles.ts）。旧値 member は採用担当として受ける */
  if (permission !== "member" && !isCompanyRole(permission)) {
    return NextResponse.json({ error: "権限が不正です" }, { status: 400 });
  }
  const role = toCompanyRole(permission)!;

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) {
    return NextResponse.json({ error: "Company context not found" }, { status: 403 });
  }
  const { owUserId: actorOwUserId, companyId, allMemberships } = ctx;

  if (!can(roleIn(allMemberships, companyId), "members.manage")) {
    return NextResponse.json({ error: "メンバー追加は管理者のみ可能です" }, { status: 403 });
  }

  /* ★既にアカウントがある人も「招待中」で作る（2026-10-26 / フェーズ1a-1）。
        それまでは Case 1 として `addExistingUserToCompany` で**本人の承諾なしに**担当者へ足していた
        （is_active=true で即時。応募・候補者・メッセージがその場で読めた）。
        いまは未登録の人と同じく、招待の行（user_id=null・is_active=false・トークン7日）を作り、
        本人が /biz/auth/accept-invite で承諾したときだけ有効になる。
     ⚠️ admin クライアントで引く。2026-08-06 に authenticated から ow_users.email の
        SELECT 権限を剥がしたため、session では読めない。 */
  const admin = createAdminClient();
  /* ⚠️★LIKE の記号（% _ \）は必ず逃がす（2026-10-26 のセキュリティレビュー）。逃がさないと
        「%@%.%」のような入力が他人のメールに当たり、パターンでメールアドレスを探り当てられる。
        大文字小文字だけを無視した完全一致にする。 */
  const escapedEmail = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: targetUser } = await admin
    .from("ow_users")
    .select("id")
    .ilike("email", escapedEmail)
    .maybeSingle();

  if (targetUser) {
    const { data: activeRow } = await admin
      .from("ow_company_admins")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", targetUser.id)
      .eq("is_active", true)
      .maybeSingle();
    if (activeRow) {
      return NextResponse.json({ error: "このユーザーはすでにメンバーです", code: "DUPLICATE" }, { status: 409 });
    }
  }
  /* ⚠️ 招待先には**入力されたメール**をそのまま入れる。DB のメールを返さない（招待中の一覧に出るため）。
        承諾の判定（accept/route.ts）は大文字小文字を無視して比べるので、表記の違いでは止まらない。 */
  const inviteEmail = email;

  // Case 2: 未登録ユーザー → pending 招待レコードを作成
  const { data: existingPending } = await supabase
    .from("ow_company_admins")
    .select("id")
    .eq("company_id", companyId)
    .eq("invited_email", inviteEmail)
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
      permission: role,
      /*
        ⚠️ 招待の時点では false（2026-08-05 に true から変更）。
           true を立てていたため is_active が「有効かどうか」ではなく
           「招待したかどうか」を意味していた。承諾時（POST /api/biz/members/accept）に
           user_id / accepted_at / joined_at と同じタイミングで true にする。
        ⚠️ これはフラグの名前と意味を一致させる変更で、脆弱性の修正ではない。
           招待だけの行は user_id が null で、getCompanyContext() は user_id 一致も
           見ているため、以前から /biz にはログインできなかった。
        ⚠️ 保留中の招待を一覧に出す fetchPendingInvitesForCompany() は
           is_active で絞らないこと。絞ると /biz/members から招待が消える。
      */
      is_active: false,
      // ⚠️ 作成経路を記録する。承諾（accept）では上書きしないこと。
      //    これは「どう作られたか」であって「いまどの状態か」ではない。
      created_via: "invite",
      invited_email: inviteEmail,
      invited_by_user_id: actorOwUserId,
      invitation_token: inviteToken,
      invited_at: invitedAt.toISOString(),
    })
    .select("id, invited_at")
    .single();

  if (insertErr || !newRow) {
    console.error("[invite POST insert]", insertErr?.message);
    return NextResponse.json({ error: "招待の作成に失敗しました" }, { status: 500 });
  }

  const baseUrl = getBaseUrl();
  const inviteUrl = `${baseUrl}/biz/auth/accept-invite?token=${inviteToken}`;

  // メール送信
  let emailSent = false;
  try {
    const [{ data: inviterUser }, { data: company }] = await Promise.all([
      supabase.from("ow_users").select("name").eq("id", actorOwUserId).maybeSingle(),
      supabase.from("ow_companies").select("name").eq("id", companyId).maybeSingle(),
    ]);
    await sendEmail(
      companyInviteTemplate({
        recipientEmail: inviteEmail,
        inviterName: inviterUser?.name ?? "採用担当者",
        companyName: company?.name ?? "",
        inviteUrl,
        /* ★招待した役割をそのまま書く（2026-10-12。それまでは常に「採用担当として」） */
        roleLabel: `${ROLE_LABELS[role]}として`,
      })
    );
    emailSent = true;
  } catch (err) {
    console.error("[invite POST email]", err);
  }

  return NextResponse.json(
    {
      success: true,
      /* ⚠️ 既にアカウントがある人にも招待を送るようになったので、ここは常に false
            （＝「追加しました」ではなく「招待を送りました」）。 */
      already_registered: false,
      expires_at: expiresAt.toISOString(),
      email_sent: emailSent,
    },
    { status: 201 }
  );
}
