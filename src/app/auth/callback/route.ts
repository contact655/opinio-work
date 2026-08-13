import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/redirects";
import { resolveOwUserForVerifiedEmail, jobseekerDestination } from "@/lib/auth/postAuth";

/**
 * OAuth（Google）の code 交換。
 *
 * ⚠️ **メール確認・マジックリンク・パスワード再設定はここを通さない。**
 *    それらは `/auth/confirm`（token_hash + verifyOtp）に寄せてある。
 *    PKCE の `code` は登録したブラウザの code_verifier とペアでないと交換できず、
 *    別ブラウザでメールを開くと必ず失敗するため。詳細は
 *    [src/app/auth/confirm/route.ts](../confirm/route.ts) の冒頭コメント。
 *
 *    このルートを残しているのは OAuth が引き続き code 交換を要するから。
 *    新しくメール系の導線を足すときは `confirmRedirectTo()` を使うこと。
 */

const LOG = "[auth/callback]";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" for password reset
  const isBiz = searchParams.get("biz") === "1"; // biz側からのOAuth
  const next = safeNext(searchParams.get("next"), isBiz ? "/biz/dashboard" : "/companies");

  if (!code) {
    // GoTrue 側が error / error_description を付けて戻すことがある。捨てずに残す。
    console.error(`${LOG} no code in callback:`, {
      error: searchParams.get("error"),
      errorCode: searchParams.get("error_code"),
      errorDescription: searchParams.get("error_description"),
    });
    return NextResponse.redirect(`${origin}/auth?error=no_code`);
  }

  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session) {
    // ⚠️ 2026-08-13 まで、ここは何もログを出さずに /auth?error=auth へ落としていた。
    //    そのため本番で「別ブラウザで開くと code_verifier が無くて交換できない」ことに
    //    気づけなかった。**握り潰さない。**
    console.error(`${LOG} exchangeCodeForSession failed:`, {
      status: error?.status,
      code: error?.code,
      message: error?.message,
      hasSession: Boolean(session),
    });
    return NextResponse.redirect(`${origin}/auth?error=exchange_failed`);
  }

  // ow_users レコードを解決する。
  // このルートに有効な code を持って到達できるのは OAuth プロバイダで検証を終えた人だけ。
  // 到達したこと自体がメールアドレスの所有証明になるので emailVerified: true を渡してよい。
  // （パスワードログイン/登録はこのルートを通らない）
  const { isNewUser } = await resolveOwUserForVerifiedEmail(session, LOG);

  // パスワードリセットフローはそのまま update-password へ
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/update-password`);
  }

  // biz側からのOAuth: ダッシュボードへリダイレクト（role登録・onboarding不要）
  if (isBiz) {
    return NextResponse.redirect(`${origin}/biz/dashboard`);
  }

  const destination = await jobseekerDestination({
    supabase,
    session,
    origin,
    next,
    isNewUser,
    logPrefix: LOG,
  });

  return NextResponse.redirect(destination);
}
