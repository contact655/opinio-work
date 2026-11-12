"use client";

import { useState } from "react";
import { CAREER_STANCES } from "@/lib/constants/careerPreferences";
import { StanceReconfirmDialog } from "@/components/profile/StanceReconfirmDialog";

/** ★ダイアログは画面いっぱいに重なるので、押して1つずつ開く。preview なので通信も localStorage もしない */
export function StanceReconfirmDemo() {
  const [open, setOpen] = useState<{ stance: string; n: number } | null>(null);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {CAREER_STANCES.map((o) => (
        <button key={o.value} type="button" data-action={`preview-open-${o.value}`}
          onClick={() => setOpen((p) => ({ stance: o.value, n: (p?.n ?? 0) + 1 }))}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 13, cursor: "pointer" }}>
          いまの設定「{o.label}」で開く
        </button>
      ))}
      {open && <StanceReconfirmDialog key={open.n} ownerKey="preview" currentStance={open.stance} preview />}
    </div>
  );
}
