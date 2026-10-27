"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * ★設定の一番下のログアウト（2026-10-27 / 柴さんの指示）。
 *   スマホの引き出しの一番下がタブバーに隠れて押せなかったので、2つ目の入口として置く。
 * ⚠️ やることはヘッダーの handleLogout と同じ（signOut → トップへページごと移る）。
 *    ページごと移るのは、ヘッダーなどが持つログイン中の状態を残さないため。
 */
export default function LogoutSection() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    const { error } = await createClient().auth.signOut();
    if (error) console.error("[settings] signOut:", error.message);
    window.location.href = "/";
  }
  return (
    <div data-state="settings-logout" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        style={{
          padding: "10px 18px", fontSize: 14, fontWeight: 600,
          border: "1px solid var(--line)", borderRadius: 8,
          background: "#fff", color: "var(--ink)",
          cursor: busy ? "default" : "pointer", fontFamily: "inherit",
        }}
      >
        {busy ? "ログアウト中..." : "ログアウト"}
      </button>
    </div>
  );
}
