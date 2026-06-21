"use client";

import { useState, useTransition } from "react";
import { updateTalkThemes } from "./actions";

const PRESET_THEMES = [
  "採用について", "職場環境", "入社後のリアル", "仕事内容",
  "キャリアパス", "会社の魅力", "営業スタイル", "顧客事例",
  "技術スタック", "開発文化", "マーケ戦略", "働き方",
];

export function TalkThemesEditor({
  adminId,
  initialThemes,
}: {
  adminId: string;
  initialThemes: string[];
}) {
  const [themes, setThemes] = useState<string[]>(initialThemes ?? []);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(tag: string) {
    setThemes((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await updateTalkThemes(adminId, themes);
      setSaved(true);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {themes.length > 0 ? (
          themes.map((t) => (
            <span key={t} style={{
              fontSize: 10, fontWeight: 600,
              padding: "2px 7px", borderRadius: 100,
              background: "var(--royal-50)", color: "var(--royal)",
              border: "1px solid var(--royal-100)",
            }}>{t}</span>
          ))
        ) : (
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>未設定</span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            fontSize: 10, fontWeight: 600, cursor: "pointer",
            padding: "2px 8px", borderRadius: 100,
            background: saved ? "#ECFDF5" : "#F8FAFC",
            color: saved ? "var(--success)" : "var(--ink-mute)",
            border: `1px solid ${saved ? "#A7F3D0" : "var(--line)"}`,
          }}
        >
          {saved ? "✓ 保存済" : "編集"}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: "relative", background: "#fff",
      border: "1.5px solid var(--royal)", borderRadius: 10,
      padding: 12, minWidth: 240, zIndex: 10,
      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 8 }}>
        話せるテーマを選択（最大3つ）
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
        {PRESET_THEMES.map((tag) => {
          const active = themes.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              disabled={!active && themes.length >= 3}
              style={{
                fontSize: 11, fontWeight: 600, cursor: active || themes.length < 3 ? "pointer" : "not-allowed",
                padding: "3px 9px", borderRadius: 100,
                background: active ? "var(--royal)" : "#F8FAFC",
                color: active ? "#fff" : themes.length >= 3 && !active ? "var(--ink-mute)" : "var(--ink-soft)",
                border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
                opacity: !active && themes.length >= 3 ? 0.5 : 1,
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{
            flex: 1, padding: "6px", borderRadius: 7, border: "none",
            background: "var(--royal)", color: "#fff",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          {pending ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setThemes(initialThemes ?? []); }}
          style={{
            padding: "6px 10px", borderRadius: 7,
            background: "#F8FAFC", color: "var(--ink-mute)",
            border: "1px solid var(--line)", fontSize: 12, cursor: "pointer",
          }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
