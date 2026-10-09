import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SIGNUP_REF_COOKIE,
  SIGNUP_REF_COOKIE_MAX_AGE,
  SIGNUP_REF_QUERY_KEY,
  parseSignupRef,
} from "@/lib/constants/signupRef";

/**
 * /biz/ 配下のアクセス制御
 *   - 未ログイン: /biz/auth にリダイレクト
 *   - /biz/auth と /biz/auth/signup は素通り
 *
 * 企業ロール (role='company') を持つかは middleware では判定せず、
 * 各ページで getTenantContext() === null のときに「企業アカウント追加導線」を表示する。
 *
 * /admin/ 配下のアクセス制御（二重防御 — layout.tsx の auth_is_admin() と重複）
 *   - 未ログイン: /auth にリダイレクト
 *   - ★ログイン済みで運営でない: **ここで 403 を返す**（2026-10-10）
 *     ⚠️★layout.tsx の判定だけでは守れていなかった。layout が children を描かなくても、
 *        **ページ側のサーバーコンポーネントは並行して実行され、その結果が RSC ペイロードに載る。**
 *        実測（2026-10-10 / 本番）: 運営でない検証用アカウントで /admin/plans を開くと、
 *        画面は「権限がありません」なのに HTML に企業名とプランの一覧が入っていた。
 *     ⚠️ layout.tsx の判定は消さない（二重防御。middleware が落ちたときの最後の守り）。
 */
const BIZ_PUBLIC_PATHS = ["/biz", "/biz/auth", "/biz/auth/signup", "/biz/auth/accept-invite"];

// Agent portal: /agent/auth is public; other /agent/* pages handle auth themselves (redirect to /agent/auth)
const AGENT_PUBLIC_PATHS = ["/agent/auth"];

// 申し込み系。ログイン必須。リダイレクト先は他と同じ /auth?next=...
const CASUAL_MEETING_RE = /^\/companies\/[^/]+\/casual-meeting\/?$/;
const APPLY_RE = /^\/jobs\/[^/]+\/apply\/?$/;

/**
 * ★登録経路の計測（`?ref=`）。**cookie に控えるだけ。DB には触らない。**
 *
 * ⚠️★**ここで DB に書かないこと。** middleware はほぼ全ページに掛かるので、
 *    1リクエストごとに書き込みが増える。書くのは
 *    `POST /api/jobseeker/signup-ref` が**認証後に1回だけ**。
 *
 * ⚠️★**形式が通らない値は cookie を立てない**（黙って捨てる）。
 *    URL の値をそのまま持ち回らない。
 * ⚠️★**既にあれば上書きしない。** 最初の声かけを勝ちにする
 *    （列側の「1回だけ・以後は上書きしない」と向きを揃える）。
 * ⚠️ HttpOnly。JS から読む必要はなく、読めると別の用途に流用されうる。
 */
function attachSignupRef(request: NextRequest, response: NextResponse): NextResponse {
  const raw = request.nextUrl.searchParams.get(SIGNUP_REF_QUERY_KEY);
  if (!raw) return response;
  if (request.cookies.has(SIGNUP_REF_COOKIE)) return response;
  const ref = parseSignupRef(raw);
  if (!ref) return response;

  response.cookies.set(SIGNUP_REF_COOKIE, ref, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SIGNUP_REF_COOKIE_MAX_AGE,
  });
  return response;
}

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

  /* ★★職歴・学歴の一覧ページを `/mypage` へ転送する（2026-09-12 / 柴さんの指示）。
     行ごとの編集を `/mypage` 本体のモーダルに戻したので、このページに行き先が無くなった。
     ⚠️★**ページ側の `redirect()` では 307 にならない。** `/mypage/loading.tsx` が
        Suspense 境界を作っているので、**HTTP は 200 のまま**シェルが流れる（実測）。
        だから middleware で返す。
     ⚠️ 他の section（achievements / awards / certifications / languages / skills /
        media / content）の一覧ページは**そのまま**。あちらは本体から ✎ で送っている。
     ⚠️ 過去のブックマークやメールから踏まれるので 404 にしない。 */
  if (pathname === "/mypage/details/experience" || pathname === "/mypage/details/education") {
    const url = request.nextUrl.clone();
    url.pathname = "/mypage";
    url.search = "";
    return NextResponse.redirect(url);
  }

  /* ★旧 `/proposals` → `/mypage/proposals`（2026-09-21 に移した）。
     ⚠️ 移した理由は**サイドバーの中に入れるため**。`/mypage` 配下でないと
        `MypageLayout` が付かず、スカウト（`/mypage/scouts`）と置き場所が割れる。
     ⚠️ 移した時点で導線もリンクも0件だったので、踏む人は居ないはず。
        それでも 404 にしないのは、手元のブックマークを殺さないため。 */
  if (pathname === "/proposals" || pathname.startsWith("/proposals/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/mypage/proposals";
    return NextResponse.redirect(url);
  }

  /* ★★スカウトは廃止した（2026-10-08 / 柴さんの判断）。提案に一本化。**復活させないこと。**
        画面（`/biz/scouts` と `/mypage/scouts`）は削除したので、ブックマークと過去のメールを
        受けるためにここで転送する（404 にしない）。
     ⚠️ ページ側の `redirect()` にしない。`loading.tsx` の Suspense 境界の内側だと
        **HTTP は 200 のまま**になる（上の `/mypage/details/*` と同じ理由）。
     ⚠️ 受信実績は0件だった（`ow_scouts` 0行・`type='scout'` の通知0行。2026-10-08 実測）。 */
  if (pathname === "/biz/scouts" || pathname.startsWith("/biz/scouts/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/biz/proposals";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname === "/mypage/scouts" || pathname.startsWith("/mypage/scouts/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/mypage";
    url.search = "";
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
    /* ⚠️ **`/mypage` 配下もここで弾く**（2026-08-20）。
          ページ側の `redirect()` だけだと **HTTP は 200 のまま**になる
          （`/mypage/loading.tsx` の Suspense 境界の内側で起きるため、
          シェルが先に流れてクライアント側の遷移になる）。
          実測: 未ログインで `/mypage` `/mypage/settings` `/mypage/scouts`
          `/mypage/conversations` `/mypage/bookmarks` がすべて **200・66KB**を返し、
          **ヘッダーとフッターが一瞬見えてから**ログイン画面へ飛んでいた。
          個人情報は載っていないが、状態としては「入れたように見える」ので直す。
       ⚠️ casual-meeting / apply を 2026-08-05 にここへ移したのと同じ理由。
          **認証の判定は middleware に一元化する。** */
    pathname === "/mypage" || pathname.startsWith("/mypage/") ||
    /* ⚠️ オンボーディングも認証の内側（2026-08-27）。`/onboarding/stance` は
          `ow_profiles` を読んでから出し分けるので、未ログインで開かせない。 */
    pathname === "/onboarding" || pathname.startsWith("/onboarding/") ||
    /* ⚠️★根拠つき提案（②）も認証の内側（2026-09-18）。本人宛の提案しか出さない。
          ⚠️ 2026-09-21 に `/proposals` → **`/mypage/proposals`** へ移したので、
             すぐ上の `/mypage` の行がそのまま効く。**ここに行を足さない。**
             旧 URL は下の転送で受ける。 */
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
    /* ⚠️ `?ref=` は**未ログインの公開ページ**で踏まれるのが普通なので、
          この早期 return にも付ける。付け忘れると主経路で記録できない。 */
    return attachSignupRef(request, NextResponse.next({ request: { headers: h } }));
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
    return attachSignupRef(request, finalResponse);
  }

  if (needsAuth && !sessionUser) {
    const url = request.nextUrl.clone();
    const isBizPath = pathname.startsWith("/biz") && !pathname.startsWith("/biz/auth");
    url.pathname = isBizPath ? "/biz/auth" : "/auth";
    /* ★`next` には**クエリまで入れる**（2026-10-01）。
       ⚠️★それまで `pathname` だけで、**ログイン後にクエリが落ちていた。**
          `/people?q=営業` を未ログインで開くと `/auth?next=%2Fpeople` になり、
          ログインした先は `/people`（キーワード無し）に着地していた。
          `/people` に `?q=` を入れた日（2026-10-01）に表に出たが、
          **クエリを持つ認証必須ページすべてに効く**（`/u/[id]` など）。
       ⚠️ `safeNext`（lib/auth/redirects.ts）は先頭が `/` であることだけを見るので、
          クエリ付きでもそのまま通る。`//` と `/\` は従来どおり弾かれる。
       ⚠️ 元のクエリは `/auth` 側にも残したまま（`?ref=` の計測が
          `attachSignupRef` ではなくこの URL 経由で効いているため）。**消さないこと。** */
    url.searchParams.set("next", pathname + request.nextUrl.search);
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

  /* ★/admin は運営でなければここで止める（上の冒頭の注記）。⚠️ 判定できなかったときも止める（fail-closed）。
        運営の画面なので、判定の失敗で開けなくなるほうが、中身が漏れるより安全。 */
  if (pathname.startsWith("/admin") && sessionUser) {
    const admin = await isOpsAdmin(sessionUser.id);
    if (admin !== true) {
      const url = request.nextUrl.clone();
      url.pathname = "/no-admin-access";
      url.search = "";
      const res = NextResponse.rewrite(url, { status: admin === null ? 503 : 403 });
      response.cookies.getAll().forEach((c) => res.cookies.set(c));
      return res;
    }
  }

  /* ★会話の詳細は、参加者でなければ HTTP でも 404 を返す（2026-10-09）。
        ページ側の `notFound()` は `/mypage/loading.tsx` の Suspense 境界の内側で起きるので、
        **画面は 404 なのに HTTP は 200** になっていた（承認前のお願いの受け手・無関係の人）。
        `/mypage/details` を `dynamicParams = false` で直した前例と同じ問題だが、
        会話の id は事前に列挙できないのでここで判定する。
     ⚠️ 判定はページと同じ「参加者の行があるか」。承認前の受け手は参加者ではないので 404。
     ⚠️ 取得に失敗したら素通しする（ページ側の判定が最後に守る。ここで落とすと参加者まで開けなくなる）。
     ⚠️ 2本の問い合わせは並列（1往復）。参加者の表示にも1往復ぶん足される。 */
  const convMatch = pathname.match(CONVERSATION_DETAIL_RE);
  if (convMatch && sessionUser) {
    const allowed = await isConversationParticipant(convMatch[1], sessionUser.id);
    if (allowed === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/__conversation_not_found";
      url.search = "";
      const res = NextResponse.rewrite(url, { status: 404 });
      response.cookies.getAll().forEach((c) => res.cookies.set(c));
      return res;
    }
  }

  return attachSignupRef(request, finalResponse);
}

/** 運営か（`auth_is_admin()` と同じ表）。⚠️ 判定できなかったら null（呼び出し側は止める） */
async function isOpsAdmin(authUserId: string): Promise<boolean | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("ow_user_roles").select("user_id").eq("user_id", authUserId).eq("role", "admin").limit(1);
    if (error) {
      console.error("[middleware] 運営の判定:", error.message);
      return null;
    }
    return (data ?? []).length > 0;
  } catch (e) {
    console.error("[middleware] 運営の判定:", e);
    return null;
  }
}

const CONVERSATION_DETAIL_RE = /^\/mypage\/conversations\/([0-9a-f-]{36})\/?$/i;

/** 参加者か。⚠️ 判定できなかったら null（呼び出し側は素通しする） */
async function isConversationParticipant(conversationId: string, authUserId: string): Promise<boolean | null> {
  try {
    const db = createAdminClient();
    const [{ data: me, error: meErr }, { data: parts, error: pErr }] = await Promise.all([
      db.from("ow_users").select("id").eq("auth_id", authUserId).maybeSingle(),
      db.from("ow_conversation_participants").select("user_id").eq("conversation_id", conversationId),
    ]);
    if (meErr || pErr) {
      console.error("[middleware] 会話の参加者判定:", meErr?.message ?? pErr?.message);
      return null;
    }
    if (!me) return false;
    return (parts ?? []).some((p) => p.user_id === me.id);
  } catch (e) {
    console.error("[middleware] 会話の参加者判定:", e);
    return null;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
