import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * middleware から Supabase Auth を呼ぶときの上限（ミリ秒）。
 *
 * ⚠️ **上限を外さないこと。** これが無いと、Supabase Auth が詰まったときに
 *    middleware がそこで待ち続け、Vercel の実行時間上限に達して
 *    `MIDDLEWARE_INVOCATION_TIMEOUT`（504）になる。
 *    middleware は matcher でほぼ全ページに掛かっているため、
 *    **認証が要らない公開ページまで巻き込んでサイト全体が落ちる。**
 *    2026-08-11 09:07 JST に `/companies?page=2` で実際に発生した。
 *
 * 2500ms の根拠: 実測の getUser() は 0.1〜0.3秒。10倍近い余裕を見つつ、
 * 詰まったときの被害を数秒で打ち切る。
 */
const AUTH_TIMEOUT_MS = 2500;

export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
}> {
  let supabaseResponse = NextResponse.next({ request });

  /* ⚠️ タイムアウトは Promise.race ではなく **fetch を中断**して実現する。
        race だけだと middleware は返るが接続は生き続け、リクエストが積み上がる。 */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: controller.signal }),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() refreshes the session if the access token is expired.
  // We capture the user here so middleware.ts can use it directly
  // instead of creating a second client that reads stale request cookies.
  /* ⚠️ **ここで throw しない。** 認証を取れなかったことを user = null として返し、
        判断は呼び出し側（middleware）に委ねる。
        認証必須ページ（/biz /admin）はログイン画面へ落ちて安全側に倒れ、
        公開ページ（/companies /jobs）は未ログイン表示で出続ける。 */
  let user: User | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    /* ⚠️ 中断は supabase-js が **throw せず error として返す**（catch には来ない）。
          両方で拾うこと。 */
    if (error) logAuthFailure(error, request);
    user = data?.user ?? null;
  } catch (err) {
    logAuthFailure(err, request);
    user = null;
  } finally {
    clearTimeout(timer);
  }

  return { response: supabaseResponse, user };
}

/** 中断（＝上限超過）と、それ以外の失敗を分けて記録する。
 *
 * ⚠️ 未ログインや期限切れトークンも error になる。毎回出すと騒がしいので、
 *    セッションクッキーがあるのに取れなかったときだけ記録する。
 * ⚠️ 上限超過だけは**必ず出す**。これが増えているなら Supabase Auth が詰まっており、
 *    上限が無ければ 504 になっていた回数と等しい。
 */
function logAuthFailure(err: unknown, request: NextRequest): void {
  const message = err instanceof Error ? err.message : String(err);
  const aborted =
    (err instanceof Error && err.name === "AbortError") || /abort/i.test(message);

  if (aborted) {
    console.error(
      `[updateSession] Supabase Auth が ${AUTH_TIMEOUT_MS}ms を超えたため中断した` +
        `（未ログイン扱いで続行。上限が無ければ 504 になっていた）`
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
