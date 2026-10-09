"use client";

import { useState } from "react";
import { DetailSearchPanel } from "@/components/common/DetailSearch";

/** ドロワーは画面全体に重なるので、1つずつ開いて見る */
const CASES: { key: string; label: string; count?: number | null; countUrl?: string; unit: string }[] = [
  { key: "zero", label: "0件（該当なし）", count: 0, unit: "件" },
  { key: "many", label: "大量（12,345件）", count: 12345, unit: "件" },
  { key: "fail-sync", label: "取れない（その場で数える側が null）", count: null, unit: "名" },
  { key: "fail-fetch", label: "取れない（API が 404）", countUrl: "/api/__no_such_count", unit: "社" },
  { key: "real", label: "本物の API（?industry=ai）", countUrl: "/api/companies/count?industry=ai", unit: "社" },
];

export function DetailSearchHarness() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      {CASES.map((c) => (
        <div key={c.key} style={{ width: "100%" }}>
          <button type="button" data-case={c.key} onClick={() => setOpen(open === c.key ? null : c.key)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
            {c.label} を開く
          </button>
          <DetailSearchPanel open={open === c.key} onClose={() => setOpen(null)} count={c.count} countUrl={c.countUrl} unit={c.unit}>
            {["フェーズ", "事業領域", "顧客の業界", "都道府県"].map((l) => (
              <span key={l} style={{ padding: "7px 14px", borderRadius: 999, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 13 }}>{l}</span>
            ))}
          </DetailSearchPanel>
        </div>
      ))}
    </div>
  );
}
