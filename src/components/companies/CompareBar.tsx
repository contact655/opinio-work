"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompareBar() {
  const [ids, setIds] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const load = () => {
      const stored = JSON.parse(localStorage.getItem("compare-companies") ?? "[]");
      setIds(stored);
    };
    load();
    window.addEventListener("compare-update", load as EventListener);
    return () => window.removeEventListener("compare-update", load as EventListener);
  }, []);

  function remove(id: string) {
    const updated = ids.filter((i) => i !== id);
    localStorage.setItem("compare-companies", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("compare-update", { detail: updated }));
  }

  function clear() {
    localStorage.setItem("compare-companies", "[]");
    window.dispatchEvent(new CustomEvent("compare-update", { detail: [] }));
  }

  if (ids.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0, right: 0,
      background: "var(--royal)",
      color: "#fff",
      zIndex: 1000,
      padding: "12px 20px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
    }}
    className="compare-bar"
    >
      <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>比較中 {ids.length}/3</span>
      <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 0, overflow: "hidden" }}>
        {ids.map((id) => (
          <div key={id} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>{id.slice(0, 8)}…</span>
            <button onClick={() => remove(id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
          </div>
        ))}
      </div>
      <button onClick={clear} style={{ background: "none", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
        クリア
      </button>
      <button
        onClick={() => router.push(`/companies/compare?ids=${ids.join(",")}`)}
        style={{ background: "#fff", color: "var(--royal)", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", border: "none", flexShrink: 0 }}
      >
        比較する ({ids.length}社) →
      </button>
    </div>
  );
}
