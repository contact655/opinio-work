import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify/email";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "contact@opinio.co.jp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const td  = "padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;width:140px;vertical-align:top;font-size:13px";
const td2 = "padding:8px 12px;border:1px solid #e2e8f0;font-size:13px";
const btn = "display:inline-block;background:#002366;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px";

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr>
          <td style="background:linear-gradient(135deg,#002366,#3B5FD9);padding:28px 40px">
            <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em">OPINIO Career</span>
            <span style="font-size:11px;color:rgba(255,255,255,0.7);margin-left:12px">キャリアエージェント</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;color:#0f172a;line-height:1.7;font-size:14px">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7">
              このメールは <a href="https://opinio.co.jp" style="color:#3B5FD9">opinio.co.jp</a> から自動送信されています。<br>
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

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name     = (body.name     ?? "").trim().slice(0, 100);
  const email    = (body.email    ?? "").trim().slice(0, 254);
  const current  = (body.current  ?? "").trim().slice(0, 200);
  const timeline = (body.timeline ?? "").trim().slice(0, 100);
  const message  = (body.message  ?? "").trim().slice(0, 2000);

  if (!name || !email || !current || !timeline) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }

  // ── 管理者通知 ────────────────────────────────────────────────────────────
  const adminHtml = wrapHtml(`
    <h2 style="color:#002366;margin-top:0">新規キャリア相談申し込み</h2>
    <table style="border-collapse:collapse;width:100%;margin-top:16px">
      <tr><td style="${td}">お名前</td><td style="${td2}">${esc(name)}</td></tr>
      <tr><td style="${td}">メールアドレス</td><td style="${td2}"><a href="mailto:${esc(email)}" style="color:#3B5FD9">${esc(email)}</a></td></tr>
      <tr><td style="${td}">現職</td><td style="${td2}">${esc(current)}</td></tr>
      <tr><td style="${td}">転職希望時期</td><td style="${td2}">${esc(timeline)}</td></tr>
      <tr><td style="${td}">相談したいこと</td><td style="${td2}" style="white-space:pre-wrap">${esc(message) || "（未記入）"}</td></tr>
    </table>
    <p style="margin-top:24px;font-size:13px;color:#475569">
      上記のメールアドレスへ直接返信して日程調整を進めてください。
    </p>
  `);

  // ── 申込者への確認メール ──────────────────────────────────────────────────
  const userHtml = wrapHtml(`
    <h2 style="color:#002366;margin-top:0">${esc(name)} さん、ご相談ありがとうございます</h2>
    <p>OPINIO Career にキャリア相談のお申し込みをいただきました。<br>
    担当者より <strong>2営業日以内</strong> にオンライン面談の日程調整のご連絡をいたします。</p>

    <table style="border-collapse:collapse;width:100%;margin-top:20px;margin-bottom:24px">
      <tr><td style="${td}">お名前</td><td style="${td2}">${esc(name)}</td></tr>
      <tr><td style="${td}">現職</td><td style="${td2}">${esc(current)}</td></tr>
      <tr><td style="${td}">転職希望時期</td><td style="${td2}">${esc(timeline)}</td></tr>
      ${message ? `<tr><td style="${td}">相談内容</td><td style="${td2}" style="white-space:pre-wrap">${esc(message)}</td></tr>` : ""}
    </table>

    <p style="font-size:13px;color:#475569">
      ご不明な点は <a href="mailto:contact@opinio.co.jp" style="color:#3B5FD9">contact@opinio.co.jp</a> までお気軽にご連絡ください。
    </p>

    <p style="margin-top:28px">
      <a href="https://opinio.co.jp" style="${btn}">OPINIOのサービスを見る →</a>
    </p>
  `);

  // ── DB に保存（best-effort：失敗してもメール送信は続行）────────────────────
  try {
    const supabase = createAdminClient();
    await supabase.from("ow_career_agent_leads").insert({
      name,
      email,
      current_job: current,
      timeline,
      message: message || null,
      status: "new",
    });
  } catch (err) {
    console.error("[career-agent] db insert failed:", err);
  }

  try {
    await Promise.all([
      sendEmail({ to: ADMIN_EMAIL, subject: `【キャリア相談申込】${name} さんからの相談`, html: adminHtml }),
      sendEmail({ to: email, subject: "【OPINIO Career】キャリア相談のお申し込みを受け付けました", html: userHtml }),
    ]);
  } catch (err) {
    console.error("[career-agent] sendEmail failed:", err);
    return NextResponse.json({ error: "メール送信に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
