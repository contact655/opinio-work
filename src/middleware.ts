import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * /biz/ 配下のアクセス制御
 *   - 未ログイン: /biz/auth にリダイレクト
 *   - /biz/auth と /biz/auth/signup は素通り
 *
 * 企業ロール (role='company') を持つかは middleware では判定せず、
 * 各ページで getTenantContext() === null のときに「企業アカウント追加導線」を表示する。
 *
 * /admin/ 配下のアクセス制御（二重防御 — layout.tsx の auth_is_admin() と重複）
 *   - 未ログイン: /biz/auth にリダイレクト
 *   - ロール確認は layout.tsx で行う（middleware は auth check のみ）
 */
const BIZ_PUBLIC_PATHS = ["/biz", "/biz/auth", "/biz/auth/signup", "/biz/auth/accept-invite"];

// Agent portal: /agent/auth is public; other /agent/* pages handle auth themselves (redirect to /agent/auth)
const AGENT_PUBLIC_PATHS = ["/agent/auth"];

// 申し込み系。ログイン必須。リダイレクト先は他と同じ /auth?next=...
const CASUAL_MEETING_RE = /^\/companies\/[^/]+\/casual-meeting\/?$/;
const APPLY_RE = /^\/jobs\/[^/]+\/apply\/?$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ★旧 `?tab=` の転送（2026-08-17 / フェーズ4-3）。**ここで返すこと。**
     ⚠️ ページ側の `redirect()` だと **HTTP は 200 のまま**になる
        （`/mypage/loading.tsx` の Suspense 境界の内側で起きるため、
        シェルが先に流れてクライアント側の遷移になる）。
        配信停止リンクはメールから踏まれるので、**サーバーが 307 を返す形にする。**
     ⚠️ 知らない値でも `/mypage` に落とす。404 にしない。
        過去のメールとブックマークが行き先を失うほうが害が大きい。 */
  if (pathname === "/mypage" && request.nextUrl.searchParams.has("tab")) {
    const tab = request.nextUrl.searchParams.get("tab");
    const url = request.nextUrl.clone();
    url.search = "";
    /* 設定タブの中身は `/mypage/settings` へ移した。旧7値の privacy / account も同じ。 */
    url.pathname = (tab === "settings" || tab === "privacy" || tab === "account")
      ? "/mypage/settings"
      : "/mypage";
    return NextResponse.redirect(url);
  }

  // /biz/ または /admin/ 配下かつ public ページでない場合に認証チェックが必要
  const needsAuth =
    (pathname.startsWith("/biz") && !BIZ_PUBLIC_PATHS.includes(pathname)) ||
    pathname.startsWith("/admin") ||
    (pathname.startsWith("/agent") && !AGENT_PUBLIC_PATHS.includes(pathname)) ||
    pathname.startsWith("/u/") ||
    // ⚠️ 完全一致にしないこと。/people/role/[slug] の7ページも同じ個人情報を出す。
    //    2026-07-13 の 7dd4eff4 では === "/people" だったため子が素通りしていた（2026-08-04 修正）。
    pathname === "/people" || pathname.startsWith("/people/") ||
    // ⚠️ 申し込み系はページ側でも redirect しているが、middleware でも弾く。
    //    ページ側の redirect() だけだと HTTP は 200 のまま（Suspense 境界の内側で
    //    起きるため）で、ステータスを見る側からは「誰でも開ける」ように見える。
    //    2026-08-05 に casual-meeting/apply の loading.tsx を消してソフト200を解消したが、
    //    認証の判定はここに置いて一元化する。
    CASUAL_MEETING_RE.test(pathname) || APPLY_RE.test(pathname);

  // Supabase セッションクッキーの有無を確認（sb-<ref>-auth-token）
  /*
    ⚠️ 分割されたクッキーも拾うこと。値が約3.2KBを超えると @supabase/ssr は
       sb-<ref>-auth-token.0 / .1 のように連番で分割する。
       2026-08-05 まで endsWith("-auth-token") だけを見ていたため、分割された
       セッションはここで「クッキー無し」と判定され、認証不要ページでは
       updateSession() がスキップされていた。結果、ログイン済みなのに
       /companies などの公開ページでは未ログイン扱いになっていた
       （/admin や /biz は needsAuth=true で必ず updateSession を通るので気づけない）。
  */
  const hasSessionCookie = request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && /-auth-token(\.\d+)?$/.test(c.name)
  );

  // 認証不要 かつ セッションクッキーなし → updateSession（Supabase外部呼び出し）をスキップ
  // これにより未ログインユーザーのパブリックページ閲覧時のタイムアウトを防ぐ
  if (!needsAuth && !hasSessionCookie) {
    const h = new Headers(request.headers);
    h.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: h } });
  }

  // セッション同期（ログイン中ユーザー or 認証が必要なパスのみ）
  // updateSession() が getUser() を内部で呼ぶため、返ってきた user を再利用する。
  // 別 client を作ると古い request cookies を読み、トークン更新直後に user = null になるバグがあった。
  /*
    ⚠️ **verifyUser は needsAuth と必ず同じ値にすること。**
       下の `needsAuth && !sessionUser` が middleware 側の唯一の認可判定で、
       そこに渡る user は検証済みでなければならない（getSession() は署名を見ない）。
       公開ページは user を一切見ないので、期限内トークンの往復を省く。

       実測（2026-08-13 / 本番）: ログイン中の公開ページで1リクエストあたり
       130〜170ms の削減。middleware はほぼ全ページに掛かるので全体に効く。
  */
  const { response, user: sessionUser } = await updateSession(request, {
    verifyUser: needsAuth,
  });
  // Supabase が設定したクッキーを保持しつつ、x-pathname をリクエストヘッダーに注入する。
  // Server Components は headers() 経由でリクエストヘッダーを読むため、
  // レスポンスヘッダーではなくリクエストヘッダーに設定する必要がある。
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set("x-pathname", pathname);
  const finalResponse = NextResponse.next({ request: { headers: reqHeaders } });
  // updateSession が設定した Set-Cookie をコピー
  response.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));

  // BIZ_MOCK_MODE=true の場合は /biz/ 認証チェックをスキップ（dev 専用）
  if (process.env.NODE_ENV === "development" && process.env.BIZ_MOCK_MODE === "true") {
    return finalResponse;
  }

  if (needsAuth && !sessionUser) {
    const url = request.nextUrl.clone();
    const isBizPath = pathname.startsWith("/biz") && !pathname.startsWith("/biz/auth");
    url.pathname = isBizPath ? "/biz/auth" : "/auth";
    url.searchParams.set("next", pathname);
    // ⚠️ 申し込み系だけログインタブで着地させる。
    //    2026-08-05 に認証チェックをここへ移すまでは、ページ側が /auth/login 経由で
    //    リダイレクトしておりログインタブが開いていた。ステータス是正が目的の変更で
    //    着地タブまで変わってしまったので戻している。
    //    /people や /u/[id] は従来どおり mode を付けない（初見の人が多い導線のため）。
    if (CASUAL_MEETING_RE.test(pathname) || APPLY_RE.test(pathname)) {
      url.searchParams.set("mode", "login");
    }
    return NextResponse.redirect(url);
  }

  return finalResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
