"use client";

import { useState, useTransition } from "react";
import { toggleCanCasualMeeting } from "./actions";

export function CanCasualMeetingToggle({
  userId,
  initialValue,
}: {
  userId: string;
  initialValue: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const saving = isPending;

  // ブラウザの anon クライアントから ow_users を直接 UPDATE すると RLS に弾かれるため、
  // 隣の CanTalkCandidatesToggle と同じく Server Action 経由にする。
  function toggle() {
    if (isPending) return;
    const newValue = !value;
    setValue(newValue);
    startTransition(async () => {
      const res = await toggleCanCasualMeeting(userId, newValue);
      if (!res.ok) {
        setValue(!newValue); // rollback
        console.error("can_casual_meeting update failed:", res.error);
      }
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title={value ? "面談受付中（クリックで解除）" : "面談不可（クリックで有効化）"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 100,
        border: "none",
        cursor: saving ? "wait" : "pointer",
        fontSize: 11,
        fontWeight: 700,
        transition: "all 0.15s",
        background: value
          ? "linear-gradient(135deg, #FEF3C7, #FDE68A)"
          : "var(--line-soft)",
        color: value ? "#92400E" : "var(--ink-mute)",
        boxShadow: value ? "0 1px 4px rgba(245,158,11,0.2)" : "none",
        opacity: saving ? 0.6 : 1,
      }}
    >
      {saving ? "…" : value ? "話を聞ける ✓" : "—"}
    </button>
  );
}
