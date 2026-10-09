"use client";

import { useState, useTransition } from "react";
import { setApproachRangeField } from "./actions";

export function ApproachRangeFieldToggle({ field, enabled }: { field: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontWeight: 700, color: enabled ? "var(--royal)" : "var(--ink-mute)" }}>{enabled ? "有効" : "無効"}</span>
      <button
        type="button" disabled={pending}
        onClick={() => {
          if (!confirm(enabled ? "無効にすると、この項目は設定画面から消え、判定にも使われなくなります。よろしいですか？" : "有効にすると、この項目に値を入れている人の判定に使われ始めます。よろしいですか？")) return;
          setError(null);
          start(async () => { const r = await setApproachRangeField(field, !enabled); if (!r.ok) setError(r.error ?? "失敗しました"); });
        }}
        style={{ fontSize: 12, fontWeight: 600, fontFamily: "inherit", padding: "4px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}
      >
        {pending ? "…" : enabled ? "無効にする" : "有効にする"}
      </button>
      {error && <span style={{ fontSize: 12, color: "var(--error)" }}>{error}</span>}
    </span>
  );
}
