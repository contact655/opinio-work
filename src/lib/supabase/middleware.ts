import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * middleware から Supabase Auth を呼ぶときの上限（ミリ秒）。
 *
 * ⚠️ **上限は「中断（abort）」だけでは掛からない。必ず期限（race）と併用する。**
 *    2026-08-20 に実測して分かったこと:
 *
 *      `@supabase/auth-js` は **fetch の失敗をすべて `AuthRetryableFetchError` に変換**する
 *      （`fetch.js` の catch: 「fetch failed, likely due to a network or CORS error」）。
 *      **AbortError もここに入る。** その結果 `_refreshAccessToken` の再試行ループが
 *      200 / 400 / 800 … と指数バックオフで **`AUTO_REFRESH_TICK_DURATION_MS = 30秒`** まで回る。
 *      中断した signal は使い回されるので、再試行のたびに即座に失敗して即座に次を積む。
 *
 *    **つまり中断すると 2.5秒で返るどころか 約28秒かかる。**（実測 27.9秒）
 *    Vercel の middleware 上限は 25秒なので、**確実に 504 になる。**
 *    2026-08-20 の実測: 期限切れトークンで公開ページに同時10本 → **6本が 504**。
 *
 *    → 中断は**ソケットを閉じるため**に残し、**返る時刻は `Promise.race` で決める**。
 *      実測: 現行 27.9秒 → 修正後 2.5秒。
 *
 * 2500ms の根拠: 実測の getUser() は 0.1〜0.3秒。10倍近い余裕を見つつ、
 * 詰まったときの被害を数秒で打ち切る。
 */
const AUTH_TIMEOUT_MS = 2500;

/**
 * 一時的な失敗のときだけ、1回だけ引き直すまでの待ち時間。
 *
 * ⚠️ **429 は `@supabase/auth-js` の再試行対象に入っていない。**
 *    `NETWORK_ERROR_CODES` は 500〜530 だけなので、**429 は即エラー**になり
 *    `user = null` として返る。middleware はそれを「未ログイン」と読んで
 *    `/auth` へ飛ばすため、**本人は突然ログアウトさせられる。**
 *
 *    2026-08-19 18:36:30〜34 の本番ログで実際に起きている。
 *    `POST /auth/v1/token?grant_type=refresh_token` が **5秒間に21本**（すべて
 *    Vercel Edge Functions＝middleware 由来）走り、**全部 429**。
 *    アクセストークンが切れた状態で同時に複数のページ／プリフェッチが飛ぶと起きる。
 *
 * ⚠️ **引き直すのは一時的な失敗のときだけ。** 「そもそもログインしていない」
 *    （セッション欠如・リフレッシュトークンが無効）で引き直すと、
 *    未ログインの人全員に無駄な待ち時間を作る。
 */
const AUTH_RETRY_DELAY_MS = 250;

/**
 * @param opts.verifyUser
 *   true  … `getUser()`。Supabase Auth へ往復してトークンを**サーバー検証**する。
 *           middleware が返り値の user でリダイレクトを判断するパス（認証必須パス）はこちら。
 *   false … `getSession()`。クッキーのトークンが**期限内なら往復しない**。
 *           期限切れのときだけリフレッシュのために往復する（＝更新の責務は変わらない）。
 *
 * ⚠️ **公開ページで false にしてよい理由は「返り値の user を誰も使わないから」。**
 *    middleware.ts の認可判定は `needsAuth && !sessionUser` の1箇所だけで、
 *    `needsAuth === false` のときは user を見ない。
 *    **認可判定に使うパスで false にしないこと。** getSession() は署名を検証しないため、
 *    偽造クッキーでも user が返る。ここが唯一の防御になっている経路では使えない。
 *
 * ── なぜ分けたか（2026-08-13 実測）─────────────────────────────────────────
 * middleware は matcher でほぼ全ページに掛かっており、`getUser()` は**毎リクエスト**
 * Supabase Auth へネットワーク往復していた。ログイン中は公開ページまで巻き込まれる。
 * 実測（本番 opinio.jp / LP は ISR キャッシュヒット）:
 *   未ログイン 0.10秒 → ログイン中 0.23〜0.27秒。**差の 130〜170ms がこの往復。**
 * 公開ページはトークンを検証する必要が無いので、期限内ならそのまま通す。
 */
export async function updateSession(
  request: NextRequest,
  opts?: { verifyUser?: boolean },
): Promise<{
  response: NextResponse;
  user: User | null;
}> {
  const verifyUser = opts?.verifyUser !== false;
  let supabaseResponse = NextResponse.next({ request });

  /* クッキーの読み書きは試行をまたいで同じものを使う。
     ⚠️ `setAll` で **request.cookies にも書く**こと。書かないと、この後の
        サーバーコンポーネントが**古い（期限切れの）トークン**を読む。 */
  const cookieHandlers = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      supabaseResponse = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabaseResponse.cookies.set(name, value, options as any)
      );
    },
  };

  type Attempt = { user: User | null; error: unknown; timedOut: boolean };
  const TIMED_OUT = Symbol("timed-out");

  const attempt = async (): Promise<Attempt> => {
    /* ⚠️ 試行ごとに**新しい** AbortController を作る。使い回すと、前回の中断で
          すでに aborted になっている signal を渡すことになり、即失敗する。 */
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: (input, init) => fetch(input, { ...init, signal: controller.signal }),
        },
        cookies: cookieHandlers,
      }
    );

    /* getUser() / getSession() はアクセストークンが切れていれば内部でリフレッシュする。
       ⚠️ **ここで throw しない。** 取れなかったことを user = null として返し、
          判断は呼び出し側（middleware）に委ねる。 */
    const call = (
      verifyUser
        ? supabase.auth.getUser()
        : supabase.auth.getSession().then(({ data, error }) => ({
            data: { user: data.session?.user ?? null },
            error,
          }))
    ).catch((err: unknown) => ({ data: { user: null }, error: err }));

    /* ★**返る時刻はここで決める。** 中断（abort）に任せない（上のコメント参照）。
          中断そのものは残す。ソケットを閉じないと接続が積み上がるため。 */
    const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(TIMED_OUT);
      }, AUTH_TIMEOUT_MS);
    });

    const result = await Promise.race([call, deadline]);
    if (timer) clearTimeout(timer);

    if (result === TIMED_OUT) return { user: null, error: null, timedOut: true };
    return { user: result.data?.user ?? null, error: result.error ?? null, timedOut: false };
  };

  let outcome = await attempt();

  /* ⚠️ **一時的な失敗を「未ログイン」と読まない。** 読むと突然ログアウトになる。
        引き直すのは 429 / 5xx / 上限超過 のときだけ。 */
  if (!outcome.user && isTransientAuthFailure(outcome)) {
    await new Promise((r) => setTimeout(r, AUTH_RETRY_DELAY_MS));
    const retried = await attempt();
    if (retried.user) {
      console.warn("[updateSession] 1回目は一時的な失敗。引き直して成功した");
    } else {
      logAuthFailure(retried.timedOut ? new Error("timeout") : retried.error, request, retried.timedOut);
    }
    outcome = retried;
  } else if (!outcome.user && (outcome.error || outcome.timedOut)) {
    logAuthFailure(outcome.timedOut ? new Error("timeout") : outcome.error, request, outcome.timedOut);
  }

  const user = outcome.user;

  return { response: supabaseResponse, user };
}

/** 上限超過と、それ以外の失敗を分けて記録する。
 *
 * ⚠️ 未ログインや期限切れトークンも error になる。毎回出すと騒がしいので、
 *    セッションクッキーがあるのに取れなかったときだけ記録する。
 * ⚠️ 上限超過だけは**必ず出す**。これが増えているなら Supabase Auth が詰まっており、
 *    2026-08-20 の修正が無ければ 504 になっていた回数と等しい。
 */
function logAuthFailure(err: unknown, request: NextRequest, timedOut: boolean): void {
  const message = err instanceof Error ? err.message : String(err);

  if (timedOut) {
    console.error(
      `[updateSession] Supabase Auth が ${AUTH_TIMEOUT_MS}ms を超えたため打ち切った` +
        `（未ログイン扱いで続行。期限を掛けていなければ約28秒かかり 504 になっていた）`
    );
    return;
  }
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));
  if (hasSessionCookie) {
    console.error("[updateSession] getUser 失敗", message);
  }
}

/** 引き直す価値のある失敗か。
 *
 * ⚠️ **「ログインしていない」を含めないこと。** 含めると未ログインの全員に
 *    無駄な 250ms を課す。含めるのは次の3つだけ:
 *      - 上限超過（timedOut）
 *      - 429（`@supabase/auth-js` は再試行しない。ここで拾わないと即ログアウト）
 *      - 5xx / ネットワーク（`AuthRetryableFetchError`）
 */
function isTransientAuthFailure(outcome: { error: unknown; timedOut: boolean }): boolean {
  if (outcome.timedOut) return true;
  const e = outcome.error as { status?: number; name?: string; message?: string } | null;
  if (!e) return false;
  if (e.status === 429 || (typeof e.status === "number" && e.status >= 500)) return true;
  if (e.name === "AuthRetryableFetchError") return true;
  return /rate limit|too many requests/i.test(e.message ?? "");
}
