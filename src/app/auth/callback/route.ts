import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addUserRole } from "@/lib/roles";
import { notify } from "@/lib/notify/email";
import { resolveOrLinkOwUser } from "@/lib/auth/linkOwUser";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" for password reset
  const isBiz = searchParams.get("biz") === "1"; // biz側からのOAuth
  const rawNext = searchParams.get("next") ?? "";
  // Prevent open redirect: only allow same-origin relative paths
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : (isBiz ? "/biz/dashboard" : "/companies");

  if (code) {
    const supabase = createClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session) {
      // ow_users レコードを解決する。
      // このルートに有効な code を持って到達できるのは、そのアドレス宛に送られたリンクを
      // クリックした人（マジックリンク / 確認メール / パスワード再設定）か、
      // OAuth プロバイダで検証を終えた人だけ。到達したこと自体がメールアドレスの
      // 所有証明になるので、ここでだけ emailVerified: true を渡してよい。
      // （パスワードログイン/登録はこのルートを通らない）
      const resolution = await resolveOrLinkOwUser({
        authId: session.user.id,
        email: session.user.email,
        name:
          session.user.user_metadata?.name ||
          session.user.user_metadata?.full_name ||
          null,
        emailVerified: true,
      });

      if (resolution.status === "error") {
        // 握り潰さない。ここで失敗すると「認証は通っているのに ow_users 行が無い」
        // ユーザーが生まれ、以降の画面が静かに壊れる。
        console.error("[auth/callback] resolveOrLinkOwUser failed:", resolution.message);
      } else if (resolution.status === "needs_verification") {
        // ここは emailVerified: true で呼んでいるので、未紐付け行なら引き継げているはず。
        // それでも email 衝突するのは「その email の行が既に別の auth_id に紐付いている」場合。
        console.error(
          "[auth/callback] email already belongs to a different linked ow_users row:",
          session.user.email
        );
      } else if (resolution.status === "linked") {
        console.info(
          "[auth/callback] linked pre-created ow_users row:",
          resolution.owUser.id,
          session.user.email
        );
      }

      // 引き継ぎ（linked）は運営が用意した既存プロフィールなので「新規ユーザー」ではない。
      const isNewUser = resolution.status === "created";

      // パスワードリセットフローはそのまま update-password へ
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/update-password`);
      }

      // biz側からのOAuth: ダッシュボードへリダイレクト（role登録・onboarding不要）
      if (isBiz) {
        return NextResponse.redirect(`${origin}/biz/dashboard`);
      }

      // role='candidate' を best-effort で登録（重複は無視）。
      // 失敗しても認証は続行するが、無言では落とさずログに残す。
      await addUserRole(supabase, "candidate").catch((e: unknown) => {
        console.error("[auth/callback] addUserRole failed:", e);
      });

      // onboarding_completed チェック: 未完了のユーザーはオンボーディングへ
      const { data: profile, error: profileError } = await supabase
        .from("ow_profiles")
        .select("onboarding_completed")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("[auth/callback] ow_profiles lookup failed:", profileError.message);
      }

      const needsOnboarding = !profile?.onboarding_completed;

      // ── ウェルカムメール (新規ユーザーのみ、best-effort) ──────────────────
      if (isNewUser && session.user.email) {
        const userName: string =
          session.user.user_metadata?.name
          ?? session.user.user_metadata?.full_name
          ?? session.user.email!.split("@")[0]
          ?? "さん";
        notify({
          to: session.user.email,
          subject: "【OPINIO】ようこそ！OPINIO へ登録完了しました",
          html: buildWelcomeHtml(userName),
        }).catch(() => {/* best-effort */});
      }

      if (needsOnboarding) {
        const onboardingNext = next !== "/companies" ? next : "/companies";
        return NextResponse.redirect(
          `${origin}/onboarding?next=${encodeURIComponent(onboardingNext)}`
        );
      }

      // 新規ユーザーはウェルカムバナー付きでリダイレクト
      if (isNewUser && next === "/companies") {
        return NextResponse.redirect(`${origin}/mypage?welcome=1`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth`);
}

// ── Welcome email HTML ────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildWelcomeHtml(name: string): string {
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
            <h2 style="margin:0 0 8px;font-size:20px;color:#002366">ようこそ、OPINIO へ！</h2>
            <p style="margin:0 0 20px;color:#475569">${esc(name)} さん、登録ありがとうございます。</p>

            <p style="margin:0 0 16px;color:#0f172a;font-weight:600">OPINIO でできること：</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              ${[
                ["🏢", "IT/SaaS 企業の情報閲覧・カジュアル面談申込"],
                ["💼", "IT/SaaS 業界の求人に直接応募"],
                ["🌟", "先輩メンターに30分の無料キャリア相談"],
              ].map(([icon, text]) => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">
                  <span style="margin-right:10px">${icon}</span>${text}
                </td>
              </tr>`).join("")}
            </table>

            <p style="margin:0 0 24px">
              <a href="https://opinio.jp/profile/edit?welcome=1" style="${btn}">プロフィールを設定する →</a>
            </p>

            <div style="background:#eff3fc;border-radius:8px;padding:14px 18px;border-left:3px solid #002366">
              <p style="margin:0;font-size:12px;color:#334155;line-height:1.7">
                💡 プロフィールを充実させると、企業の採用担当者にあなたの経験が伝わりやすくなります。
              </p>
            </div>
          </td>
        </tr>
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
</html>`;
}
