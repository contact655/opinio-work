"use client";

import { useState } from "react";

/**
 * ★求人詳細の「年収の補足」（2026-10-29 / 柴さんの指示）。
 *
 * 767px 以下だけ2行で省略し、「続きを読む」で開く。それまでは昇給・賞与・残業代・手当が
 * 1段落のまま全部出て、年収の箱が縦に長くなっていた（COIN の求人で143字・9行）。
 * - ⚠️ 768px 以上は従来どおり全文（省略とボタンは globals.css の .jd-salary-note / .jd-note-toggle）。
 * - ⚠️ 本文は HTML に全文が入る（畳んでいるのは見た目だけ）。
 * - ⚠️ 短い補足は畳まない（押しても何も増えないボタンを出さない）。
 */
const CLAMP_MIN_CHARS = 60;

export function SalaryNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > CLAMP_MIN_CHARS;
  return (
    <>
      <p
        className={long && !open ? "jd-salary-note jd-salary-note--clamped" : "jd-salary-note"}
        /* ★入力された改行どおりに出す（white-space は globals.css の .jd-salary-note。2026-10-29） */
        style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          className="jd-note-toggle btn-fixed-size"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            marginTop: 4, padding: 0, border: "none", background: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: "var(--royal)",
          }}
        >
          {open ? "閉じる" : "続きを読む"}
        </button>
      )}
    </>
  );
}
