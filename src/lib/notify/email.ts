import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@opinio.jp";
const FROM_NAME = "opinio.jp";

type EmailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(params: EmailParams): Promise<void> {
  // dev / API キーなしの場合は console.log で代替 (mock パターン)
  if (!RESEND_API_KEY) {
    console.log("[notify] sendEmail (mock):", {
      to: params.to,
      subject: params.subject,
      preview: params.html.substring(0, 100) + "...",
    });
    return;
  }

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    console.error("[notify] sendEmail error:", error);
  }
}

// best-effort wrap (失敗してもメインフローを止めない)
export async function notify(params: EmailParams): Promise<void> {
  try {
    await sendEmail(params);
  } catch (err) {
    console.error("[notify] notify failed silently:", err);
  }
}
