"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── localStorage helpers (exported so other modules can reuse) ─────────────
export function getCompareIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("opinio-compare") ?? "[]");
  } catch {
    return [];
  }
}

export function setCompareIds(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("opinio-compare", JSON.stringify(ids.slice(0, 3)));
  window.dispatchEvent(new CustomEvent("compare-update"));
}

// ── CompareBar ─────────────────────────────────────────────────────────────
type CompareEntry = { id: string; name: string };

// Module-level name cache so cards can register their names
const _nameCache: Record<string, string> = {};
export function registerCompareName(id: string, name: string) {
  _nameCache[id] = name;
}

export function CompareBar() {
  const router = useRouter();
  const [entries, setEntries] = useState<CompareEntry[]>([]);

  const refresh = () => {
    const ids = getCompareIds();
    setEntries(ids.map((id) => ({ id, name: _nameCache[id] ?? "…" })));
  };

  useEffect(() => {
    refresh();
    window.addEventListener("compare-update", refresh);
    return () => window.removeEventListener("compare-update", refresh);
  }, []);

  if (entries.length === 0) return null;

  const canCompare = entries.length >= 2;

  const removeEntry = (id: string) => {
    setCompareIds(getCompareIds().filter((x) => x !== id));
  };

  const clearAll = () => {
    setCompareIds([]);
  };

  const handleCompare = () => {
    if (!canCompare) return;
    router.push(`/companies/compare?ids=${entries.map((e) => e.id).join(",")}`);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        background: "#fff",
        borderTop: "1.5px solid var(--line)",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
        height: "auto",
      }}
      className="compare-bar-root"
    >
      <style>{`
        .compare-bar-root {
          padding: 10px 20px;
        }
        @media (max-width: 767px) {
          .compare-bar-root {
            bottom: 64px;
            padding: 8px 14px;
          }
        }
      `}</style>

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {/* Label */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--ink-soft)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          比較中
        </span>

        {/* Chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {entries.map((e) => (
            <span
              key={e.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 8px 4px 10px",
                borderRadius: 100,
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                color: "var(--royal)",
                whiteSpace: "nowrap",
              }}
            >
              {e.name}
              <button
                onClick={() => removeEntry(e.id)}
                aria-label={`${e.name}を比較から外す`}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(0,35,102,0.15)",
                  color: "var(--royal)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 11,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}

          {/* Placeholder slots */}
          {Array.from({ length: Math.max(0, 2 - entries.length) }).map(
            (_, i) => (
              <span
                key={`slot-${i}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 100,
                  border: "1.5px dashed var(--line)",
                  color: "var(--ink-mute)",
                  whiteSpace: "nowrap",
                }}
              >
                企業を選ぶ
              </span>
            )
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            onClick={clearAll}
            style={{
              fontSize: 12,
              color: "var(--ink-mute)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            クリア
          </button>

          <button
            onClick={handleCompare}
            disabled={!canCompare}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: canCompare ? "pointer" : "not-allowed",
              background: canCompare
                ? "linear-gradient(135deg, var(--royal) 0%, #3B5FD9 100%)"
                : "var(--line)",
              color: canCompare ? "#fff" : "var(--ink-mute)",
              transition: "opacity 0.15s",
            }}
          >
            比較する ({entries.length}社)
            {canCompare && " →"}
          </button>
        </div>
      </div>
    </div>
  );
}
