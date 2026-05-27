"use client";
import { useRouter, useSearchParams } from "next/navigation";

export function ViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") ?? "genre";

  const toggle = (view: "genre" | "grid" | "list") => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "genre") {
      params.delete("view");
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

  const options: { value: "genre" | "grid" | "list"; label: string; icon: React.ReactNode }[] = [
    {
      value: "genre",
      label: "ジャンル別",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <rect x="2" y="5" width="4" height="14" rx="1"/>
          <rect x="10" y="5" width="4" height="14" rx="1"/>
          <rect x="18" y="5" width="4" height="14" rx="1"/>
        </svg>
      ),
    },
    {
      value: "grid",
      label: "コンパクト",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
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
