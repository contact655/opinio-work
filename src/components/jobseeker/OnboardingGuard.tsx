"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * ⚠️ キーにユーザーIDを含めること。同じタブで別アカウントに入り直したときに
 *    前の人の判定を引き継がないため。
 */
function completedKey(userId: string): string {
  return `opinio.onboarded.v2.${userId}`;
}

/**
 * ★登録経路（`?ref=`）を1回だけ記録するための、タブ内の目印。
 * ⚠️ `completedKey` と**別のキーにする**。あちらは「オンボーディングが済んだか」で、
 *    早期 return するので、済んだ人にはこの処理が回ってこない。
 */
function signupRefKey(userId: string): string {
  return `opinio.signupref.v1.${userId}`;
}

/**
 * ★登録経路を `ow_users.signup_ref` に記録させる（**タブにつき1回**）。
 *
 * ⚠️★**呼び出し元をここ以外に増やさないこと。** 認証後に必ず1回通る
 *    クライアント側の共通処理はここしかない。サーバー側（`postAuth`）は
 *    `/auth/confirm` と `/auth/callback` しか通らず、**パスワード登録を取りこぼす。**
 *
 * ⚠️★**応答を見ない。失敗しても何もしない。** これは計測であって機能ではない。
 *    ここで待ったり画面を止めたりすると、計測のために体験を損なう。
 * ⚠️ ref の cookie は HttpOnly なのでクライアントからは見えない。
 *    **だから毎回1回は投げる。** cookie が無ければサーバー側が即座に返し、
 *    DB にも認証にも触らない。
 * ⚠️ 目印は**投げる前**に立てる（同じタブで二重に投げないため）。
 *    失敗したぶんは cookie（30日）が残っているので、次のタブで拾える。
 */
function recordSignupRefOnce(userId: string): void {
  try {
    if (sessionStorage.getItem(signupRefKey(userId)) === "1") return;
    sessionStorage.setItem(signupRefKey(userId), "1");
  } catch {
    // sessionStorage が使えない環境。毎回投げる（サーバー側が冪等なので害は無い）
  }
  void fetch("/api/jobseeker/signup-ref", { method: "POST" }).catch(() => {
    // 計測なので握りつぶす。サーバー側が console.error を出す
  });
}

/**
 * ★戻り先の URL。**クエリ文字列まで含める。**
 *
 * ⚠️ `usePathname()` は**クエリ文字列を含まない**。それを `next=` に入れていたため、
 *    `/companies?q=営業` でゲートに捕まると `next=%2Fcompanies` になり、
 *    **答えたあと検索語が消えた状態で戻っていた**（2026-08-27 修正）。
 *    ヘッダーの検索が `/search?q=` を指すようになると、ここが検索の主動線になる。
 *
 * ⚠️ **`useSearchParams()` を使わないこと。** `OnboardingGuard` は
 *    `(jobseeker)/layout.tsx` 直下で **Suspense に包まれていない**ので、
 *    あのフックを足すと `(jobseeker)` 配下の静的レンダリングが落ちる
 *    （LP `/` は現に prerender されている。CLAUDE.md「/jobs の ISR 失敗」と同じ形）。
 *    ここは `useEffect` の中＝クライアント専用なので `window` を直接読めば足りる。
 *
 * ⚠️ 受け側の `safeNext()` は `/` 始まりならクエリ付きでもそのまま通す。変更不要。
 */
function currentHref(fallbackPathname: string): string {
  if (typeof window === "undefined") return fallbackPathname;
  return window.location.pathname + window.location.search;
}

/**
 * ログイン済みの誘導。**2つ見る。**
 *   ① `onboarding_completed = false`            → `/onboarding`
 *   ② `career_stance` が未設定（2026-08-27 追加） → `/onboarding/stance`
 *
 * ⚠️★②を足した理由: スカウトの送信可否を `career_stance` に付け替えたので、
 *    **未設定のままだと誰からも声がかからない**（未設定を「送れる」に読み替えない
 *    と決めたため）。既定値で埋めずに、本人に1問だけ答えてもらう。
 *
 * ⚠️ **同じ判定が `lib/auth/postAuth.ts` にもある**（ログイン直後の着地先）。
 *    あちらはログイン時、こちらは遷移のたび。片方だけ条件を変えないこと。
 *
 * ⚠️ **`career_stance` を追加のクエリで取らない。** 下の SELECT に列を足すだけ。
 *    ここは遷移1回ごとに走るので、往復を増やすと体感に直接出る。
 *
 * ── ここは「ページ遷移のたびに走る」場所であることに注意（2026-08-13）────────
 * useEffect の依存に pathname が入っているので、**遷移1回ごとに実行される**。
 * 以前はここで毎回
 *   ① `auth.getUser()`（Supabase Auth へネットワーク往復）
 *   ② `ow_profiles` の SELECT（もう1往復）
 * の2往復を出していた。描画が終わった後に走るので「表示はされたのに、まだ重い」
 * という体感の主因になっていた。
 *
 * 2点変えて、定常状態では**往復0回**にした（実測: 遷移で Supabase 往復が 2 → 0）。
 *   ① `getUser()` → `getSession()`。クッキーのトークンが期限内ならネットワークに出ない。
 *      ⚠️ ここは**認可ではなく誘導**なので署名検証は要らない。
 *         偽造クッキーで得をするのは「オンボーディングに飛ばされない」ことだけで、
 *         保護対象のデータには一切触れない。認可は各ページ／RLS 側にある。
 *   ② onboarding_completed = true をタブ内（sessionStorage）に覚える。
 *      ⚠️ **true だけ覚える。** false を覚えると、オンボーディングを完了した直後に
 *         古い false を読んで /onboarding に送り返す無限ループになる。
 */
export function OnboardingGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // onboarding ページ自体・auth系ページでは動かさない
    // ⚠️ `/onboarding/stance` もここに含まれる（前方一致）。含めないと、
    //    その画面自身が自分へリダイレクトし続ける。
    if (pathname.startsWith("/onboarding") || pathname.startsWith("/auth")) return;

    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user;
      if (!user) return;

      /* ★登録経路の記録。**下のキャッシュ判定より前に置くこと。**
            あとに置くと、オンボーディング済みの人（＝ `sessionStorage` が "1"）には
            一度も回ってこない。 */
      recordSignupRefOnce(user.id);

      /* ⚠️ キャッシュのキーは「2つとも済んでいる」を意味する。
            条件を足したので、**古いキーを使い回さない**（`.v2` を付けた）。
            付けないと、フェーズ3の前に "1" を書き込んだタブでは
            `career_stance` の判定に一度も入らない。 */
      const key = completedKey(user.id);
      try {
        if (sessionStorage.getItem(key) === "1") return;
      } catch {
        // sessionStorage が使えない環境（プライベートブラウズ等）。毎回引きに行く
      }

      const { data: profile } = await supabase
        .from("ow_profiles")
        .select("onboarding_completed, career_stance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.onboarding_completed) {
        router.replace(`/onboarding?next=${encodeURIComponent(currentHref(pathname))}`);
        return;
      }

      /* ★「転職について」が未設定なら1問だけ聞く（2026-08-27 / フェーズ3）。
         ⚠️ **キャッシュ（sessionStorage）に入れるのはこの後**。ここで返すと
            「答えていない」を覚えてしまい、答えた直後も送り返し続ける。 */
      if (!profile.career_stance) {
        router.replace(`/onboarding/stance?next=${encodeURIComponent(currentHref(pathname))}`);
        return;
      }

      try {
        sessionStorage.setItem(key, "1");
      } catch {
        // 保存できなくても動作は変わらない（毎回引くだけ）
      }
    }).catch(() => {
      // Supabase auth lock race condition — non-fatal, ignore silently
    });
  }, [pathname, router]);

  return null;
}
