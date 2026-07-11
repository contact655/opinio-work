import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "contact@opinio.co.jp";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const td  = "padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;width:140px;vertical-align:top;font-size:13px";
const td2 = "padding:8px 12px;border:1px solid #e2e8f0;font-size:13px";
const btn = "display:inline-block;background:#002366;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px";

function wrapHtml(content: string) {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#002366,#3B5FD9);padding:28px 40px">
          <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em">OPINIO</span>
          <span style="font-size:11px;color:rgba(255,255,255,0.7);margin-left:12px">先輩に話を聞く</span>
        </td></tr>
        <tr><td style="padding:32px 40px;color:#0f172a;line-height:1.7;font-size:14px">${content}</td></tr>
        <tr><td style="padding:20px 40px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7">
            このメールは <a href="https://opinio.co.jp" style="color:#3B5FD9">opinio.co.jp</a> から自動送信されています。
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const adminId      = String(body.adminId      ?? "").trim();
  const themes       = Array.isArray(body.themes) ? body.themes.map(String) : [];
  const situation    = String(body.situation    ?? "").trim().slice(0, 1000);
  const questions    = String(body.questions    ?? "").trim().slice(0, 1000);
  const contactEmail = String(body.contactEmail ?? "").trim().slice(0, 254);
  const preferredDays  = Array.isArray(body.preferredDays)  ? body.preferredDays.map(String)  : [];
  const preferredTimes = Array.isArray(body.preferredTimes) ? body.preferredTimes.map(String) : [];

  if (!adminId || !contactEmail || themes.length === 0) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // ow_users の id を取得
  const { data: owUser } = await adminSupabase
    .from("ow_users")
    .select("id, name")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return NextResponse.json({ error: "ユーザー情報が見つかりません" }, { status: 400 });

  // ambassador 情報を取得
  const { data: ambassador } = await adminSupabase
    .from("ow_company_admins")
    .select("id, user_id, role_title, talk_themes, ow_users!user_id(name), ow_companies!company_id(name, brand_name)")
    .eq("id", adminId)
    .maybeSingle() as { data: {
      id: string; user_id: string | null; role_title: string | null; talk_themes: string[] | null;
      ow_users: { name: string | null } | null;
      ow_companies: { name: string | null; brand_name: string | null } | null;
    } | null };

  if (!ambassador) return NextResponse.json({ error: "話せる人が見つかりません" }, { status: 404 });

  const ambassadorName = (ambassador.ow_users as { name: string | null } | null)?.name ?? "担当者";
  const companyName = (ambassador.ow_companies as { brand_name: string | null; name: string | null } | null)?.brand_name
    ?? (ambassador.ow_companies as { name: string | null } | null)?.name ?? "企業";

  // DB に保存
  const { error: insertErr } = await adminSupabase.from("ow_mentor_reservations").insert({
    user_id: owUser.id,
    ambassador_id: adminId,
    ambassador_user_id: ambassador.user_id,
    themes,
    current_situation: situation || null,
    questions: questions || null,
    contact_email: contactEmail,
    preferred_days: preferredDays,
    preferred_times: preferredTimes,
    status: "pending_review",
  });
  if (insertErr) {
    console.error("[ambassador-reservations] insert error:", insertErr);
    return NextResponse.json({ error: "申込の保存に失敗しました" }, { status: 500 });
  }

  const applicantName = owUser.name ?? user.email ?? "申込者";

  // 管理者通知メール
  const adminHtml = wrapHtml(`
    <h2 style="color:#002366;margin-top:0">「話せる人」相談リクエスト</h2>
    <table style="border-collapse:collapse;width:100%;margin-top:16px">
      <tr><td style="${td}">申込者</td><td style="${td2}">${esc(applicantName)}</td></tr>
      <tr><td style="${td}">メール</td><td style="${td2}"><a href="mailto:${esc(contactEmail)}" style="color:#3B5FD9">${esc(contactEmail)}</a></td></tr>
      <tr><td style="${td}">話せる人</td><td style="${td2}">${esc(ambassadorName)}（${esc(companyName)}）</td></tr>
      <tr><td style="${td}">相談テーマ</td><td style="${td2}">${themes.map(esc).join("、")}</td></tr>
      <tr><td style="${td}">現在の状況</td><td style="${td2}" style="white-space:pre-wrap">${esc(situation) || "（未記入）"}</td></tr>
      <tr><td style="${td}">聞きたいこと</td><td style="${td2}" style="white-space:pre-wrap">${esc(questions) || "（未記入）"}</td></tr>
      <tr><td style="${td}">希望曜日</td><td style="${td2}">${preferredDays.join("、") || "未設定"}</td></tr>
      <tr><td style="${td}">希望時間帯</td><td style="${td2}">${preferredTimes.join("、") || "未設定"}</td></tr>
    </table>
    <p style="margin-top:24px;font-size:13px;color:#475569">
      上記のメールアドレスへ直接連絡して日程調整を進めてください。
    </p>
    <p style="margin-top:16px">
      <a href="https://opinio.co.jp/admin" style="${btn}">管理画面を開く →</a>
    </p>
  `);

  // 申込者への確認メール
  const userHtml = wrapHtml(`
    <h2 style="color:#002366;margin-top:0">${esc(applicantName)} さん、リクエストありがとうございます</h2>
    <p><strong>${esc(ambassadorName)}</strong>（${esc(companyName)}）への相談リクエストを受け付けました。<br>
    編集部で確認後、<strong>2〜3営業日以内</strong>に日程調整のご連絡をいたします。</p>
    <table style="border-collapse:collapse;width:100%;margin-top:20px;margin-bottom:24px">
      <tr><td style="${td}">相談テーマ</td><td style="${td2}">${themes.map(esc).join("、")}</td></tr>
      <tr><td style="${td}">連絡先メール</td><td style="${td2}">${esc(contactEmail)}</td></tr>
    </table>
    <p style="font-size:13px;color:#475569">
      ご不明な点は <a href="mailto:contact@opinio.co.jp" style="color:#3B5FD9">contact@opinio.co.jp</a> までお気軽にご連絡ください。
    </p>
    <p style="margin-top:28px">
      <a href="https://opinio.co.jp/people" style="${btn}">先輩一覧に戻る →</a>
    </p>
  `);

  try {
    await Promise.all([
      sendEmail({ to: ADMIN_EMAIL, subject: `【話せる人リクエスト】${applicantName} さん → ${ambassadorName}（${companyName}）`, html: adminHtml }),
      sendEmail({ to: contactEmail, subject: "【OPINIO】「話せる人」への相談リクエストを受け付けました", html: userHtml }),
    ]);
  } catch (err) {
    console.error("[ambassador-reservations] email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
