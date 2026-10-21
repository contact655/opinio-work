"use client";

import { useEffect, type RefObject } from "react";

/**
 * ★スマホ（767px 以下）で、一覧の上部（検索・条件・件数）を下へスクロールしたら隠し、上へ戻したら出す
 *   （2026-10-21 / 柴さんの指示。上部が3行で約190px あり、画面の4分の1を覆っていた。LinkedIn のアプリと同じ動き）。
 *
 * 使う場所: /people・/companies・/jobs の上部（position: sticky の入れ物）。見た目は globals.css の .lt-sticky。
 * ⚠️ クラスを付け外しするだけで、描き直さない（スクロールのたびに React を動かさない）
 * ⚠️ 隠さないとき: 768px 以上／ページの先頭付近（120px まで）／入れ物の中の入力欄を使っているとき／
 *    条件のメニュー（.fc-menu）や絞り込みのパネル（ドロワー）が開いているとき
 */
export function useHideOnScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let lastY = window.scrollY;
    /* ⚠️ requestAnimationFrame に載せない（描画されていないタブでは呼ばれず、静かに効かなくなる。ui-debugging ⑪）。
          クラスの付け外しだけなので、スクロールのたびに直接呼んで足りる */
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const y = window.scrollY;
      const narrow = window.innerWidth <= 767;
      const busy =
        (document.activeElement instanceof HTMLElement && el.contains(document.activeElement) && document.activeElement.tagName === "INPUT") ||
        !!el.querySelector(".fc-menu") ||
        !!document.querySelector("[data-detail-search-drawer]");
      if (!narrow || y < 120 || busy) {
        el.classList.remove("lt-sticky--hidden");
      } else if (y > lastY + 4) {
        el.classList.add("lt-sticky--hidden");
      } else if (y < lastY - 4) {
        el.classList.remove("lt-sticky--hidden");
      }
      lastY = y;
    };
    const onScroll = () => update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);
}
