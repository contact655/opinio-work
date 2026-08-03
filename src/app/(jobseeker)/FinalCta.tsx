"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * LP 最終CTA。ログイン状態で出し分ける。
 *
 * ── なぜクライアント判定か ──────────────────────────────────────────────────
 * LP は `export const revalidate = 300` の ISR ページ。
 * サーバー側で cookies() を読むと全リクエストが動的になり、
 * 最も流入の多いページのキャッシュを捨てることになる。
 * ヘッダー（JobseekerHeader）も同じ理由でクライアント側の
 * supabase.auth.getSession() で判定しているので、それに揃える。
 *
 * ── ちらつき対策 ────────────────────────────────────────────────────────────
 * 判定が付くまで未ログイン版を出すと、ログイン済みの人に一瞬でも
 * 「無料登録」を見せることになる（まさに直したかったバグ）。
 * 解決するまではボタン領域を同じ高さのプレースホルダーにして、
 * 確定してから中身を描く。高さを固定するのでレイアウトシフトも起きない。
 */
type State = "loading" | "guest" | "member";

const BTN_H = 52; // ボタンの高さ。プレースホルダーと揃える

export function FinalCta({ navy }: { navy: string }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (active) setState(session?.user ? "member" : "guest");
      })
      .catch(() => {
        // 判定できないときは未ログイン扱い。
        // 登録済みの人に登録を勧めるより、未登録の人に導線が出ないほうが損失が大きい。
        if (active) setState("guest");
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active) setState(session?.user ? "member" : "guest");
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const solid: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "#fff", color: navy, padding: "15px 28px", borderRadius: 8,
    fontWeight: 700, fontSize: 15, textDecoration: "none", minHeight: BTN_H,
  };
  const ghost: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "1px solid rgba(255,255,255,.35)", color: "#fff",
    padding: "15px 28px", borderRadius: 8,
    fontWeight: 700, fontSize: 15, textDecoration: "none", minHeight: BTN_H,
  };

  return (
    <>
      <p style={{ color: "#B9C6DE", fontSize: 15.5, lineHeight: 1.8, marginBottom: 26 }}>
        {state === "member" ? (
          <>保存した企業は、いつでも見返せます。<br />新しい求人が出たら、条件に合うものをお知らせします。</>
        ) : (
          <>登録すると、気になる企業を保存して比べられます。<br />新しい求人が出たときの通知も受け取れます。</>
        )}
      </p>

      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", minHeight: BTN_H }}>
        {state === "loading" ? (
          // 判定中。中身は出さないが高さは確保する。
          // このセクションはページ最下部にあり、スクロールして到達する頃には
          // 判定が終わっているため、実際にこの状態が見えることはほぼ無い。
          // JS 無効の環境だけは永久にここに留まるので noscript で導線を残す。
          <>
            <div aria-hidden style={{ minHeight: BTN_H }} />
            <noscript>
              <Link href="/companies" style={solid}>企業を探す</Link>
            </noscript>
          </>
        ) : state === "member" ? (
          <>
            <Link href="/mypage/bookmarks" style={solid}>保存した企業を見る</Link>
            <Link href="/jobs?sort=newest" style={ghost}>新着の募集を見る</Link>
          </>
        ) : (
          <>
            <Link href="/companies" style={solid}>企業を探す</Link>
            <Link href="/auth" style={ghost}>メールアドレスで無料登録</Link>
          </>
        )}
      </div>
    </>
  );
}
