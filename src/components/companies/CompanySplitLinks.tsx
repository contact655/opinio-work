"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SPLIT_MIN_WIDTH } from "@/lib/constants/splitView";

/**
 * 分割ビューのクリック横取り。**1280px 以上のときだけ**、一覧カードのクリックを
 * `/companies/<slug>`（全画面）から `/companies?selected=<slug>`（右ペイン）に振り替える。
 *
 * ── ⚠️★なぜカード側（`CompanyCardList`）を直さないのか ────────────────────────
 * あの部品は **4系統から使われている**（一覧グリッド / `?view=list` / 絞り込み結果 /
 * `dev/preview`）。「分割ビューかどうか」は**ビューポート幅で決まる**ので、
 * サーバーでは分からず、カードに props で渡すこともできない。
 * カード側に幅の判定を持たせると**4系統すべてに要らない挙動が入る**ので、
 * 一覧ページだけがこのラッパーを被せる形にした。
 *
 * ⚠️★**`<Link>` を壊さない。** カードは `/companies/<slug>` を指す素の `<a>` のままで、
 *    ここは**上から拾って `preventDefault` するだけ**。だから:
 *      ・1280px 未満では何もしない（通常の遷移）
 *      ・JS が落ちても遷移はできる
 *      ・⌘/Ctrl/Shift/Alt クリック・中クリックは**素通しする**（下記）
 *
 * ⚠️★**修飾キーと中クリックを必ず素通しすること。** Next の `Link` が
 *    `isModifiedEvent`（`next/dist/client/link.js:69-83`）で同じことをしている。
 *    ここで横取りすると「別タブで開く」が壊れる —— 2026-09-07 に
 *    `target="_blank"` を外したとき、**その逃げ道を残すことを理由に `<Link>` のままにした**。
 *    ここで潰したら意味が無い。
 *
 * ⚠️ ♡（保存）などカード内のボタンは、自前で `preventDefault` + `stopPropagation` する
 *    （`CompanyCardList` の `handleBookmark`）。**`defaultPrevented` を見て降りる**ので
 *    ここでは二重に拾わない。
 */
/** `/companies/<slug>` だけに一致させる。配下（`/casual-meeting` など）は横取りしない */
const COMPANY_DETAIL_HREF = /^\/companies\/([^/?#]+)$/;

export function CompanySplitLinks({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onClick(e: MouseEvent) {
      /* ⚠️ カード内のボタン（♡ など）が既に止めていたら何もしない */
      if (e.defaultPrevented) return;
      /* ⚠️ 修飾キー・中クリックは素通し。ブラウザの「別タブで開く」を残す */
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      /* ⚠️ 幅の判定は**クリックの瞬間**に見る。マウント時に控えると、
            ウィンドウを縮めた後も分割ビューのまま振る舞う。 */
      if (window.innerWidth < SPLIT_MIN_WIDTH) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      /* ⚠️ `target="_blank"` が付いた別のリンクを横取りしない */
      if (anchor.target && anchor.target !== "_self") return;

      const matched = (anchor.getAttribute("href") ?? "").match(COMPANY_DETAIL_HREF);
      if (!matched) return;

      e.preventDefault();
      /* ⚠️ `scroll: false` を外さないこと。外すと選ぶたびに一覧が先頭へ飛び、
            「見比べる」という分割ビューの目的が成立しない。 */
      const params = new URLSearchParams(window.location.search);
      params.set("selected", matched[1]);
      router.push(`/companies?${params.toString()}`, { scroll: false });
    }

    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [router]);

  return <div ref={ref}>{children}</div>;
}
