import { Resend } from "resend";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[consultation-request/notify] RESEND_API_KEY not set");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const fromEmail = process.env.RESEND_fromEmail || "onboarding@resend.dev";
    const adminEmail = process.env.adminEmail || "hshiba@opinio.co.jp";

    const { userName, userEmail, mentorName, message, preferredTime } =
      await req.json();

    // ① Admin notification
    await resend.emails.send({
      from: `opinio.work <${fromEmail}>`,
      to: adminEmail,
      subject: `【新着】${mentorName}への相談申し込みがありました`,
      html: `
        <h2>新しい相談申し込みがあります</h2>
        <p><strong>申し込み者：</strong>${userName}（${userEmail}）</p>
        <p><strong>希望メンター：</strong>${mentorName}</p>
        <p><strong>希望時間帯：</strong>${preferredTime ?? "未指定"}</p>
        <p><strong>相談内容：</strong></p>
        <p>${message}</p>
        <hr/>
        <p>内容を確認の上、マッチングを判断してください。</p>
      `,
    });

    // ② User confirmation
    await resend.emails.send({
      from: `opinio.work <${fromEmail}>`,
      to: userEmail,
      subject: "【opinio.work】相談申し込みを受け付けました",
      html: `
        <h2>${userName}さん、申し込みありがとうございます。</h2>
        <p>${mentorName}さんへの相談申し込みを受け付けました。</p>
        <p>内容を確認の上、<strong>3営業日以内</strong>にこのメールアドレスにご連絡します。</p>
        <p>しばらくお待ちください。</p>
        <hr/>
        <p style="color:#999;font-size:12px;">opinio.work — Truth to Careers</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[consultation-request/notify] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
