"use client";

import { useState, useEffect } from "react";

export type FilterDef = {
  key: string;
  label: string;
  chips: string[];
  /** Optional: chip → count map for the (N) badge */
  counts?: Record<string, number>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  filterDefs: readonly FilterDef[] | FilterDef[];
  current: Record<string, string>;
  onApply: (next: Record<string, string>) => void;
  onClear: () => void;
};

/**
 * Fix 10: Mobile filter bottom sheet
 * - Slides up from the bottom on mobile
 * - All filters are batch-edited locally; "適用" commits, "クリア" resets all to "すべて"
 */
export function MobileFilterSheet({ open, onClose, filterDefs, current, onApply, onClear }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(current);

  // Reset draft when sheet opens or current changes externally
  useEffect(() => {
    if (open) setDraft(current);
  }, [open, current]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = orig; };
    }
  }, [open]);

  if (!open) return null;

  const setDraftValue = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleClear = () => {
    const cleared: Record<string, string> = {};
    for (const d of filterDefs) cleared[d.key] = "すべて";
    setDraft(cleared);
    onClear();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 80,
          background: "rgba(15, 23, 42, 0.4)",
        }}
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          left: 0, right: 0, bottom: 0,
          zIndex: 81,
          background: "#fff",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.12)",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e5e7eb" }} />
        </div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "0.5px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>絞り込み</h2>
          <button
            onClick={handleClear}
            style={{ fontSize: 13, color: "#6b7280", background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
          >
            クリア
          </button>
        </div>

        {/* Body (scrollable) */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {filterDefs.map((def) => (
            <div key={def.key} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
                {def.label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {def.chips.map((chip) => {
                  const count = def.counts?.[chip];
                  const isActive = draft[def.key] === chip;
                  const isAll = chip === "すべて";
                  const isDisabled = !isAll && count !== undefined && count === 0;
                  return (
                    <button
                      key={chip}
                      onClick={() => !isDisabled && setDraftValue(def.key, chip)}
                      disabled={isDisabled}
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 500,
                        background: isActive ? "#059669" : "#fff",
                        color: isActive ? "#fff" : isDisabled ? "#9ca3af" : "#1f2937",
                        border: `1.5px solid ${isActive ? "#059669" : isDisabled ? "#f3f4f6" : "#d1d5db"}`,
                        borderRadius: 999,
                        padding: "6px 14px",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.55 : 1,
                      }}
                    >
                      {chip}
                      {!isAll && count !== undefined && (
                        <span style={{ marginLeft: 4, fontSize: 11, opacity: isActive ? 0.9 : 0.6 }}>
                          ({count})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer (apply) */}
        <div style={{ padding: "12px 20px", borderTop: "0.5px solid #e5e7eb", background: "#fff", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button
            onClick={handleApply}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              color: "#fff",
              background: "#1D9E75",
              border: "none",
              cursor: "pointer",
            }}
          >
            この条件で表示
          </button>
        </div>
      </div>
    </>
  );
}
