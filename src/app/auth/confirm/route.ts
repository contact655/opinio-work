import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/redirects";
import { resolveOwUserForVerifiedEmail, jobseekerDestination } from "@/lib/auth/postAuth";
import type { AuthErrorCode } from "@/lib/constants/authErrors";

/**
 * メール内リンクの着地点。`token_hash` をサーバー側で verifyOtp して セッションを張る。
 *
 * ⚠️ なぜ `/auth/callback`（code 交換）と分けるのか
 *    @supabase/ssr は flowType: "pkce" をハードコードしている（options.auth の展開後に
 *    上書きしているので指定では変えられない）。PKCE の `code` は登録したブラウザに保存された
 *    code_verifier とペアでなければ交換できないため、スマホのGmailアプリ内ブラウザなど
 *    **別ブラウザでリンクを開くと必ず失敗する**。本番の大半がこれに該当していた。
 *
 *    token_hash は GoTrue の POST /verify で検証され、code_verifier を要求しない。
 *    このルートはサーバー内で完結するのでブラウザが違っても通る。
 *
 * ⚠️ OAuth（Google）は引き続き code の交換が必要なので `/auth/callback` を残している。
 *    メール確認・マジックリンク・パスワード再設定だけをこちらに寄せる。
 *
 * ⚠️ `{{ .TokenHash }}` は `pkce_` 接頭辞付きで届く（GoTrue の
 *    templatemailer.go が `user.ConfirmationToken` をそのまま埋めるため）。
 *    そのまま verifyOtp に渡してよい。verifyTokenHash は DB 列との完全一致で引くので
 *    接頭辞ごと一致し、POST /verify 側に PKCE 分岐は無くセッションが発行される。
 *    **接頭辞を剥がさないこと。** 剥がすと DB の値と一致しなくなる。
 */

/*
  supabase-js の EmailOtpType のうち、**このアプリが実際に送っているメール**だけを通す。

  ⚠️ `email_change` は意図的に除外している。「まだ使わないから」ではなく、
     **今の実装で受けると成功を失敗として報告するため**。

     GoTrue の EmailChangeMail は旧アドレスと新アドレスに
     **別々の TokenHash**（EmailChangeTokenCurrent / EmailChangeTokenNew）で
     2通送る。secure email change が有効なとき、1通目の verifyOtp は
     verifyPost の `isSingleConfirmationResponse` 分岐に入り
     **200 OK・セッションなし**（「もう一方のリンクも開いてください」）を返す。
     下の `!data.session` 判定はこれをエラーとみなすので、
     利用者は正常な途中経過で `?error=` に飛ばされる。

     ⚠️ メールアドレス変更機能を作るときは、ここに `email_change` を足すだけでは足りない。
        「1通目は成功だがセッションは無い」状態を独立に扱うこと
        （2通目を促す画面が要る）。あわせて Supabase の
        "Change Email Address" テンプレートも差し替える。

  ⚠️ `reauthentication` は元から対象外。GoTrue の ReauthenticateMail は
     `SiteURL` / `Email` / `Token` / `Data` しか渡さず、
     **ConfirmationURL も TokenHash も存在しない**（6桁コードを本人が入力する方式）。
*/
const ALLOWED_TYPES = [
  "email",        // Confirm signup（Supabase 公式テンプレートの既定）
  "signup",
  "magiclink",
  "recovery",
  "invite",
] as const satisfies readonly EmailOtpType[];

function toOtpType(raw: string | null): EmailOtpType | null {
  if (!raw) return null;
  return (ALLOWED_TYPES as readonly string[]).includes(raw) ? (raw as EmailOtpType) : null;
}

const LOG = "[auth/confirm]";

/**
 * プリフェッチかどうかを見分けるための手がかり。**観測専用。**
 *
 * ⚠️ **この値で分岐しないこと。** UA も Sec-Fetch-* も詐称できるうえ、
 *    誤判定すると本物の利用者の確認を拒むことになる。
 *    ここは「A案（ワンクッション挟む確認ページ）に切り替えるべきか」を
 *    後から数字で判断するための材料を残すだけの仕組み。
 *
 * ⚠️ **token_hash・Cookie の値・メールアドレスは出さない。**
 *    Cookie は「sb- で始まる名前が1つでもあるか」の真偽だけを見る。
 *
 * 読み方: メールセキュリティ製品のスキャナは
 *   - ブラウザと明確に異なる UA を名乗る
 *   - Cookie を持たない（hasSupabaseCookie が false 寄り）
 *   - Sec-Fetch-* を送ってこない（"(none)"）
 * ため、**非ブラウザ UA での "verifyOtp ok" がそのままプリフェッチ被害の実数**になる。
 */
function requestSignals(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  // 値は読まない。名前が sb- で始まるものの有無だけを見る。
  // （値の中に "sb-" を含む別 Cookie を誤検知しないよう、名前側だけで判定する）
  const hasSupabaseCookie = cookieHeader
    .split(";")
    .some((c) => c.trim().startsWith("sb-"));

  return {
    ua: request.headers.get("user-agent") ?? "(none)",
    hasSupabaseCookie,
    // ブラウザのアドレスバー遷移なら navigate / document になる。
    secFetchMode: request.headers.get("sec-fetch-mode") ?? "(none)",
    secFetchDest: request.headers.get("sec-fetch-dest") ?? "(none)",
  };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type = toOtpType(rawType);

  // パスワード再設定は着地先が決まっている。テンプレートの next 指定漏れに備えて既定を寄せる。
  const fallbackNext = rawType === "recovery" ? "/auth/update-password" : "/";
  const next = safeNext(searchParams.get("next"), fallbackNext);

  const fail = (code: AuthErrorCode) =>
    NextResponse.redirect(`${origin}/auth?error=${code}`);

  /*
    ⚠️ 旧テンプレート（`{{ .ConfirmationURL }}`）からの着地を受け止める保険。

    ConfirmationURL は GoTrue の /verify を経由し、`?code=` を付けてここへ戻してくる。
    token_hash 形式のテンプレートに差し替えるまでの移行期間、および
    差し替えを取り消した場合に、このルートが「token_hash が無い」と言って
    弾いてしまわないようにする。

    ⚠️ **この経路は PKCE なので別ブラウザでは通らない**（元々の問題そのもの）。
       あくまで「テンプレートが旧形式でも登録が完全に死なない」ための保険であって、
       token_hash 形式への差し替えを不要にするものではない。
  */
  const code = searchParams.get("code");
  if (!tokenHash && code) {
    console.info(`${LOG} falling back to code exchange (legacy template):`, requestSignals(request));
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      console.error(`${LOG} exchangeCodeForSession failed:`, {
        status: error?.status,
        code: error?.code,
        message: error?.message,
        ...requestSignals(request),
      });
      return fail("exchange_failed");
    }
    const { isNewUser } = await resolveOwUserForVerifiedEmail(data.session, LOG);
    if (next.startsWith("/biz") || next.startsWith("/auth/update-password")) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      await jobseekerDestination({
        supabase,
        session: data.session,
        origin,
        next: next === "/" ? "/companies" : next,
        isNewUser,
        logPrefix: LOG,
      })
    );
  }

  if (!tokenHash || !type) {
    // メールソフトがリンクを途中で切ると起きる。何が欠けたかを残す。
    console.error(
      `${LOG} missing params: token_hash=${tokenHash ? "present" : "missing"} type=${rawType ?? "missing"}`
    );
    return fail("missing_token");
  }

  const signals = requestSignals(request);

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error || !data.session) {
    // ⚠️ 握り潰さない。ここが見えないと本番で何が起きているか分からない
    //    （/auth/callback がまさにその状態だった）。
    console.error(`${LOG} verifyOtp failed:`, {
      type,
      status: error?.status,
      code: error?.code,
      message: error?.message,
      hasSession: Boolean(data?.session),
      ...signals,
    });
    // GoTrue は「期限切れ」「使用済み」「確認済み」をすべて 403 otp_expired で返すため
    // 区別できない。文言側で断定しない（constants/authErrors.ts のコメント参照）。
    return fail(error?.status === 403 || error?.code === "otp_expired" ? "otp_invalid" : "unknown");
  }

  // ⚠️ 成功も必ず出す。失敗だけ見ても分母が分からず、
  //    「プリフェッチで焼かれた割合」を出せない。
  console.info(`${LOG} verifyOtp ok:`, { type, ...signals });

  const session = data.session;
  const { isNewUser } = await resolveOwUserForVerifiedEmail(session, LOG);

  // パスワード再設定は role 登録・onboarding・ウェルカムメールのどれも要らない。
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // 企業側の導線。求職者用の後処理（candidate ロール付与・onboarding）を通さない。
  if (next.startsWith("/biz")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const destination = await jobseekerDestination({
    supabase,
    session,
    origin,
    next: next === "/" ? "/companies" : next,
    isNewUser,
    logPrefix: LOG,
  });

  return NextResponse.redirect(destination);
}
