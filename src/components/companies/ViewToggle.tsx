"use client";
import { useRouter, useSearchParams } from "next/navigation";

export function ViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") ?? "grid";

  const toggle = (view: "grid" | "list2" | "list") => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "grid") {
      params.delete("view"); // grid = デフォルト（パラメータなし）
    } else {
      params.set("view", view);
    }
    router.push(`/companies?${params.toString()}`);
  };

  const btnBase: React.CSSProperties = {
    padding: "6px 12px",
    border: "1px solid var(--line)",
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    transition: "all 0.15s",
    background: "transparent",
  };

  const options: { value: "grid" | "list2" | "list"; label: string; icon: React.ReactNode }[] = [
    {
      value: "list",
      label: "リスト",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
        </svg>
      ),
    },
    {
      value: "list2",
      label: "グリッド",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <line x1="2" y1="6" x2="10" y2="6"/>
          <line x1="2" y1="12" x2="10" y2="12"/>
          <line x1="2" y1="18" x2="10" y2="18"/>
          <line x1="14" y1="6" x2="22" y2="6"/>
          <line x1="14" y1="12" x2="22" y2="12"/>
          <line x1="14" y1="18" x2="22" y2="18"/>
        </svg>
      ),
    },
    {
      value: "grid",
      label: "カード",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map(({ value, label, icon }) => {
        const active = currentView === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            title={label}
            style={{
              ...btnBase,
              background: active ? "var(--royal)" : "#fff",
              color: active ? "#fff" : "var(--ink-mute)",
              borderColor: active ? "var(--royal)" : "var(--line)",
            }}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}
