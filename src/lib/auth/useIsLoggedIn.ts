"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * ログインしているか。**クライアント側の判定を1箇所にまとめる。**
 *
 * ── なぜサーバーで判定しないか ──────────────────────────────────────────────
 * LP（`/`）は `export const revalidate = 300` の ISR で、`(jobseeker)` 配下にも
 * prerender されるページがある。サーバーで `cookies()` を読むと**全リクエストが
 * 動的になり、最も流入の多いページのキャッシュを捨てる。**
 *
 * ⚠️ `getUser()` ではなく **`getSession()`**。あちらは毎回 Supabase へ往復する。
 *    ここは**認可ではなく表示の出し分け**なので署名検証は要らない
 *    （偽造クッキーで得をするのは「ナビにリンクが1本増える」ことだけで、
 *     そのリンク先は middleware と RLS が別に守っている）。
 *
 * ── ★既定は "loading"。未ログイン側に倒して描く ────────────────────────────
 * ⚠️★**判定が付くまで「ログイン中だけのもの」を出さないこと。**
 *    先に出して消すと**ちらつく**（出てから消える）。逆向き（出さない→出す）にする。
 *    `FinalCta` / `AuthAwareCta` が 2026-08〜09 から同じ倒し方。
 *
 * ── ⚠️★これを使ってナビを出し分けないこと（2026-09-17）──────────────────────
 * 一度ヘッダーと下部タブでこれを使い、未ログインから `/people` `/mypage` を隠したが、
 * **同日に戻した**（柴さんの判断）。同じ画面の中に同じ行き先のリンクが残っていて、
 * **外し方が中途半端**になったため。経緯は `JobseekerHeader` の `NAV_LINKS` の注記。
 * ⇒ いまの使い手は **`AuthAwareCta` だけ**。
 *    「押すと飛ばされるから隠す」ではなく「**行き先と文言を出し分ける**」用途で使う。
 *
 * ⚠️ 判定できないとき（`getSession` が失敗）は `"guest"` に倒す。
 *    ログイン中の人にリンクが1本出ないだけで、誰も締め出さない。
 */
export type LoginState = "loading" | "guest" | "member";

export function useIsLoggedIn(): LoginState {
  const [state, setState] = useState<LoginState>("loading");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (active) setState(session?.user ? "member" : "guest");
      })
      .catch(() => { if (active) setState("guest"); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active) setState(session?.user ? "member" : "guest");
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return state;
}
