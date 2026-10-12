import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { requireBizAction } from "@/lib/auth/companyAccess";
import { sendEmailStrict } from "@/lib/notify/email";
import { companyInviteTemplate } from "@/lib/notify/templates";
import { ROLE_LABELS, toCompanyRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://opinio.jp";
}

/**
 * ★招待の再送（2026-10-12 / 柴さんの指示）。管理者だけ（members.manage）。
 *
 * 新しいリンク（トークン）を作り、招待日時を今にする（期限はそこから7日。accept 側の計算は変えていない）。
 * ⚠️ 前のリンクは使えなくなる（トークンを入れ替えるため）。転送された古いメールで入られないように。
 * ⚠️ 対象は「まだ受けていない招待」（user_id が無い行）だけ。受け済みの人には送らない（409）。
 * ⚠️ メールが送れなくても招待は更新する（画面でリンクをコピーして渡せる）。送れたかは email_sent で返す。
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const a = await requireBizAction("members.manage");
  if (!a.ok) return a.response;
  const { companyId, owUserId } = a.actor;
  const db = createAdminClient();

  const { data: row, error } = await db.from("ow_company_admins")
    .select("id, company_id, user_id, invited_email, permission").eq("id", params.id).maybeSingle();
  if (error) {
    console.error("[members resend] fetch:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  /* ⚠️ 別の会社の行は「見つからない」と同じに返す */
  if (!row || row.company_id !== companyId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.user_id !== null || !row.invited_email) {
    return NextResponse.json({ error: "受諾済みの招待は再送できません", code: "ALREADY_ACCEPTED" }, { status: 409 });
  }

  const token = crypto.randomUUID();
  const invitedAt = new Date();
  const upd = await mutateOne(
    db.from("ow_company_admins").update({ invitation_token: token, invited_at: invitedAt.toISOString() }).eq("id", row.id),
    "members resend",
  );
  if (!upd.ok) return NextResponse.json({ error: upd.error }, { status: upd.status });

  const inviteUrl = `${getBaseUrl()}/biz/auth/accept-invite?token=${token}`;
  let emailSent = false;
  try {
    const [{ data: inviter }, { data: company }] = await Promise.all([
      db.from("ow_users").select("name").eq("id", owUserId).maybeSingle(),
      db.from("ow_companies").select("name").eq("id", companyId).maybeSingle(),
    ]);
    const r = await sendEmailStrict(companyInviteTemplate({
      recipientEmail: row.invited_email as string,
      inviterName: (inviter?.name as string | null) ?? "採用担当者",
      companyName: (company?.name as string | null) ?? "",
      inviteUrl,
      roleLabel: `${ROLE_LABELS[toCompanyRole(row.permission) ?? "recruiter"]}として`,
    }));
    /* ⚠️ 送れたかを正直に返す（sendEmail は失敗を握るので使わない） */
    emailSent = r.ok;
    if (!r.ok) console.error("[members resend] email:", r.error);
  } catch (err) {
    console.error("[members resend] email:", err);
  }

  return NextResponse.json({
    success: true,
    email_sent: emailSent,
    expires_at: new Date(invitedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    invite_url: inviteUrl,
  });
}
