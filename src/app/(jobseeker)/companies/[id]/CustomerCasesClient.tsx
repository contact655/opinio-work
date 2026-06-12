"use client";

import { useState } from "react";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";

const INITIAL_CASES = 3;

function productStyle(name: string): { bg: string; border: string; color: string } {
  const n = name.toLowerCase();
  if (n.includes("sales") || n.includes("crm") || n.includes("営業"))
    return { bg: "var(--royal-50)", border: "var(--royal-100)", color: "var(--royal)" };
  if (n.includes("market") || n.includes("マーケ"))
    return { bg: "#FEF3C7", border: "#FDE68A", color: "#92400E" };
  if (n.includes("service") || n.includes("support") || n.includes("success") || n.includes("サポート"))
    return { bg: "#D1FAE5", border: "#A7F3D0", color: "#065F46" };
  if (n.includes("data") || n.includes("analytics") || n.includes("分析") || n.includes("ai"))
    return { bg: "#F3E8FF", border: "#DDD6FE", color: "#7C3AED" };
  return { bg: "var(--royal-50)", border: "var(--royal-100)", color: "var(--royal)" };
}

/** 数値・パーセント・倍数を太字にする */
function BoldNumbers({ text }: { text: string }) {
  const parts = text.split(/([\d,]+(?:\.\d+)?(?:倍|%|件|名|社|万|億|円|ヶ月|ヵ月|か月|時間|分|日|年|割|本|個|台|回|人)?)/g);
  return (
    <>
      {parts.map((part, i) =>
        /[\d,]+(?:\.\d+)?/.test(part) ? (
          <strong key={i} style={{ fontSize: 14, fontWeight: 800, color: "#047857", fontFamily: "Inter, sans-serif" }}>{part}</strong>
        ) : part
      )}
    </>
  );
}

type CustomerCase = NonNullable<CompanyDetail["customer_cases"]>[number];

function CaseCard({ c }: { c: CustomerCase }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* ヘッダー行: 企業名 + 業種バッジ + 製品ピル */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          {c.name}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, color: "var(--ink-soft)",
          background: "var(--bg-tint)", border: "1px solid var(--line)",
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
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
        <span style={{
          fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-soft)",
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
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
        <span style={{
          fontSize: "var(--text-xs)", fontWeight: 700, color: "#065F46",
          background: "#D1FAE5", borderRadius: 6, padding: "2px 7px",
          whiteSpace: "nowrap", marginTop: 1, fontFamily: "var(--font-noto-sans)",
        }}>
          成果
        </span>
        <p style={{ margin: 0, fontSize: 12, color: "#065F46", lineHeight: 1.7, fontWeight: 600, fontFamily: "var(--font-noto-sans)" }}>
          <BoldNumbers text={c.result} />
        </p>
      </div>
    </div>
  );
}

export default function CustomerCasesClient({ cases, defaultCollapsed }: { cases: NonNullable<CompanyDetail["customer_cases"]>; defaultCollapsed?: boolean }) {
  const [showAll, setShowAll] = useState(!defaultCollapsed);

  const visible = showAll ? cases : cases.slice(0, INITIAL_CASES);
  const hiddenCount = cases.length - INITIAL_CASES;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {visible.map((c, i) => (
          <CaseCard key={i} c={c} />
        ))}
      </div>

      {/* 展開ボタン */}
      {!showAll && hiddenCount > 0 && (
        <div style={{ position: "relative", marginTop: -32 }}>
          {/* グラデーションフェード */}
          <div style={{
            height: 40,
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
              padding: "13px 0",
              background: "var(--royal-50)",
              border: "1.5px solid var(--royal-100)",
              borderRadius: 12,
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: "var(--royal)",
              cursor: "pointer",
              fontFamily: "var(--font-noto-sans)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
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
            marginTop: "var(--space-3)",
            padding: "10px 0",
            background: "transparent",
            border: "1px solid var(--line)",
            borderRadius: 10,
            fontSize: "var(--text-sm)",
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
