"use client";

import { useState, useTransition } from "react";
import { toggleCanTalkToCandidates } from "./actions";

export function CanTalkCandidatesToggle({
  userId,
  initialValue,
}: {
  userId: string;
  initialValue: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (isPending) return;
    const newValue = !value;
    setValue(newValue);
    startTransition(async () => {
      const res = await toggleCanTalkToCandidates(userId, newValue);
      if (!res.ok) setValue(!newValue); // rollback
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={value ? "候補者に話せる（クリックで解除）" : "話せない（クリックで有効化）"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 100,
        border: "none",
        cursor: isPending ? "wait" : "pointer",
        fontSize: 11,
        fontWeight: 700,
        transition: "all 0.15s",
        background: value
          ? "linear-gradient(135deg, #EDE9FE, #DDD6FE)"
          : "var(--line-soft)",
        color: value ? "#5B21B6" : "var(--ink-mute)",
        boxShadow: value ? "0 1px 4px rgba(124,58,237,0.2)" : "none",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {isPending ? "…" : value ? "話せる ✓" : "—"}
    </button>
  );
}
