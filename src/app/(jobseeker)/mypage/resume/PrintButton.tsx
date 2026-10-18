"use client";

/** 職務経歴書の「印刷・PDFで保存」。ブラウザの印刷の画面を開くだけ（PDF はそこで「PDFに保存」を選ぶ） */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} data-state="resume-print" className="tap-min-h"
      style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
      印刷・PDFで保存
    </button>
  );
}
