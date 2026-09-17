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
      {/*
        ⚠️★2026-09-16 に書き直した。**登録して実際に使えるものだけを書く。**

        削除したもの（どちらも実測で事実でなかった）:
          ・「**新しい求人が出たときの通知も受け取れます**」
            週次メールは二重に停止中（`vercel.json` の crons が空 ＋
            `WEEKLY_EMAIL_ENABLED` 未設定）。`ow_notifications_type_check` も
            like / comment / scout / message の4値で**求人の種別が無い**。
            ⚠️ **再開しても勝手に書き戻さないこと**（再開は env と crons の両方が要る）。
          ・「保存して**比べられます**」
            比較画面は存在しない。しかも `/companies` の分割ビューは
            **未ログインでも使える**ので、比べることは登録の理由になっていない。
            → 「保存できます」までにしてある。

        ⚠️ ログイン済み側の文も同じ基準で直した。**片方だけ直さないこと。**
        ⚠️ 文言は LP の FV のボタンと揃えてある（「無料登録して経歴も見る」）。
      */}
      <p style={{ color: "#B9C6DE", fontSize: 15.5, lineHeight: 1.8, marginBottom: 26 }}>
        {state === "member" ? (
          <>保存した企業と募集は、いつでも見返せます。<br />在籍している方の経歴も、そのまま読めます。</>
        ) : (
          <>登録すると、在籍している方・していた方の経歴を読めます。<br />気になる企業と募集は、保存しておけます。</>
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
            {/* ⚠️★「メールアドレスで」を外した（2026-09-17）。**Google でも登録できる。**
                   実測: `/auth` の登録は「Googleで続ける」（推奨バッジ付き・主）と
                   「メールアドレスで登録」の2つ。片方だけ書くと、もう片方が見えない。
                ⚠️ FV のボタン（`AuthAwareCta` の guest）と**同じ文言**。片方だけ変えないこと。 */}
            <Link href="/auth" style={ghost}>無料登録して経歴を見る</Link>
          </>
        )}
      </div>
    </>
  );
}
