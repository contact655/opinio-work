"use client";

import Link from "next/link";
import { useIsLoggedIn } from "@/lib/auth/useIsLoggedIn";

/**
 * ログイン状態で行き先と文言が変わるボタン。**LP の FV と在籍者向けセクションが使う。**
 *
 * ── なぜ要るか（2026-09-16）──────────────────────────────────────────────────
 * 素の `<Link href="/auth">無料登録</Link>` を置くと、**登録済みの人にも「無料登録」が出る。**
 * `/auth` はログイン済みなら `/companies` へ `router.replace` するので行き止まりにはならないが、
 * 押すまで分からない。`FinalCta` が 2026-08 に同じ理由で出し分けている。
 *
 * ⚠️★**判定をここ以外に書かないこと。** LP には既に `FinalCta` があり、
 *    session を見る箇所が増えるほど「片方だけ直す」形になる。
 *
 * ── なぜクライアント判定か ──────────────────────────────────────────────────
 * LP は `export const revalidate = 300` の ISR。サーバーで `cookies()` を読むと
 * **全リクエストが動的になり、最も流入の多いページのキャッシュを捨てる。**
 * ヘッダー・`FinalCta` と同じく `getSession()` で判定する（`getUser()` にしない。
 * あちらは毎回 Supabase へ往復する）。
 *
 * ⚠️ ちらつき対策も `FinalCta` と同じ。**判定が付くまで未ログイン版を出さない。**
 *    出すと登録済みの人に一瞬「無料登録」が見える（まさに直したかったもの）。
 *    高さだけ確保したプレースホルダーを出し、確定してから中身を描く。
 *
 * ⚠️ JS 無効の環境は永久に `loading` に留まるので、`noscript` で未ログイン版を出す。
 */
export type CtaTarget = { href: string; label: string };

export function AuthAwareCta({
  guest,
  member,
  className,
  minHeight = 50,
}: {
  guest: CtaTarget;
  /** ログイン済みのときの行き先。**`null` ならボタンごと出さない** */
  member: CtaTarget | null;
  className: string;
  minHeight?: number;
}) {
  /* ⚠️ 判定は [useIsLoggedIn](@/lib/auth/useIsLoggedIn) の1箇所（2026-09-17 に切り出した）。
        ヘッダーのナビと下部タブも同じフックを使う。**ここに getSession を書き戻さないこと。** */
  const state = useIsLoggedIn();

  if (state === "loading") {
    return (
      <>
        <span aria-hidden style={{ display: "inline-block", minHeight }} />
        <noscript>
          <Link href={guest.href} className={className}>{guest.label}</Link>
        </noscript>
      </>
    );
  }

  const t = state === "member" ? member : guest;
  if (!t) return null;
  return <Link href={t.href} className={className}>{t.label}</Link>;
}
