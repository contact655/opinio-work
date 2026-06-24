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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /biz/ または /admin/ 配下かつ public ページでない場合に認証チェックが必要
  const needsAuth =
    (pathname.startsWith("/biz") && !BIZ_PUBLIC_PATHS.includes(pathname)) ||
    pathname.startsWith("/admin");

  // Supabase セッションクッキーの有無を確認（sb-<ref>-auth-token）
  const hasSessionCookie = request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  // 認証不要 かつ セッションクッキーなし → updateSession（Supabase外部呼び出し）をスキップ
  // これにより未ログインユーザーのパブリックページ閲覧時のタイムアウトを防ぐ
  if (!needsAuth && !hasSessionCookie) {
    return NextResponse.next();
  }

  // セッション同期（ログイン中ユーザー or 認証が必要なパスのみ）
  // updateSession() が getUser() を内部で呼ぶため、返ってきた user を再利用する。
  // 別 client を作ると古い request cookies を読み、トークン更新直後に user = null になるバグがあった。
  const { response, user: sessionUser } = await updateSession(request);

  // BIZ_MOCK_MODE=true の場合は /biz/ 認証チェックをスキップ（dev 専用）
  if (process.env.BIZ_MOCK_MODE === "true") {
    return response;
  }

  // Agent portal: /agent/auth is public; other /agent/* pages handle auth themselves
  if (pathname.startsWith("/agent") && !AGENT_PUBLIC_PATHS.includes(pathname)) {
    return response;
  }

  if (needsAuth && !sessionUser) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/admin") ? "/auth" : "/biz/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
