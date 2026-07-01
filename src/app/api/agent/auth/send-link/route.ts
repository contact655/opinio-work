import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify/email";
import { NextResponse, NextRequest } from "next/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Rate limiting is handled by Supabase Auth's built-in magic link rate limits

// POST /api/agent/auth/send-link
// Body: { email }
export async function POST(req: NextRequest) {

  let body: { email: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    // Return 200 to prevent user enumeration
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  // Check if email exists in ow_agent_contacts
  const { data: contact } = await admin
    .from("ow_agent_contacts")
    .select("id, name, agency_id")
    .eq("email", email)
    .maybeSingle();

  if (!contact) {
    // Return 200 regardless to prevent user enumeration
    return NextResponse.json({ ok: true });
  }

  // Verify the agency is still active
  const { data: agency } = await admin
    .from("ow_agent_agencies")
    .select("id, agency_name, is_active")
    .eq("id", contact.agency_id)
    .maybeSingle();

  if (!agency || !agency.is_active) {
    return NextResponse.json(
      { error: "このアカウントは現在ご利用いただけません" },
      { status: 403 }
    );
  }

  const redirectTo = `${SITE_URL}/agent/dashboard`;

  // Generate magic link
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error("[agent/auth/send-link] generateLink error:", linkErr);
    return NextResponse.json({ error: "リンクの生成に失敗しました" }, { status: 500 });
  }

  const magicLink = linkData.properties.action_link;

  await notify({
    to: email,
    subject: "エージェントポータルへのログインリンク | OPINIO",
    html: `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Noto Sans JP',sans-serif;background:#F8FAFC;margin:0;padding:40px 20px;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,var(--royal),#3B5FD9);padding:32px;text-align:center;">
      <span style="font-family:Inter,sans-serif;font-weight:800;font-size:24px;color:#fff;letter-spacing:-0.02em;">OPINIO</span>
      <div style="margin-top:8px;">
        <span style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:4px;padding:3px 10px;font-size:11px;color:#fff;font-weight:600;letter-spacing:0.1em;">
          エージェントポータル
        </span>
      </div>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;font-weight:700;color:#0F172A;margin:0 0 8px;">
        ${esc(contact.name)} さん
      </p>
      <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 8px;">
        OPINIOエージェントポータルへのログインリクエストを受け付けました。
      </p>
      <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 28px;">
        以下のボタンからポータルにアクセスできます。
      </p>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${magicLink}"
           style="display:inline-block;background:linear-gradient(135deg,var(--royal),#3B5FD9);color:#fff;
                  text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;
                  font-size:15px;letter-spacing:0.02em;">
          ポータルにログイン
        </a>
      </div>
      <div style="background:#F8FAFC;border-radius:8px;padding:14px 16px;">
        <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:0;">
          ⚠ このリンクは<strong>1時間</strong>有効です。<br>
          心当たりのない場合は、このメールを無視してください。
        </p>
      </div>
    </div>
    <div style="border-top:1px solid #E2E8F0;padding:16px 32px;background:#F8FAFC;">
      <p style="font-size:11px;color:#94A3B8;margin:0;text-align:center;">
        OPINIO — IT/SaaSキャリアプラットフォーム
      </p>
    </div>
  </div>
</body>
</html>`,
  });

  return NextResponse.json({ ok: true });
}
