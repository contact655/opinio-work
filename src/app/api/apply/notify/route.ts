import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { jobTitle, companyName, name, email, phone, message } =
      await req.json();

    if (!process.env.RESEND_API_KEY) {
      console.warn("[apply/notify] RESEND_API_KEY not set, skipping emails");
      return NextResponse.json({ ok: true, skipped: true });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Hisato宛通知
    await resend.emails.send({
      from: "opinio.work <noreply@opinio.work>",
      to: "hshiba@opinio.co.jp",
      subject: `【新着応募】${companyName}：${jobTitle}`,
      html: `
        <h2>新しい応募が届きました</h2>
        <p><strong>求人：</strong>${companyName} / ${jobTitle}</p>
        <p><strong>氏名：</strong>${name}</p>
        <p><strong>メール：</strong>${email}</p>
        <p><strong>電話：</strong>${phone ?? "未記入"}</p>
        <p><strong>メッセージ：</strong></p>
        <p>${message ?? "未記入"}</p>
      `,
    });

    // 応募者宛確認メール
    await resend.emails.send({
      from: "opinio.work <noreply@opinio.work>",
      to: email,
      subject: "【opinio.work】応募を受け付けました",
      html: `
        <h2>${name}さん、ご応募ありがとうございます。</h2>
        <p>${companyName}の「${jobTitle}」へのご応募を受け付けました。</p>
        <p>内容を確認の上、<strong>3営業日以内</strong>にこのメールアドレスにご連絡します。</p>
        <hr/>
        <p style="color:#999;font-size:12px;">opinio.work — Truth to Careers</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[apply/notify] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send" },
      { status: 500 }
    );
  }
}
