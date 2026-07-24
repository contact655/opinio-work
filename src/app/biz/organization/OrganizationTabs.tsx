"use client";

import { useRouter } from "next/navigation";

type Tab = "departments" | "roles";

const TABS: { key: Tab; label: string }[] = [
  { key: "departments", label: "部門" },
  { key: "roles", label: "職種" },
];

export function OrganizationTabs({ activeTab }: { activeTab: Tab }) {
  const router = useRouter();

  return (
    <div
      role="tablist"
      aria-label="組織マスタ"
      style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)" }}
    >
      {TABS.map((tab) => {
        const isSelected = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => {
              const url = tab.key === "departments" ? "/biz/organization" : "/biz/organization?tab=roles";
              router.push(url);
            }}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: isSelected ? "2px solid var(--royal)" : "2px solid transparent",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: isSelected ? 700 : 400,
              color: isSelected ? "var(--royal)" : "var(--ink-mute)",
              cursor: "pointer",
              marginBottom: -1,
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
