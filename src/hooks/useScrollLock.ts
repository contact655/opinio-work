"use client";

import { useEffect } from "react";

/**
 * モーダル・引き出しを開いている間、後ろのページのスクロールを止める（2026-11-27）。
 *
 * ★★`document.body.style.overflow = "hidden"` では止まらない。
 *   html に `overflow-x: clip` があるため（globals.css。ヘッダーの sticky を生かすため 2026-09-20 に入れた）、
 *   body の overflow は画面全体のスクロールに伝わらない（CSS の仕様: html の overflow が visible 以外だと、
 *   body の値は viewport に引き継がれない）。実測（2026-11-27 / dev）: モーダルを開いたまま外でスクロールすると
 *   375px で scrollY 300 → 800、1300px で 100 → 600 と後ろが動いていた。
 *
 * ★やり方: body を `position: fixed` にして、開く前のスクロール位置を `top` に入れ、閉じたら同じ位置へ戻す。
 *   iOS Safari でも効く（overflow だけでは iOS は止まらない）。
 *
 * ★重ねて開いても正しく動くように、開いている数を数える。最初の1つで止め、最後の1つが閉じたときだけ戻す。
 *   内側のダイアログを閉じても、外側が開いている間は止まったまま。
 *
 * ⚠️ `document.body.style.overflow` を直接書く処理を新しく足さないこと。必ずこのフックを使う。
 */

let lockCount = 0;
let savedScrollY = 0;
let savedStyle: {
  position: string; top: string; left: string; right: string; width: string;
  overflow: string; paddingRight: string;
} | null = null;

function lock() {
  lockCount += 1;
  if (lockCount > 1) return;
  const body = document.body;
  savedScrollY = window.scrollY;
  savedStyle = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
  };
  // スクロールバーが消えて横にずれないよう、その幅だけ右に余白を足す（PC のみ。スマホは 0）
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
}

function unlock() {
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return;
  const body = document.body;
  if (savedStyle) {
    body.style.position = savedStyle.position;
    body.style.top = savedStyle.top;
    body.style.left = savedStyle.left;
    body.style.right = savedStyle.right;
    body.style.width = savedStyle.width;
    body.style.overflow = savedStyle.overflow;
    body.style.paddingRight = savedStyle.paddingRight;
    savedStyle = null;
  }
  // ⚠️ html は scroll-behavior: smooth。戻すときに動いて見えないよう instant で戻す
  window.scrollTo({ top: savedScrollY, left: 0, behavior: "instant" as ScrollBehavior });
}

/** `active` が true の間、後ろのスクロールを止める */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lock();
    return () => unlock();
  }, [active]);
}
