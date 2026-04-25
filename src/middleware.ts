import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * /biz/ 配下のアクセス制御
 *   - 未ログイン: /biz/auth にリダイレクト
 *   - /biz/auth と /biz/auth/signup は素通り
 *
 * 企業ロール (role='company') を持つかは middleware では判定せず、
 * 各ページで getTenantContext() === null のときに「企業アカウント追加導線」を表示する。
 */
const BIZ_PUBLIC_PATHS = ["/biz/auth", "/biz/auth/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 既存のセッション同期
  const response = await updateSession(request);

  // /biz/ 配下かつ public ページでない場合に認証チェック
  if (pathname.startsWith("/biz") && !BIZ_PUBLIC_PATHS.includes(pathname)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() { /* read-only here */ },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/biz/auth";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
