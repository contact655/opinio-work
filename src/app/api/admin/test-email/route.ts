import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/test-email?to=xxx@example.com&type=casual_meeting|mentor|application
 *
 * 管理者のみ呼び出し可能。Resend の疎通確認・テンプレート確認用。
 */
export async function GET(req: Request) {
  // ── 認証チェック ────────────────────────────────────────────────────────────
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const to   = searchParams.get("to")   ?? user.email ?? "";
  const type = searchParams.get("type") ?? "casual_meeting";

  if (!to.includes("@")) {
    return NextResponse.json({ error: "?to= must be a valid email" }, { status: 400 });
  }

  // ── テンプレート別送信 ─────────────────────────────────────────────────────
  let subject = "";
  let html    = "";

  if (type === "casual_meeting") {
    subject = "【テスト】カジュアル面談申し込み通知";
    html = wrapHtml(`
      <h2 style="color:#002366">テスト: カジュアル面談申し込み</h2>
      <p>これは <strong>Resend の疎通確認テストメール</strong>です。</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:16px">
        <tr><td style="${td}">宛先企業</td><td style="${td2}">株式会社テスト</td></tr>
        <tr><td style="${td}">申込者</td><td style="${td2}">${to}</td></tr>
        <tr><td style="${td}">転職意向</td><td style="${td2}">6ヶ月以内に転職検討</td></tr>
        <tr><td style="${td}">志望理由</td><td style="${td2}">プロダクト開発の環境に興味があります。</td></tr>
        <tr><td style="${td}">質問</td><td style="${td2}">チームの働き方について聞かせてください。</td></tr>
      </table>
      <p style="margin-top:20px">
        <a href="https://opinio.jp/biz/meetings" style="${btn}">管理画面で確認する →</a>
      </p>
    `);
  } else if (type === "mentor") {
    subject = "【テスト】メンター相談申し込み通知";
    html = wrapHtml(`
      <h2 style="color:#002366">テスト: メンター相談申し込み</h2>
      <p>これは <strong>Resend の疎通確認テストメール</strong>です。</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:16px">
        <tr><td style="${td}">メンター</td><td style="${td2}">テスト 太郎 さん</td></tr>
        <tr><td style="${td}">申込者</td><td style="${td2}">${to}</td></tr>
        <tr><td style="${td}">相談テーマ</td><td style="${td2}">転職タイミング、キャリアパス</td></tr>
        <tr><td style="${td}">現在の状況</td><td style="${td2}">現在は大手SIerでエンジニアとして勤務。SaaS企業への転職を検討中。</td></tr>
        <tr><td style="${td}">聞きたいこと</td><td style="${td2}">転職後のギャップや文化の違いについて教えてください。</td></tr>
      </table>
    `);
  } else if (type === "application") {
    subject = "【テスト】求人応募通知";
    html = wrapHtml(`
      <h2 style="color:#002366">テスト: 求人応募</h2>
      <p>これは <strong>Resend の疎通確認テストメール</strong>です。</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:16px">
        <tr><td style="${td}">企業・求人</td><td style="${td2}">株式会社テスト / プロダクトマネージャー</td></tr>
        <tr><td style="${td}">応募者</td><td style="${td2}">テスト ユーザー（${to}）</td></tr>
        <tr><td style="${td}">志望動機</td><td style="${td2}">御社のプロダクトに共感し、ぜひ一緒に開発に携わりたいと思い応募しました。</td></tr>
      </table>
      <p style="margin-top:20px">
        <a href="https://opinio.jp/biz/applications" style="${btn}">応募管理で確認する →</a>
      </p>
    `);
  } else if (type === "welcome") {
    subject = "【OPINIO】ようこそ！アカウント登録が完了しました";
    html = wrapHtml(`
      <h2 style="color:#002366">OPINIO へようこそ！</h2>
      <p>これは <strong>ウェルカムメールのテスト</strong>です。</p>
      <p>IT/SaaS 業界のキャリアプラットフォーム <strong>OPINIO</strong> へのご登録ありがとうございます。</p>
      <p>まずはプロフィールを設定して、気になる企業にカジュアル面談を申し込んでみましょう。</p>
      <p style="margin-top:20px">
        <a href="https://opinio.jp/profile/edit?welcome=1" style="${btn}">プロフィールを設定する →</a>
      </p>
    `);
  } else {
    return NextResponse.json({ error: "type must be: casual_meeting | mentor | application | welcome" }, { status: 400 });
  }

  try {
    await sendEmail({ to, subject, html });
    return NextResponse.json({
      ok: true,
      sent_to: to,
      type,
      subject,
      note: "Check your inbox (and spam folder).",
    });
  } catch (err) {
    console.error("[test-email] send failed:", err);
    return NextResponse.json({ error: "メール送信に失敗しました" }, { status: 500 });
  }
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const td  = "padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;width:120px;vertical-align:top";
const td2 = "padding:8px 12px;border:1px solid #e2e8f0;";
const btn = "display:inline-block;background:#002366;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px";

function wrapHtml(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#002366,#3B5FD9);padding:28px 40px">
                <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em">OPINIO</span>
                <span style="font-size:11px;color:rgba(255,255,255,0.7);margin-left:12px">IT/SaaS業界のキャリアインフラ</span>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px 40px;color:#0f172a;line-height:1.7;font-size:14px">
                ${content}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 40px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7">
                  このメールは <a href="https://opinio.jp" style="color:#3B5FD9">opinio.jp</a> から自動送信されています。<br>
                  心当たりのない場合は、このメールを無視してください。
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}
