"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function CanCasualMeetingToggle({
  userId,
  initialValue,
}: {
  userId: string;
  initialValue: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    setSaving(true);
    const newValue = !value;
    const supabase = createClient();
    const { error } = await supabase
      .from("ow_users")
      .update({ can_casual_meeting: newValue })
      .eq("id", userId);

    if (!error) {
      setValue(newValue);
    } else {
      console.error("can_casual_meeting update failed:", error.message);
    }
    setSaving(false);
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
