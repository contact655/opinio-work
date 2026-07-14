"use client";

import { useState, useTransition } from "react";
import { updateSetting } from "./actions";

export default function AdminSettingsClient({ initialSettings }: { initialSettings: Record<string, string> }) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);

  function toggle(key: string) {
    const newVal = settings[key] === "true" ? "false" : "true";
    startTransition(async () => {
      await updateSetting(key, newVal);
      setSettings(prev => ({ ...prev, [key]: newVal }));
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    });
  }

  const gateEnabled = settings["review_gate_enabled"] === "true";

  return (
    <div style={{ padding: "40px 48px", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>設定</h1>
      <p style={{ margin: "0 0 32px", fontSize: 13, color: "var(--ink-soft)" }}>プラットフォームのグローバル設定</p>

      <section style={{ border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", background: "var(--line-soft)", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>口コミ・給与 設定</h2>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
              Give First 閲覧制御
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, maxWidth: 480 }}>
              有効にすると、口コミを閲覧するには自分も投稿が必要になります。
              投稿後は1年間の閲覧権が自動付与されます。
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => toggle("review_gate_enabled")}
              disabled={isPending}
              style={{
                width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
                background: gateEnabled ? "var(--royal)" : "var(--line)",
                position: "relative", transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 3, left: gateEnabled ? 26 : 3,
                width: 22, height: 22, borderRadius: "50%", background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
              }} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 600, color: gateEnabled ? "var(--royal)" : "var(--ink-mute)" }}>
              {saved === "review_gate_enabled" ? "✓ 保存" : gateEnabled ? "有効" : "無効"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
