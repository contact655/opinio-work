"use client";
import { useRouter, useSearchParams } from "next/navigation";

export function ViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGrid = searchParams.get("view") === "grid";

  const toggle = (view: "genre" | "grid") => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "grid") {
      params.set("view", "grid");
    } else {
      params.delete("view");
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

  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button
        type="button"
        onClick={() => toggle("genre")}
        title="ジャンル別カルーセル"
        style={{
          ...btnBase,
          background: !isGrid ? "var(--royal)" : "#fff",
          color: !isGrid ? "#fff" : "var(--ink-mute)",
          borderColor: !isGrid ? "var(--royal)" : "var(--line)",
        }}
      >
        {/* carousel / list icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <rect x="2" y="5" width="4" height="14" rx="1"/>
          <rect x="10" y="5" width="4" height="14" rx="1"/>
          <rect x="18" y="5" width="4" height="14" rx="1"/>
        </svg>
        ジャンル別
      </button>
      <button
        type="button"
        onClick={() => toggle("grid")}
        title="コンパクトグリッド"
        style={{
          ...btnBase,
          background: isGrid ? "var(--royal)" : "#fff",
          color: isGrid ? "#fff" : "var(--ink-mute)",
          borderColor: isGrid ? "var(--royal)" : "var(--line)",
        }}
      >
        {/* grid icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        コンパクト
      </button>
    </div>
  );
}
