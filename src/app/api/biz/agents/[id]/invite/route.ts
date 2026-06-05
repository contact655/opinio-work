import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { notify } from "@/lib/notify/email";

// POST /api/biz/agents/[id]/invite — send magic link to all contacts
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  const admin = createAdminClient();

  // Fetch company name and verify agency belongs to company in parallel
  const [companyRes, agencyRes] = await Promise.all([
    admin.from("ow_companies").select("name").eq("id", ctx.companyId).maybeSingle(),
    admin
      .from("ow_agent_agencies")
      .select("id, agency_name")
      .eq("id", params.id)
      .eq("company_id", ctx.companyId)
      .maybeSingle(),
  ]);

  const companyName = companyRes.data?.name ?? "企業";
  const agency = agencyRes.data;
  if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get all contacts for this agency
  const { data: contacts } = await admin
    .from("ow_agent_contacts")
    .select("id, name, email")
    .eq("agency_id", params.id);

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: "担当者が登録されていません" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  const redirectTo = `${siteUrl}/agent/dashboard`;

  // Generate magic links and send emails
  const results = await Promise.allSettled(
    contacts.map(async (contact) => {
      // Generate Supabase magic link
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: contact.email,
        options: { redirectTo },
      });

      if (linkErr || !linkData?.properties?.action_link) {
        console.error("[agents/invite] generateLink error:", linkErr);
        throw new Error(`Failed to generate link for ${contact.email}`);
      }

      const magicLink = linkData.properties.action_link;

      await notify({
        to: contact.email,
        subject: "OPINIOエージェントポータルへの招待",
        html: `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Noto Sans JP',sans-serif;background:#F8FAFC;margin:0;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,var(--royal),#3B5FD9);padding:32px;text-align:center;">
      <span style="font-family:Inter,sans-serif;font-weight:800;font-size:24px;color:#fff;letter-spacing:-0.02em;">OPINIO</span>
      <div style="margin-top:8px;display:inline-block;background:rgba(255,255,255,0.15);border-radius:4px;padding:3px 10px;">
        <span style="font-size:11px;color:#fff;font-weight:600;letter-spacing:0.1em;">エージェントポータル</span>
      </div>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;font-weight:700;color:#0F172A;margin:0 0 8px;">${contact.name} さん</p>
      <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 24px;">
        ${companyName}のエージェントポータルへご招待します。<br>
        以下のボタンからポータルにアクセスしてください。
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${magicLink}"
           style="display:inline-block;background:linear-gradient(135deg,var(--royal),#3B5FD9);color:#fff;
                  text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;
                  font-size:15px;letter-spacing:0.02em;">
          ポータルにログイン
        </a>
      </div>
      <p style="font-size:12px;color:#94A3B8;line-height:1.6;margin:0;">
        このリンクは1時間有効です。リンクが切れた場合は、
        <a href="${siteUrl}/agent/auth" style="color:#3B5FD9;">ポータルログインページ</a>
        から再度リクエストしてください。
      </p>
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
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  const succeeded = results.length - failed;

  return NextResponse.json({
    ok: true,
    sent: succeeded,
    failed,
    total: contacts.length,
  });
}
