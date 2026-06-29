import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

type InvitePayload = {
  emails: string[];          // 招待先メールアドレス一覧
  role: "candidate" | "biz"; // candidate=求職者, biz=企業担当者
  message?: string;          // カスタムメッセージ（省略可）
};

/**
 * POST /api/admin/invite
 * Body: { emails: string[], role: "candidate"|"biz", message?: string }
 *
 * Supabase Admin API で inviteUserByEmail を呼び出す（パスワード設定不要の招待リンク）。
 * 管理者 (ADMIN_EMAILS) のみ呼び出し可能。
 */
export async function POST(req: Request) {
  // ── 認証 + admin チェック ────────────────────────────────────────────────
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  let body: InvitePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { emails, role, message } = body;

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "emails must be a non-empty array" }, { status: 400 });
  }
  if (emails.length > 50) {
    return NextResponse.json({ error: "max 50 emails per request" }, { status: 400 });
  }
  if (!["candidate", "biz"].includes(role)) {
    return NextResponse.json({ error: "role must be 'candidate' or 'biz'" }, { status: 400 });
  }

  // ── Admin クライアント（SERVICE_ROLE）で inviteUserByEmail ───────────────
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://opinio.jp";
  // biz ユーザーは /auth/callback?biz=1 へ（/biz/auth/callback は存在しない）
  const redirectTo = role === "biz"
    ? `${siteUrl}/auth/callback?biz=1`
    : `${siteUrl}/auth/callback`;

  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const email of emails) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      results.push({ email: normalizedEmail, ok: false, error: "invalid email" });
      continue;
    }

    try {
      const { error } = await adminSupabase.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo,
        data: {
          invited_role: role,
          invited_by: user.email,
        },
      });

      if (error) {
        results.push({ email: normalizedEmail, ok: false });
      } else {
        results.push({ email: normalizedEmail, ok: true });

        // ── カスタムメッセージがあれば追加メールも送る（best-effort）──
        if (message) {
          await notify({
            to: normalizedEmail,
            subject: "【OPINIO】招待のご案内",
            html: buildInviteHtml(normalizedEmail, role, message, siteUrl),
          }).catch(() => {/* best-effort */});
        }
      }
    } catch (e) {
      results.push({ email: normalizedEmail, ok: false });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed    = results.filter((r) => !r.ok).length;

  return NextResponse.json({ succeeded, failed, results }, { status: 200 });
}

// ── 招待メール HTML ──────────────────────────────────────────────────────────
function buildInviteHtml(email: string, role: string, message: string, siteUrl: string): string {
  const roleLabel = role === "biz" ? "企業の採用担当者" : "求職者";
  const btn = "display:inline-block;background:#002366;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px";

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr>
          <td style="background:linear-gradient(135deg,#002366,#3B5FD9);padding:28px 40px">
            <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em">OPINIO</span>
            <span style="font-size:11px;color:rgba(255,255,255,0.7);margin-left:12px">IT/SaaS業界のキャリアインフラ</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;color:#0f172a;line-height:1.7;font-size:14px">
            <h2 style="margin:0 0 8px;font-size:20px;color:#002366">OPINIO へ招待されました</h2>
            <p style="margin:0 0 20px;color:#475569">${email} 様</p>

            <div style="background:#eff3fc;border-radius:8px;padding:16px 20px;margin-bottom:20px;border-left:3px solid #002366">
              <p style="margin:0;font-size:13px;color:#334155;line-height:1.7;white-space:pre-wrap">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            </div>

            <p style="margin:0 0 8px;font-size:13px;color:#475569">
              OPINIO は IT/SaaS 業界に特化したキャリアプラットフォームです。<br>
              ${roleLabel}として、下記ボタンからアカウントを作成してください。
            </p>

            <p style="margin:24px 0">
              <a href="${siteUrl}/auth" style="${btn}">アカウントを作成する →</a>
            </p>

            <p style="font-size:12px;color:#94a3b8">
              ※ 別途 Supabase から認証メールが届きます。そちらのリンクからもアカウント作成が可能です。
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7">
              このメールは <a href="https://opinio.jp" style="color:#3B5FD9">opinio.jp</a> の管理者から送信されました。<br>
              心当たりのない場合は、このメールを無視してください。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
