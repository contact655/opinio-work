"use client";

import { useState } from "react";

/**
 * ★企業ストーリーの本文を「続きを読む」で開く（2026-09-22）。
 *
 * ⚠️★それまで企業ページは**冒頭120字だけ**を出し、全文を読む手段がどこにも無かった。
 *    `/biz/posts` の入力欄は14行の本文と読了時間を出しているのに、求職者には届いていなかった。
 * ⚠️ 本文（children）はサーバーで Markdown に描いて渡す。**HTML には全文が入る**
 *    （畳んでいるのは見た目だけ）。検索エンジンにも全文が届く。
 * ⚠️ 短い本文ではこの部品を使わない（呼び出し側が `long` で判定する）。
 *    畳む必要の無いものに「続きを読む」を出すと、押しても何も増えない。
 */
export function ExpandableStoryBody({ children, title }: { children: React.ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div
        style={{
          position: "relative",
          maxHeight: open ? "none" : 150,
          overflow: "hidden",
        }}
      >
        {children}
        {!open && (
          <div
            aria-hidden
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0, height: 56,
              background: "linear-gradient(rgba(255,255,255,0), #fff)",
            }}
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? `「${title}」を閉じる` : `「${title}」の続きを読む`}
        style={{
          marginTop: 4, padding: "6px 0", border: "none", background: "none",
          fontSize: 13, fontWeight: 700, color: "var(--royal)", cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {open ? "閉じる" : "続きを読む"}
      </button>
    </div>
  );
}
