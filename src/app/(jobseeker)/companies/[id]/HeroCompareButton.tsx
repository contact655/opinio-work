"use client";

import React, { useState, useEffect, useCallback } from "react";
import { addToCompare, removeFromCompare, isInCompareList } from "@/components/companies/CompareBar";

const COMPARE_EVENT = "opinio-compare-update";

export function HeroCompareButton({
  companyId,
  companyName,
  companyInitial,
  companyGradient,
}: {
  companyId: string;
  companyName: string;
  companyInitial: string;
  companyGradient: string;
}) {
  const [inCompare, setInCompare] = useState(false);

  useEffect(() => {
    setInCompare(isInCompareList(companyId));
    const onUpdate = () => setInCompare(isInCompareList(companyId));
    window.addEventListener(COMPARE_EVENT, onUpdate);
    return () => window.removeEventListener(COMPARE_EVENT, onUpdate);
  }, [companyId]);

  const handleCompare = useCallback(() => {
    if (inCompare) {
      removeFromCompare(companyId);
    } else {
      addToCompare({ id: companyId, name: companyName, initial: companyInitial, gradient: companyGradient });
    }
  }, [inCompare, companyId, companyName, companyInitial, companyGradient]);

  return (
    <button
      onClick={handleCompare}
      title={inCompare ? "比較リストから削除" : "比較リストに追加"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 9,
        border: inCompare ? "1px solid var(--royal-100)" : "1px solid var(--line)",
        background: inCompare ? "var(--royal-50)" : "#fff",
        color: inCompare ? "var(--royal)" : "var(--ink-mute)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {inCompare ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          比較中
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          比較に追加
        </>
      )}
    </button>
  );
}
