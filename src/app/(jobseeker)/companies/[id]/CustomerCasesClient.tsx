"use client";

import { useState } from "react";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import { ShowMoreButton } from "./ShowMoreButton";
import { CHIP_STYLES } from "@/lib/utils/chipVariant";

const INITIAL_CASES = 3;

/**
 * ⚠️ 製品ピルの色は出し分けない（2026-08-23）。
 *    ここは `companies/[id]/page.tsx` の productStyle とは**別の2つ目の実装**で、
 *    同じく4色（royal / amber / green / purple）を当てていた。
 *    凡例が無く、緑が「金銭条件」と衝突するので neutral に統一する。
 *    → src/lib/utils/chipVariant.ts
 */
function productStyle(_name: string): { bg: string; border: string; color: string } {
  return CHIP_STYLES.neutral;
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
          fontSize: 12, fontWeight: 600, color: "var(--ink-soft)",
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
                fontSize: 12, fontWeight: 600, color: s.color,
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
          /* ⚠️ 緑にしない（2026-08-23）。緑は金銭的にプラスの条件だけ。 */
          fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-mute)",
          background: "var(--bg-tint)", borderRadius: 6, padding: "2px 7px",
          whiteSpace: "nowrap", marginTop: 1, fontFamily: "var(--font-noto-sans)",
        }}>
          成果
        </span>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, fontWeight: 600, fontFamily: "var(--font-noto-sans)" }}>
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

      {!showAll && hiddenCount > 0 && (
        <ShowMoreButton
          variant="expand"
          label={`すべて見る（残り ${hiddenCount}）`}
          expanded={false}
          onClick={() => setShowAll(true)}
          fade
          wrapperStyle={{ position: "relative", marginTop: -32 }}
        />
      )}

      {showAll && cases.length > INITIAL_CASES && (
        <ShowMoreButton
          variant="expand"
          label="折りたたむ"
          expanded={true}
          onClick={() => setShowAll(false)}
          wrapperStyle={{ marginTop: "var(--space-3)" }}
        />
      )}
    </div>
  );
}
