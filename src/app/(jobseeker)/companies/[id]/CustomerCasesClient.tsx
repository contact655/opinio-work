"use client";

import { useState } from "react";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";

const INITIAL_CASES = 3;

function productStyle(name: string): { bg: string; border: string; color: string } {
  const n = name.toLowerCase();
  if (n.includes("sales") || n.includes("crm"))
    return { bg: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8" };
  if (n.includes("service") || n.includes("サポート"))
    return { bg: "#F5F3FF", border: "#DDD6FE", color: "#6D28D9" };
  if (n.includes("market") || n.includes("マーケ"))
    return { bg: "#FFF1F2", border: "#FECDD3", color: "#9D174D" };
  if (n.includes("data") || n.includes("analytics") || n.includes("tableau"))
    return { bg: "#ECFEFF", border: "#A5F3FC", color: "#0E7490" };
  if (n.includes("commerce") || n.includes("ec") || n.includes("コマース"))
    return { bg: "#F0FDF4", border: "#BBF7D0", color: "#065F46" };
  if (n.includes("ai") || n.includes("agentforce") || n.includes("einstein"))
    return { bg: "#FFF7ED", border: "#FED7AA", color: "#C2410C" };
  if (n.includes("slack") || n.includes("コミュニ"))
    return { bg: "#F0FDF4", border: "#BBF7D0", color: "#065F46" };
  return { bg: "#EFF3FC", border: "#DCE5F7", color: "#002366" };
}

type CustomerCase = NonNullable<CompanyDetail["customer_cases"]>[number];

function CaseCard({ c }: { c: CustomerCase }) {
  return (
    <div
      style={{
        background: "#FFFDF7",
        border: "1px solid #FDE68A",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* ヘッダー行: 企業名 + 業種バッジ + 製品ピル */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-noto-sans)" }}>
          🏢 {c.name}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, color: "#92400E",
          background: "#FEF3C7", border: "1px solid #FDE68A",
          borderRadius: 100, padding: "2px 9px",
          fontFamily: "var(--font-noto-sans)", whiteSpace: "nowrap",
        }}>
          {c.industry}
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginLeft: "auto" }}>
          {c.products.map((p, pi) => {
            const s = productStyle(p);
            return (
              <span key={pi} style={{
                fontSize: 10, fontWeight: 600, color: s.color,
                background: s.bg, border: `1px solid ${s.border}`,
                borderRadius: 100, padding: "2px 8px",
                fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
              }}>
                {p}
              </span>
            );
          })}
        </div>
      </div>
      {/* 活用内容 */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "var(--ink-soft)",
          background: "#F1F5F9", borderRadius: 6, padding: "2px 7px",
          whiteSpace: "nowrap", marginTop: 1, fontFamily: "var(--font-noto-sans)",
        }}>
          活用内容
        </span>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, fontFamily: "var(--font-noto-sans)" }}>
          {c.usecase}
        </p>
      </div>
      {/* 成果 */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "#065F46",
          background: "#D1FAE5", borderRadius: 6, padding: "2px 7px",
          whiteSpace: "nowrap", marginTop: 1, fontFamily: "var(--font-noto-sans)",
        }}>
          成果
        </span>
        <p style={{ margin: 0, fontSize: 12, color: "#065F46", lineHeight: 1.7, fontWeight: 600, fontFamily: "var(--font-noto-sans)" }}>
          {c.result}
        </p>
      </div>
    </div>
  );
}

export default function CustomerCasesClient({ cases }: { cases: NonNullable<CompanyDetail["customer_cases"]> }) {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? cases : cases.slice(0, INITIAL_CASES);
  const hiddenCount = cases.length - INITIAL_CASES;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visible.map((c, i) => (
          <CaseCard key={i} c={c} />
        ))}
      </div>

      {/* 展開ボタン */}
      {!showAll && hiddenCount > 0 && (
        <div style={{ position: "relative", marginTop: -32 }}>
          {/* グラデーションフェード */}
          <div style={{
            height: 80,
            background: "linear-gradient(to bottom, transparent, #fff)",
            pointerEvents: "none",
          }} />
          <button
            onClick={() => setShowAll(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              padding: "11px 0",
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              color: "#92400E",
              cursor: "pointer",
              fontFamily: "var(--font-noto-sans)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            すべての導入事例を見る（残り {hiddenCount} 社）
          </button>
        </div>
      )}

      {/* 折りたたむボタン */}
      {showAll && cases.length > INITIAL_CASES && (
        <button
          onClick={() => setShowAll(false)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            marginTop: 12,
            padding: "10px 0",
            background: "transparent",
            border: "1px solid var(--line)",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--ink-soft)",
            cursor: "pointer",
            fontFamily: "var(--font-noto-sans)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
          折りたたむ
        </button>
      )}
    </div>
  );
}
