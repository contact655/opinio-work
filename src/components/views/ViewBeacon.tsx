"use client";

import { useEffect, useRef } from "react";

/**
 * ★閲覧を1件数えてもらう（2026-10-09 / 段階D）。企業ページと求人詳細に置く。
 *
 * ⚠️ ページは ISR なので、サーバーの描画では閲覧者を読めない。開いたあとに
 *    `POST /api/views` を1回呼ぶだけ。数えるかどうかはサーバーが決める
 *    （`lib/views/decide.ts`）。⚠️ ここで判定を足さないこと。
 * ⚠️ 失敗しても画面には何も出さない（閲覧数は利用者の操作ではないため）。
 */
export default function ViewBeacon({ type, id }: { type: "company" | "job"; id: string }) {
  /* ⚠️ 開発時の StrictMode は effect を2回走らせる。同じページで2回送らないようにする */
  const sent = useRef<string | null>(null);
  useEffect(() => {
    const key = `${type}:${id}`;
    if (sent.current === key) return;
    sent.current = key;
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
      keepalive: true,
    }).catch(() => { /* 記録の失敗は利用者に関係しない */ });
  }, [type, id]);
  return null;
}
