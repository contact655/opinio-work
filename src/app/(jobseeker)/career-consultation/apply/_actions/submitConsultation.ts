"use server";

import { notify } from "@/lib/notify/email";

type Params = {
  consultantName: string;
  name: string;
  email: string;
  message: string;
  timePref: string[];
};

export async function submitConsultationRequest(params: Params): Promise<{ ok: boolean }> {
  const { consultantName, name, email, message, timePref } = params;

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "contact@opinio.co.jp";

  const timePrefText = timePref.length > 0
    ? timePref.join("、")
    : "（指定なし）";

  const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
  <h2 style="color: #002366; margin-bottom: 4px;">キャリア相談 申し込みがありました</h2>
  <p style="color: #475569; font-size: 13px; margin-top: 0;">担当アドバイザー: ${consultantName}</p>
  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr>
      <td style="padding: 10px 0; color: #94A3B8; font-weight: 600; width: 120px; vertical-align: top;">お名前</td>
      <td style="padding: 10px 0; color: #0F172A;">${escHtml(name)}</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; color: #94A3B8; font-weight: 600; vertical-align: top;">メール</td>
      <td style="padding: 10px 0;"><a href="mailto:${escHtml(email)}" style="color: #002366;">${escHtml(email)}</a></td>
    </tr>
    <tr>
      <td style="padding: 10px 0; color: #94A3B8; font-weight: 600; vertical-align: top;">希望時間帯</td>
      <td style="padding: 10px 0; color: #0F172A;">${escHtml(timePrefText)}</td>
    </tr>
    ${message ? `
    <tr>
      <td style="padding: 10px 0; color: #94A3B8; font-weight: 600; vertical-align: top;">相談内容</td>
      <td style="padding: 10px 0; color: #0F172A; white-space: pre-wrap;">${escHtml(message)}</td>
    </tr>` : ""}
  </table>
  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
  <p style="font-size: 12px; color: #94A3B8;">このメールはOPINIOのキャリア相談申し込みフォームから自動送信されました。</p>
</div>
  `;

  await notify({
    to: ADMIN_EMAIL,
    subject: `【OPINIO】キャリア相談申し込み: ${name}さん`,
    html,
  });

  // 申込者への自動返信
  await notify({
    to: email,
    subject: "【OPINIO】キャリア相談の申し込みを受け付けました",
    html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
  <h2 style="color: #002366;">キャリア相談のお申し込みありがとうございます</h2>
  <p style="font-size: 14px; color: #475569; line-height: 1.8;">
    ${escHtml(name)} 様<br /><br />
    キャリア相談のお申し込みを受け付けました。<br />
    担当アドバイザーより、3営業日以内にご連絡いたします。
  </p>
  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
  <p style="font-size: 12px; color: #94A3B8;">
    OPINIO — IT/SaaS業界のキャリアプラットフォーム<br />
    このメールは自動送信です。返信は受け付けておりません。
  </p>
</div>
    `,
  });

  return { ok: true };
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
